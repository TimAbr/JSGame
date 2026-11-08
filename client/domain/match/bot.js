const STEPS = [
  { dir: "up", dx: 0, dy: -1 },
  { dir: "down", dx: 0, dy: 1 },
  { dir: "left", dx: -1, dy: 0 },
  { dir: "right", dx: 1, dy: 0 },
];

const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };
const MIN_DELAY_MS = 90;
const JITTER_MS = 370;
const CORRECT_TURN_CHANCE = 0.75;

function isOpen(maze, x, y) {
  return maze.cells[y]?.[x] === 1;
}

function exits(maze, x, y) {
  return STEPS.filter((step) => isOpen(maze, x + step.dx, y + step.dy));
}

function correctDir(maze, from) {
  const target = `${maze.exit.x},${maze.exit.y}`;
  const start = `${from.x},${from.y}`;
  const queue = [[from.x, from.y]];
  const prev = new Map([[start, null]]);
  while (queue.length) {
    const [cx, cy] = queue.shift();
    if (`${cx},${cy}` === target) break;
    for (const step of exits(maze, cx, cy)) {
      const key = `${cx + step.dx},${cy + step.dy}`;
      if (prev.has(key)) continue;
      prev.set(key, { x: cx, y: cy, dir: step.dir });
      queue.push([cx + step.dx, cy + step.dy]);
    }
  }
  let cursor = target;
  let dir = null;
  while (cursor !== start) {
    const link = prev.get(cursor);
    if (!link) return null;
    dir = link.dir;
    cursor = `${link.x},${link.y}`;
  }
  return dir;
}

function chooseTurn(maze, from, lastDir, rng) {
  const options = exits(maze, from.x, from.y);
  const forward = options.filter((step) => step.dir !== OPPOSITE[lastDir]);
  if ((forward.length ? forward : options).length <= 1) return (forward[0] ?? options[0])?.dir ?? null;
  const correct = correctDir(maze, from);
  const good = options.find((step) => step.dir === correct);
  if (good && rng() < CORRECT_TURN_CHANCE) return good.dir;
  const wrong = forward.filter((step) => step.dir !== correct);
  if (!wrong.length) return good?.dir ?? forward[0]?.dir ?? null;
  return wrong[Math.floor(rng() * wrong.length)].dir;
}

// Autopilot: picks the next direction like a distracted player would,
// going straight through corridors and sometimes taking a wrong turn at forks.
export function nextBotDir(maze, from, lastDir, rng = Math.random) {
  if (!maze || from?.x == null) return null;
  const options = exits(maze, from.x, from.y);
  const straight = lastDir && options.length === 2 && options.some((step) => step.dir === lastDir);
  return straight ? lastDir : chooseTurn(maze, from, lastDir, rng);
}

export function botDelayMs(rng = Math.random) {
  return MIN_DELAY_MS + Math.floor(rng() * JITTER_MS);
}
