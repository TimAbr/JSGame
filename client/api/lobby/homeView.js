export function homeHtml(offline) {
  return `
    <section class="panel">
      <h1>Labirint Race</h1>
      ${offline ? `<p class="banner">Нет соединения</p>` : ""}
      <div class="actions">
        <button type="button" data-action="go-create">Создать комнату</button>
        <button type="button" class="ghost" data-action="go-browse">Присоединиться</button>
      </div>
    </section>`;
}
