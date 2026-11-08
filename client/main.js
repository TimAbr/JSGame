import { createWsTransport } from "./data/common/WsTransport.js";
import { clearSession, loadPlace, loadSession, savePlace, saveSession } from "./data/common/SessionStore.js";
import { createMatchModel } from "./domain/match/model.js";
import { countdownLeft, formatTime } from "./domain/common/time.js";
import { homeHtml } from "./api/lobby/homeView.js";
import { createHtml } from "./api/lobby/createView.js";
import { listHtml, roomRows } from "./api/lobby/listView.js";
import { lobbyHtml } from "./api/lobby/lobbyView.js";
import { matchHtml, paintCountdown, paintMaze } from "./api/match/matchView.js";

const app = document.querySelector("#app");
const transport = createWsTransport();
const model = createMatchModel();

let offline = !transport.isOnline();
let toast = "";
let awaiting = false;
const pending = [];
const heldAt = new Map();
const HOLD_DELAY_MS = 220;
const HOLD_STEP_MS = 160;
let shellKey = "";
const place = loadPlace();
let screen = place.screen;
let listed = place.listed;
let kicked = false;
let catalog = { query: place.query, items: [], nextOffset: 0, loading: false };
if (loadSession() && screen !== "browse" && screen !== "create") screen = "room";
if (screen === "room" && !loadSession()) screen = "browse";

const keyDir = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  a: "left",
  s: "down",
  d: "right",
  W: "up",
  A: "left",
  S: "down",
  D: "right",
};

transport.onStatus((online) => {
  offline = !online;
  if (online && screen === "room") resume(true);
  if (online && screen === "browse") requestList(true);
  render(true);
});

transport.onMessage((message) => {
  if (message.type === "state") {
    toast = "";
    const serverMe = message.payload.room.players.find((player) => player.id === message.payload.youId);
    model.applyState(message.payload);
    const room = model.room();
    const me = model.me();
    if (me && serverMe && pending.length) {
      if (pending[0].x === serverMe.x && pending[0].y === serverMe.y) pending.shift();
      if (pending.length) {
        me.x = pending.at(-1).x;
        me.y = pending.at(-1).y;
      }
    }
    const session = loadSession();
    saveSession({
      playerId: message.payload.youId,
      code: room.code,
      name: session?.name || room.players.find((player) => player.id === message.payload.youId)?.name || "",
    });
    screen = "room";
    awaiting = false;
    render(false);
    return;
  }
  if (message.type === "list") {
    if ((message.payload.query ?? "") !== catalog.query) return;
    const { items, nextOffset } = message.payload;
    catalog.items = catalog.nextOffset ? catalog.items.concat(items) : items;
    catalog.nextOffset = nextOffset;
    catalog.loading = false;
    const list = app.querySelector("[data-rooms]");
    if (screen === "browse" && list) {
      list.innerHTML = roomRows(catalog.items);
      const loading = app.querySelector("[data-loading]");
      if (loading) loading.hidden = true;
      let empty = app.querySelector("[data-empty]");
      if (!catalog.items.length && !empty) {
        empty = document.createElement("p");
        empty.className = "hint";
        empty.dataset.empty = "";
        empty.textContent = "Комнат пока нет";
        list.after(empty);
      }
      if (catalog.items.length && empty) empty.remove();
      return;
    }
    render(true);
    return;
  }
  if (message.type === "error") {
    toast = message.payload.message;
    awaiting = false;
    pending.length = 0;
    if (!model.room() && (message.payload.code === "roomNotFound" || message.payload.code === "playerNotFound")) {
      clearSession();
      screen = "browse";
      requestList(true);
    }
    render(true);
    return;
  }
  if (message.type === "coinRejected") {
    toast = message.payload.message;
    render(true);
    return;
  }
  if (message.type === "left" || message.type === "replaced") {
    if (message.type === "replaced") {
      kicked = true;
      toast = message.payload.message;
    }
    model.clear();
    pending.length = 0;
    if (message.type === "left") clearSession();
    awaiting = false;
    screen = "home";
    render(true);
  }
});

function resume(force) {
  const session = loadSession();
  if (kicked || !session || !transport.isOnline()) return;
  if (!force && model.room()?.code === session.code && model.youId() === session.playerId) return;
  transport.send("resume", session);
}

function requestList(reset) {
  if (!transport.isOnline()) return;
  if (catalog.loading) return;
  if (!reset && catalog.nextOffset == null) return;
  catalog.loading = true;
  const offset = reset ? 0 : catalog.nextOffset;
  if (reset) catalog.nextOffset = 0;
  transport.send("list", { query: catalog.query, offset, limit: 20 });
}

function remember() {
  savePlace({
    screen: model.room() ? "room" : screen,
    query: catalog.query,
    listed,
  });
}

