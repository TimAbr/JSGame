import { clearSession, loadSession, savePlace } from "../../data/common/SessionStore.js";
import { countdownLeft, formatTime } from "../../domain/common/time.js";
import { homeHtml } from "../lobby/homeView.js";
import { createHtml } from "../lobby/createView.js";
import { listHtml, roomRows } from "../lobby/listView.js";
import { lobbyHtml } from "../lobby/lobbyView.js";
import { matchHtml, paintCountdown, paintMaze } from "../match/matchView.js";

export function createScreens({ app, transport, model, state }) {
  function remember() {
    savePlace({
      screen: model.room() ? "room" : state.screen,
      query: state.catalog.query,
      listed: state.listed,
    });
  }

  function toastHtml() {
    return state.toast ? `<p class="toast">${escapeHtml(state.toast)}</p>` : "";
  }

  function paintLive() {
    const room = model.room();
    if (!room) return;
    const timer = app.querySelector("[data-timer]");
    if (timer && room.phase === "race") timer.textContent = formatTime(model.personalMs());
    if (room.phase === "countdown") {
      const node = app.querySelector("[data-count]");
      const left = countdownLeft(room.countdownEndsAt, model.offset());
      if (node) node.textContent = String(Math.max(1, Math.ceil(left / 1000)));
    }
    paintMaze(app.querySelector("[data-maze]"), room, model.youId());
    paintCountdown(app.querySelector("[data-count]"), room.countdownEndsAt, model.offset());
  }

  function requestList(reset) {
    if (!transport.isOnline()) return;
    if (state.catalog.loading) return;
    if (!reset && state.catalog.nextOffset == null) return;
    state.catalog.loading = true;
    const offset = reset ? 0 : state.catalog.nextOffset;
    if (reset) state.catalog.nextOffset = 0;
    transport.send("list", { query: state.catalog.query, offset, limit: 20 });
  }

  function render(force) {
    const room = model.room();
    const youId = model.youId();
    const phase = room?.phase ?? state.screen;
    const key = [
      phase,
      room?.code ?? "",
      youId ?? "",
      room?.adminId ?? "",
      room?.players?.map((player) => `${player.id}:${player.connected}:${player.bot}:${player.finishTimeMs}:${player.bonusMs}`).join("|") ?? "",
      room?.coins?.map((coin) => coin.id).join(",") ?? "",
      state.catalog.query,
      state.catalog.items.map((item) => item.code).join(","),
      state.catalog.loading,
      state.offline,
      state.toast,
    ].join("~");
    if (!force && key === state.shellKey && phase === "race") {
      paintLive();
      return;
    }
    state.shellKey = key;
    remember();
    if (!room) {
      const saved = loadSession();
      if (saved) {
        app.innerHTML = `<section class="panel"><p class="brand">Labirint Race</p><h1>${escapeHtml(saved.code)}</h1>${state.offline ? `<p class="banner">Нет соединения</p>` : `<p class="hint">Подключение</p>`}${toastHtml()}</section>`;
        return;
      }
      if (state.screen === "create") app.innerHTML = createHtml({ listed: state.listed, offline: state.offline }) + toastHtml();
      else if (state.screen === "browse") app.innerHTML = listHtml({ ...state.catalog, offline: state.offline }) + toastHtml();
      else app.innerHTML = homeHtml(state.offline) + toastHtml();
      return;
    }
    if (phase === "lobby") app.innerHTML = lobbyHtml({ room, youId, offline: state.offline }) + toastHtml();
    else app.innerHTML = matchHtml({ room, youId, offline: state.offline, personal: model.personalMs() }) + toastHtml();
    paintLive();
  }

  function showListPage() {
    const list = app.querySelector("[data-rooms]");
    if (state.screen === "browse" && list) {
      list.innerHTML = roomRows(state.catalog.items);
      const loading = app.querySelector("[data-loading]");
      if (loading) loading.hidden = true;
      let empty = app.querySelector("[data-empty]");
      if (!state.catalog.items.length && !empty) {
        empty = document.createElement("p");
        empty.className = "hint";
        empty.dataset.empty = "";
        empty.textContent = "Комнат пока нет";
        list.after(empty);
      }
      if (state.catalog.items.length && empty) empty.remove();
      return true;
    }
    return false;
  }

  function bind(appNode) {
    appNode.addEventListener("submit", (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.dataset.form !== "create") return;
      event.preventDefault();
      const data = new FormData(form);
      state.toast = "";
      state.listed = data.get("listed") === "on";
      remember();
      transport.send("create", { listed: state.listed });
    });

    appNode.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const action = button.dataset.action;
      state.toast = "";
      if (action === "go-home") {
        state.screen = "home";
        render(true);
        return;
      }
      if (action === "go-create") {
        state.screen = "create";
        render(true);
        return;
      }
      if (action === "go-browse") {
        state.screen = "browse";
        state.catalog.items = [];
        state.catalog.nextOffset = 0;
        state.catalog.loading = false;
        render(true);
        requestList(true);
        return;
      }
      if (action === "join-code") {
        transport.send("join", { code: button.dataset.code });
        return;
      }
      if (action === "search" || action === "reload-list") {
        event.preventDefault();
        const field = appNode.querySelector("[data-search]");
        if (field) state.catalog.query = field.value;
        state.screen = "browse";
        state.catalog.loading = false;
        state.catalog.nextOffset = 0;
        remember();
        requestList(true);
        return;
      }
      if (action === "copy") {
        await navigator.clipboard.writeText(model.room()?.code || "");
        state.toast = "Код скопирован";
        render(true);
        return;
      }
      if (action === "leave") {
        transport.send("leave", {});
        model.clear();
        clearSession();
        state.screen = "home";
        render(true);
        return;
      }
      transport.send(action, {});
    });

    appNode.addEventListener("change", (event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement) || !field.matches("[data-bot]")) return;
      transport.send("bot", { enabled: field.checked });
    });

    appNode.addEventListener("scroll", (event) => {
      const list = event.target;
      if (!(list instanceof HTMLElement) || !list.matches("[data-rooms]")) return;
      if (list.scrollTop + list.clientHeight < list.scrollHeight - 80) return;
      requestList(false);
    }, true);
  }

  return { render, paintLive, requestList, showListPage, bind };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]));
}
