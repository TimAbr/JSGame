export function lobbyHtml({ room, youId, offline, autopilot }) {
  const admin = room.adminId === youId;
  const players = room.players.map((player) => {
    const tags = [
      player.id === room.adminId ? "админ" : "",
      player.id === youId ? "вы" : "",
      player.connected ? "" : "нет связи",
    ].filter(Boolean).join(" · ");
    return `<li><span class="swatch" style="background:${player.color}"></span><span>${escapeHtml(player.name)}</span><em>${tags}</em></li>`;
  }).join("");
  const bot = `<label class="check"><input type="checkbox" data-bot ${autopilot ? "checked" : ""}> Бот</label>`;
  const wait = room.players.length < 2 ? "<p class=\"hint\">Ждём второго игрока</p>" : "";
  const start = admin && room.phase === "lobby"
    ? `<button type="button" data-action="start" ${room.players.length < 2 ? "disabled" : ""}>Старт</button>`
    : "";
  return `
    <section class="panel">
      <p class="brand">Labirint Race</p>
      <div class="code-row">
        <strong class="code">${room.code}</strong>
        <button type="button" class="ghost" data-action="copy">Копировать</button>
      </div>
      ${offline ? `<p class="banner">Нет соединения</p>` : ""}
      <ul class="players">${players}</ul>
      ${wait}
      ${bot}
      <div class="actions">${start}<button type="button" class="ghost" data-action="leave">Выйти</button></div>
    </section>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]));
}
