export function pathLength(maze, from, to) {
  if (from.x === to.x && from.y === to.y) return 0;
  const height = maze.cells.length;
  const width = maze.cells[0].length;
  const seen = Array.from({ length: height }, () => Array(width).fill(false));
  const queue = [[from.x, from.y, 0]];
  seen[from.y][from.x] = true;
  while (queue.length) {
    const [x, y, dist] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (maze.cells[ny]?.[nx] !== 1 || seen[ny]?.[nx]) continue;
      if (nx === to.x && ny === to.y) return dist + 1;
      seen[ny][nx] = true;
      queue.push([nx, ny, dist + 1]);
    }
  }
  return Infinity;
}
