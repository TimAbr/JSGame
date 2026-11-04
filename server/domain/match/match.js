import { fail, ok } from "../common/result.js";
import { errors } from "../common/errors.js";
import { freshCourse } from "./coins.js";
import { COIN_BONUS_MS } from "./coins.js";
import { isOpen } from "./maze.js";
import { effectiveTime } from "./time.js";
import { byFinish, resetRun, toPublicPlayer } from "../player/player.js";
import { ensureAdmin, findRoom } from "../room/room.js";

const COUNTDOWN_MS = 5000;
const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

function clone(state) {
  return structuredClone(state);
}

function maybeFinishMatch(room) {
  if (room.phase === "race" && room.players.every((player) => player.finishTimeMs !== null)) {
    room.phase = "finished";
    ensureAdmin(room);
  }
}

export function startMatch(state, { playerId, code, now }) {
  const next = clone(state);
  const room = findRoom(next, code);
  if (!room) return fail(errors.roomNotFound);
  if (room.adminId !== playerId) return fail(errors.notAdmin);
  if (room.phase !== "lobby") return fail(errors.badPhase);
  if (room.players.length < 2) return fail(errors.needPlayers);
  room.phase = "countdown";
  room.countdownEndsAt = now + COUNTDOWN_MS;
  room.startedAt = null;
  room.updatedAt = now;
  return ok(next, [{ type: "room", code }]);
}

export function advanceCountdowns(state, now) {
  const next = clone(state);
  const started = [];
  let changed = false;
  for (const room of Object.values(next.rooms)) {
    if (room.phase === "countdown" && now >= room.countdownEndsAt) {
      room.phase = "race";
      room.startedAt = room.countdownEndsAt;
      for (const player of room.players) resetRun(player, room.maze.entrance);
      room.updatedAt = now;
      started.push(room.code);
      changed = true;
    }
    if (room.phase === "race" && room.players.length && room.players.every((player) => player.finishTimeMs !== null)) {
      room.phase = "finished";
      ensureAdmin(room);
      changed = true;
    }
  }
  return { state: next, started, changed };
}

export function movePlayer(state, { playerId, code, dir, coinVersion, now }) {
  const next = clone(state);
  const room = findRoom(next, code);
  if (!room) return fail(errors.roomNotFound);
  if (room.phase !== "race") return fail(errors.badPhase);
  const player = room.players.find((item) => item.id === playerId);
  if (!player) return fail(errors.playerNotFound);
  if (player.finishTimeMs !== null) return fail(errors.alreadyFinished);
  const delta = DIRS[dir];
  if (!delta) return fail(errors.badMove);
  const x = player.x + delta[0];
  const y = player.y + delta[1];
  if (!isOpen(room.maze, x, y)) return fail(errors.badMove);
  player.x = x;
  player.y = y;
  room.updatedAt = now;
  const events = [{ type: "moved", code, playerId, x, y }];
  const coin = room.coins.find((item) => item.x === x && item.y === y);
  if (coin && !coin.takenBy && (coinVersion == null || coinVersion === coin.version)) {
    coin.takenBy = playerId;
    coin.version += 1;
    player.bonusMs += COIN_BONUS_MS[coin.kind];
    events.push({
      type: "coinTaken",
      code,
      playerId,
      coinId: coin.id,
      version: coin.version,
      kind: coin.kind,
      bonusMs: player.bonusMs,
    });
  } else if (coin && coinVersion != null && (coin.takenBy || coin.version !== coinVersion)) {
    events.push({
      type: "coinRejected",
      code,
      playerId,
      coinId: coin.id,
      version: coin.version,
    });
  }
  if (x === room.maze.exit.x && y === room.maze.exit.y) {
    const finishedBefore = room.players.filter((item) => item.finishSeq != null).length;
    player.finishSeq = finishedBefore + 1;
    player.finishTimeMs = effectiveTime(now, room.startedAt, player.bonusMs);
    events.push({ type: "finished", code, playerId, finishTimeMs: player.finishTimeMs, finishSeq: player.finishSeq });
    maybeFinishMatch(room);
  }
  events.push({ type: "room", code });
  return ok(next, events);
}

export function stopMatch(state, { playerId, code, now }) {
  const next = clone(state);
  const room = findRoom(next, code);
  if (!room) return fail(errors.roomNotFound);
  if (room.adminId !== playerId) return fail(errors.notAdmin);
  if (room.phase === "countdown") {
    room.phase = "lobby";
    room.countdownEndsAt = null;
    room.startedAt = null;
    room.updatedAt = now;
    return ok(next, [{ type: "room", code }]);
  }
  if (room.phase !== "race") return fail(errors.badPhase);
  room.phase = "finished";
  ensureAdmin(room);
  room.updatedAt = now;
  return ok(next, [{ type: "room", code }]);
}

export function restartMatch(state, { playerId, code, now, rng }) {
  const next = clone(state);
  const room = findRoom(next, code);
  if (!room) return fail(errors.roomNotFound);
  if (room.adminId !== playerId) return fail(errors.notAdmin);
  if (room.phase !== "finished" && room.phase !== "lobby") return fail(errors.badPhase);
  const course = freshCourse(rng);
  room.maze = course.maze;
  room.coins = course.coins;
  room.phase = "lobby";
  room.countdownEndsAt = null;
  room.startedAt = null;
  for (const player of room.players) resetRun(player, room.maze.entrance);
  room.updatedAt = now;
  return ok(next, [{ type: "room", code }]);
}

export function reconcileRooms(state, now) {
  const next = clone(state ?? { rooms: {} });
  if (!next.rooms) next.rooms = {};
  for (const room of Object.values(next.rooms)) {
    for (const player of room.players) player.connected = false;
    if (room.phase === "countdown" && room.countdownEndsAt != null && now >= room.countdownEndsAt) {
      room.phase = "race";
      room.startedAt = room.countdownEndsAt;
    }
    if (room.phase === "race" && room.players.length && room.players.every((player) => player.finishTimeMs !== null)) {
      room.phase = "finished";
    }
    if (room.phase === "finished" || room.phase === "lobby") ensureAdmin(room);
  }
  return next;
}

export function toPublic(room, now) {
  if (!room) return null;
  const reveal = room.phase === "race" || room.phase === "finished";
  const players = room.players.map((player) => toPublicPlayer(player, reveal)).sort(byFinish);
  const payload = {
    code: room.code,
    phase: room.phase,
    adminId: room.adminId,
    countdownEndsAt: room.countdownEndsAt,
    startedAt: room.startedAt,
    serverNow: now,
    players,
  };
  if (reveal) {
    payload.maze = room.maze;
    payload.coins = room.coins
      .filter((coin) => !coin.takenBy)
      .map((coin) => ({ id: coin.id, x: coin.x, y: coin.y, kind: coin.kind, version: coin.version }));
  }
  return payload;
}
