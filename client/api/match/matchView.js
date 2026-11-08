import { formatTime } from "../../domain/common/time.js";

export function matchHtml({ room, youId, offline, autopilot, personal }) {
  const me = room.players.find((player) => player.id === youId);
  const admin = room.adminId === youId;
  const rows = room.players.map((player, index) => {
    const time = player.finishTimeMs == null ? "—" : formatTime(player.finishTimeMs);
    const bonus = player.bonusMs ? `−${(player.bonusMs / 1000).toFixed(0)} с` : "";
    return `<li><span>${index + 1}</span><i style="background:${player.color}"></i><b>${escapeHtml(player.name)}</b><em>${bonus}</em><strong>${time}</strong></li>`;
  }).join("");
  const racing = room.phase === "race";
  const showMap = room.phase === "race" || room.phase === "finished";
  const actions = [];
  if (admin && racing) actions.push(`<button type="button" class="ghost" data-action="stop">Стоп</button>`);
  if (admin && room.phase === "finished") actions.push(`<button type="button" data-action="restart">Ещё раз</button>`);
  actions.push(`<button type="button" class="ghost" data-action="leave">Выйти</button>`);
  const status = me?.finishTimeMs != null
    ? `Финиш ${formatTime(me.finishTimeMs)}`
    : room.phase === "finished"
      ? "Остановлено"
      : "К выходу";
  return `
    <section class="stage">
      <header class="hud">
        <div>
          <p class="brand">${room.code}</p>
          <p class="timer" data-timer>${formatTime(personal)}</p>
          <p class="status">${status}</p>
          <label class="check"><input type="checkbox" data-bot ${autopilot ? "checked" : ""}> Бот</label>
        </div>
        <div class="actions">${actions.join("")}</div>
      </header>
      ${offline ? `<p class="banner">Нет соединения</p>` : ""}
      ${room.phase === "countdown" ? `<div class="countdown" data-count>5</div>` : ""}
      ${showMap ? `<canvas data-maze width="640" height="640"></canvas>` : `<p class="hint center">Карта откроется на старте</p>`}
      <ol class="board">${rows}</ol>
    </section>`;
}

export function paintMaze(canvas, room, youId) {
  if (!canvas || !room?.maze) return;
  const maze = room.maze;
  const css = canvas.clientWidth || 640;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(css * dpr);
  canvas.height = Math.floor(css * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cell = css / maze.width;
  ctx.fillStyle = "#07111f";
  ctx.fillRect(0, 0, css, css);
  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      if (!maze.cells[y][x]) continue;
      const exit = x === maze.exit.x && y === maze.exit.y;
      ctx.fillStyle = exit ? "#3b82f6" : "#d6e6fa";
      ctx.fillRect(x * cell, y * cell, cell + 0.8, cell + 0.8);
    }
  }
  for (const coin of room.coins ?? []) {
    ctx.beginPath();
    ctx.fillStyle = coin.kind === "gold" ? "#e2b340" : "#b8c0c8";
    ctx.arc((coin.x + 0.5) * cell, (coin.y + 0.5) * cell, cell * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  const others = room.players.filter((player) => player.x != null && player.id !== youId);
  const me = room.players.find((player) => player.id === youId && player.x != null);
  for (const player of [...others, ...(me ? [me] : [])]) {
    ctx.beginPath();
    ctx.fillStyle = player.color;
    ctx.arc((player.x + 0.5) * cell, (player.y + 0.5) * cell, cell * 0.32, 0, Math.PI * 2);
    ctx.fill();
    if (player.id === youId) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#f4f8ff";
      ctx.stroke();
    }
  }
}

export function paintCountdown(node, endsAt, offset) {
  if (!node || endsAt == null) return;
  const left = Math.ceil(Math.max(0, endsAt - (Date.now() + offset)) / 1000);
  node.textContent = left > 0 ? String(left) : "0";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]));
}
