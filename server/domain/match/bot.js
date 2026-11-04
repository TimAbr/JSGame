import { isOpen } from "./maze.js";
import { movePlayer } from "./match.js";

const STEPS = [
  { dir: "up", dx: 0, dy: -1 },
  { dir: "down", dx: 0, dy: 1 },
  { dir: "left", dx: -1, dy: 0 },
  { dir: "right", dx: 1, dy: 0 },
];

const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

function exits(maze, x, y) {
  return STEPS.filter((step) => isOpen(maze, x + step.dx, y + step.dy));
}

function correctDir(maze, x, y) {
  const target = `${maze.exit.x},${maze.exit.y}`;
  const queue = [[x, y]];
  const prev = new Map([[`${x},${y}`, null]]);
  while (queue.length) {
    const [cx, cy] = queue.shift();
    if (`${cx},${cy}` === target) break;
    for (const step of exits(maze, cx, cy)) {
      const nx = cx + step.dx;
      const ny = cy + step.dy;
      const key = `${nx},${ny}`;
      if (prev.has(key)) continue;
      prev.set(key, { x: cx, y: cy, dir: step.dir });
      queue.push([nx, ny]);
    }
  }
  let cursor = target;
  let dir = null;
  while (cursor && cursor !== `${x},${y}`) {
    const link = prev.get(cursor);
    if (!link) return null;
    dir = link.dir;
    cursor = `${link.x},${link.y}`;
  }
  return dir;
}

function chooseDir(maze, player, rng) {
  const options = exits(maze, player.x, player.y);
  const back = OPPOSITE[player.botDir];
  const forward = options.filter((step) => step.dir !== back);
  if ((forward.length ? forward : options).length <= 1) {
    return (forward[0] ?? options[0])?.dir ?? null;
  }
  const correct = correctDir(maze, player.x, player.y);
  const good = options.find((step) => step.dir === correct);
  if (good && rng() < 0.75) return good.dir;
  const wrong = forward.filter((step) => step.dir !== correct);
  if (!wrong.length) return good?.dir ?? forward[0]?.dir ?? null;
  return wrong[Math.floor(rng() * wrong.length)].dir;
}

export function setBot(state, { playerId, code, enabled }) {
  const next = structuredClone(state);
  const room = next.rooms?.[code];
  if (!room) return { ok: false, error: "roomNotFound" };
  const player = room.players.find((item) => item.id === playerId);
  if (!player) return { ok: false, error: "playerNotFound" };
  player.bot = Boolean(enabled);
  player.botDir = null;
  player.botNextAt = 0;
  return { ok: true, state: next, events: [{ type: "room", code }] };
}

export function advanceBots(state, now, rng) {
  let next = state;
  const moved = [];
  for (const room of Object.values(next.rooms ?? {})) {
    if (room.phase !== "race") continue;
    for (const player of room.players) {
      if (!player.bot || player.finishTimeMs != null) continue;
      if (now < (player.botNextAt || 0)) continue;
      const options = exits(room.maze, player.x, player.y);
      const straight = player.botDir && options.length === 2 && options.some((step) => step.dir === player.botDir);
      const dir = straight ? player.botDir : chooseDir(room.maze, player, rng);
      if (!dir) continue;
      const result = movePlayer(next, { playerId: player.id, code: room.code, dir, coinVersion: null, now });
      if (!result.ok) continue;
      next = result.state;
      const landed = next.rooms[room.code].players.find((item) => item.id === player.id);
      landed.botDir = dir;
      landed.botNextAt = now + 90 + Math.floor(rng() * 370);
      moved.push(room.code);
    }
  }
  return { state: next, changed: moved.length > 0, codes: [...new Set(moved)] };
}