function render(force) {
  const room = model.room();
  const youId = model.youId();
  const phase = room?.phase ?? screen;
  const key = [
    phase,
    room?.code ?? "",
    youId ?? "",
    room?.adminId ?? "",
    room?.players?.map((player) => `${player.id}:${player.connected}:${player.bot}:${player.finishTimeMs}:${player.bonusMs}`).join("|") ?? "",
    room?.coins?.map((coin) => coin.id).join(",") ?? "",
    catalog.query,
    catalog.items.map((item) => item.code).join(","),
    catalog.loading,
    offline,
    toast,
  ].join("~");
  if (!force && key === shellKey && phase === "race") {
    paintLive();
    return;
  }
  shellKey = key;
  remember();
  if (!room) {
    const saved = loadSession();
    if (saved) {
      app.innerHTML = `<section class="panel"><p class="brand">Labirint Race</p><h1>${escapeHtml(saved.code)}</h1>${offline ? `<p class="banner">Нет соединения</p>` : `<p class="hint">Подключение</p>`}${toastHtml()}</section>`;
      return;
    }
    if (screen === "create") app.innerHTML = createHtml({ listed, offline }) + toastHtml();
    else if (screen === "browse") app.innerHTML = listHtml({ ...catalog, offline }) + toastHtml();
    else app.innerHTML = homeHtml(offline) + toastHtml();
    return;
  }
  if (phase === "lobby") app.innerHTML = lobbyHtml({ room, youId, offline }) + toastHtml();
  else app.innerHTML = matchHtml({ room, youId, offline, personal: model.personalMs() }) + toastHtml();
  paintLive();
}

function toastHtml() {
  return toast ? `<p class="toast">${escapeHtml(toast)}</p>` : "";
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

function sendStep(dir) {
  const room = model.room();
  const me = model.me();
  if (offline || !room || room.phase !== "race") return;
  if (!me || me.finishTimeMs != null || me.bot) return;
  const started = heldAt.get(dir);
  if (started && performance.now() - started >= HOLD_DELAY_MS && performance.now() < (sendStep.nextAt || 0)) return;
  const coin = model.coinAhead(dir);
  const moved = model.step(dir);
  if (!moved) return;
  pending.push({ x: moved.x, y: moved.y });
  if (started && performance.now() - started >= HOLD_DELAY_MS) sendStep.nextAt = performance.now() + HOLD_STEP_MS;
  transport.send("move", { dir, coinVersion: coin ? coin.version : null });
  paintLive();
}

app.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  if (form.dataset.form !== "create") return;
  const data = new FormData(form);
  toast = "";
  listed = data.get("listed") === "on";
  remember();
  transport.send("create", { listed });
});

app.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  toast = "";
  if (action === "go-home") {
    screen = "home";
    render(true);
    return;
  }
  if (action === "go-create") {
    screen = "create";
    render(true);
    return;
  }
  if (action === "go-browse") {
    screen = "browse";
    catalog.items = [];
    catalog.nextOffset = 0;
    catalog.loading = false;
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
    const field = app.querySelector("[data-search]");
    if (field) catalog.query = field.value;
    screen = "browse";
    catalog.loading = false;
    catalog.nextOffset = 0;
    remember();
    requestList(true);
    return;
  }
  if (action === "copy") {
    await navigator.clipboard.writeText(model.room()?.code || "");
    toast = "Код скопирован";
    render(true);
    return;
  }
  if (action === "leave") {
    transport.send("leave", {});
    model.clear();
    clearSession();
    screen = "home";
    render(true);
    return;
  }
  transport.send(action, {});
});

app.addEventListener("change", (event) => {
  const field = event.target;
  if (!(field instanceof HTMLInputElement) || !field.matches("[data-bot]")) return;
  transport.send("bot", { enabled: field.checked });
});

app.addEventListener("scroll", (event) => {
  const list = event.target;
  if (!(list instanceof HTMLElement) || !list.matches("[data-rooms]")) return;
  if (list.scrollTop + list.clientHeight < list.scrollHeight - 80) return;
  requestList(false);
}, true);

window.addEventListener("keydown", (event) => {
  const dir = keyDir[event.key];
  if (!dir) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
  event.preventDefault();
  if (event.repeat) return;
  if (heldAt.has(dir)) return;
  heldAt.set(dir, performance.now());
  if (offline) return;
  sendStep(dir);
});

window.addEventListener("keyup", (event) => {
  const dir = keyDir[event.key];
  if (!dir) return;
  heldAt.delete(dir);
});

function heldDir() {
  return [...heldAt.keys()].at(-1) ?? null;
}

function frame() {
  const room = model.room();
  if (room && (room.phase === "race" || room.phase === "countdown")) paintLive();
  const dir = heldDir();
  const since = dir ? heldAt.get(dir) : 0;
  if (dir && performance.now() - since >= HOLD_DELAY_MS) sendStep(dir);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
render(true);

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]));
}
