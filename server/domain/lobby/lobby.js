import { fail, ok } from "../common/result.js";
import { errors } from "../common/errors.js";
import { makeCode } from "../common/ids.js";
import { freshCourse } from "../match/coins.js";
import { createPlayer, playerName } from "../player/player.js";
import { ensureAdmin, findRoom } from "../room/room.js";

function emptyState() {
  return { rooms: {} };
}

function clone(state) {
  return structuredClone(state ?? emptyState());
}

export function createRoom(state, { playerId, listed, now, rng }) {
  const next = clone(state);
  const code = makeCode(rng, (candidate) => Boolean(next.rooms[candidate]));
  const course = freshCourse(rng);
  const player = createPlayer(playerId, playerName(0), 0, course.maze.entrance);
  next.rooms[code] = {
    code,
    listed: listed !== false,
    phase: "lobby",
    adminId: playerId,
    countdownEndsAt: null,
    startedAt: null,
    maze: course.maze,
    coins: course.coins,
    players: [player],
    updatedAt: now,
  };
  return ok(next, [{ type: "room", code }]);
}

export function joinRoom(state, { playerId, code, now }) {
  const roomCode = String(code ?? "").trim().toUpperCase();
  const next = clone(state);
  const room = findRoom(next, roomCode);
  if (!room) return fail(errors.roomNotFound);
  if (room.phase !== "lobby") return fail(errors.matchClosed);
  const existing = room.players.find((player) => player.id === playerId);
  if (existing) {
    existing.connected = true;
    room.updatedAt = now;
    return ok(next, [{ type: "room", code: roomCode }]);
  }
  const index = room.players.length;
  room.players.push(createPlayer(playerId, playerName(index), index, room.maze.entrance));
  room.updatedAt = now;
  return ok(next, [{ type: "room", code: roomCode }]);
}

export function listRooms(state, { query, offset, limit }) {
  const q = String(query ?? "").trim().toUpperCase();
  const start = Math.max(0, Number(offset) || 0);
  const size = Math.min(50, Math.max(1, Number(limit) || 20));
  const lobby = Object.values(state.rooms ?? {}).filter((room) => room.phase === "lobby");
  let items;
  if (!q) {
    items = lobby.filter((room) => room.listed !== false);
  } else {
    const exact = lobby.find((room) => room.code === q);
    const rest = lobby.filter((room) => room.listed !== false && room.code.startsWith(q) && room.code !== q);
    items = exact ? [exact, ...rest] : rest;
  }
  items.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const page = items.slice(start, start + size).map((room) => ({
    code: room.code,
    players: room.players.length,
    adminName: room.players.find((player) => player.id === room.adminId)?.name ?? "",
    listed: room.listed !== false,
  }));
  const nextOffset = start + page.length < items.length ? start + page.length : null;
  return { items: page, nextOffset };
}

export function leaveRoom(state, { playerId, code, now }) {
  const next = clone(state);
  const room = findRoom(next, code);
  if (!room) return fail(errors.roomNotFound);
  const index = room.players.findIndex((player) => player.id === playerId);
  if (index === -1) return fail(errors.playerNotFound);
  room.players.splice(index, 1);
  room.updatedAt = now;
  if (!room.players.length) {
    delete next.rooms[code];
    return ok(next, [{ type: "deleted", code }]);
  }
  if (room.phase !== "race") ensureAdmin(room);
  if ((room.phase === "countdown" || room.phase === "lobby") && room.players.length < 2 && room.phase === "countdown") {
    room.phase = "lobby";
    room.countdownEndsAt = null;
    room.startedAt = null;
  }
  return ok(next, [{ type: "room", code }]);
}

export function setConnected(state, { playerId, code, connected, now }) {
  const next = clone(state);
  const room = findRoom(next, code);
  if (!room) return fail(errors.roomNotFound);
  const player = room.players.find((item) => item.id === playerId);
  if (!player) return fail(errors.playerNotFound);
  player.connected = connected;
  room.updatedAt = now;
  return ok(next, [{ type: "room", code }]);
}

export function findPlayerRoom(state, playerId) {
  for (const room of Object.values(state.rooms ?? {})) {
    if (room.players.some((player) => player.id === playerId)) return room.code;
  }
  return null;
}
