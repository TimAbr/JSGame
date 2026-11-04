export function roomRows(items) {
  return items.map((room) => `
    <li>
      <button type="button" data-action="join-code" data-code="${room.code}">
        <strong>${room.code}</strong>
        <span>${escapeHtml(room.adminName)} · ${room.players}</span>
      </button>
    </li>`).join("");
}

export function listHtml({ query, items, loading, offline }) {
  const empty = items.length ? "" : `<p class="hint" data-empty>Комнат пока нет</p>`;
  return `
    <section class="panel">
      <p class="brand">Labirint Race</p>
      <h1>Комнаты</h1>
      ${offline ? `<p class="banner">Нет соединения</p>` : ""}
      <div class="search-row">
        <label>Код<input data-search value="${escapeHtml(query)}" maxlength="4" autocomplete="off" placeholder="Код"></label>
        <button type="button" data-action="search">Искать</button>
        <button type="button" class="ghost" data-action="reload-list">Перезагрузить</button>
      </div>
      <ul class="room-list" data-rooms>${roomRows(items)}</ul>
      ${empty}
      <p class="hint" data-loading ${loading ? "" : "hidden"}>Загрузка…</p>
      <div class="actions"><button type="button" class="ghost" data-action="go-home">Назад</button></div>
    </section>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]));
}
