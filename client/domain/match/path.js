export function pathLength(maze, from, to) {
  if (!maze || from?.x == null || to?.x == null) return Infinity;
  if (from.x === to.x && from.y === to.y) return 0;
  const target = `${to.x},${to.y}`;
  const queue = [[from.x, from.y, 0]];
  const seen = new Set([`${from.x},${from.y}`]);
  while (queue.length) {
    const [x, y, dist] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key) || maze.cells[ny]?.[nx] !== 1) continue;
      if (key === target) return dist + 1;
      seen.add(key);
      queue.push([nx, ny, dist + 1]);
    }
  }
  return Infinity;
}
