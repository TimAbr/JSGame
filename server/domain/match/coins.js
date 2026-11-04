import { generateMaze } from "./maze.js";

export const COIN_BONUS_MS = { gold: 2000, silver: 1000 };

export function placeCoins(maze, rng) {
  const open = [];
  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      if (maze.cells[y][x] !== 1) continue;
      if (x === maze.entrance.x && y === maze.entrance.y) continue;
      if (x === maze.exit.x && y === maze.exit.y) continue;
      open.push({ x, y });
    }
  }
  for (let i = open.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = open[i];
    open[i] = open[j];
    open[j] = swap;
  }
  const count = Math.max(8, Math.floor(open.length * 0.08));
  return open.slice(0, count).map((cell, index) => ({
    id: `c${index}-${cell.x}-${cell.y}`,
    x: cell.x,
    y: cell.y,
    kind: rng() < 0.34 ? "gold" : "silver",
    version: 1,
    takenBy: null,
  }));
}

export function freshCourse(rng, size = 21) {
  const maze = generateMaze(size, rng);
  return { maze, coins: placeCoins(maze, rng) };
}
