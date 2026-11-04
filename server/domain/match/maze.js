const DIRS = [
  [2, 0],
  [-2, 0],
  [0, 2],
  [0, -2],
];

export function generateMaze(size, rng) {
  const width = size;
  const height = size;
  const cells = Array.from({ length: height }, () => Array(width).fill(0));
  const seen = new Set(["1,1"]);
  const stack = [[1, 1]];
  cells[1][1] = 1;

  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const options = [];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx <= 0 || ny <= 0 || nx >= width - 1 || ny >= height - 1) continue;
      if (seen.has(`${nx},${ny}`)) continue;
      options.push([nx, ny, dx, dy]);
    }
    if (!options.length) {
      stack.pop();
      continue;
    }
    const [nx, ny, dx, dy] = options[Math.floor(rng() * options.length)];
    cells[y + dy / 2][x + dx / 2] = 1;
    cells[ny][nx] = 1;
    seen.add(`${nx},${ny}`);
    stack.push([nx, ny]);
  }

  return {
    width,
    height,
    cells,
    entrance: { x: 1, y: 1 },
    exit: { x: width - 2, y: height - 2 },
  };
}

export function isOpen(maze, x, y) {
  if (x < 0 || y < 0 || x >= maze.width || y >= maze.height) return false;
  return maze.cells[y][x] === 1;
}
