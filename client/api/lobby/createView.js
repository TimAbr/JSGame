export function createHtml({ listed, offline }) {
  return `
    <section class="panel">
      <p class="brand">Labirint Race</p>
      <h1>Новая комната</h1>
      ${offline ? `<p class="banner">Нет соединения</p>` : ""}
      <form data-form="create">
        <label class="check"><input name="listed" type="checkbox" ${listed ? "checked" : ""}> Показывать в списке</label>
        <div class="actions">
          <button type="submit">Создать</button>
          <button type="button" class="ghost" data-action="go-home">Назад</button>
        </div>
      </form>
    </section>`;
}
