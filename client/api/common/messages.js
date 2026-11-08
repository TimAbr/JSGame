import { LINK } from "../../data/common/WsTransport.js";
import { clearSession, loadSession, saveSession } from "../../data/common/SessionStore.js";

const PING_BURST = 5;
const PING_BURST_GAP_MS = 120;
const PING_INTERVAL_MS = 3000;

export function createMessages({ transport, model, state, screens }) {
  let pingTimer = null;

  function startPing() {
    clearTimeout(pingTimer);
    let burst = PING_BURST;
    const tick = () => {
      transport.send("ping", { clientNow: Date.now() });
      burst -= 1;
      pingTimer = setTimeout(tick, burst > 0 ? PING_BURST_GAP_MS : PING_INTERVAL_MS);
    };
    tick();
  }

  function resume(force) {
    const session = loadSession();
    if (state.kicked || !session || !transport.isOnline()) return;
    if (!force && model.room()?.code === session.code && model.youId() === session.playerId) return;
    state.pending.length = 0;
    model.dropRemotes();
    transport.send("resume", session);
  }

  function onStatus(status) {
    state.link = status;
    if (status !== LINK.online) {
      clearTimeout(pingTimer);
      state.pending.length = 0;
      model.dropRemotes();
      model.resetClock();
    }
    if (status === LINK.online) startPing();
    if (status === LINK.online && state.screen === "room") resume(true);
    if (status === LINK.online && state.screen === "browse") screens.requestList(true);
    screens.render(true);
  }

  function onMessage(message) {
    if (message.type === "state") {
      state.toast = "";
      const serverMe = message.payload.room.players.find((player) => player.id === message.payload.youId);
      const seenFinish = model.me()?.finishTimeMs ?? null;
      model.applyState(message.payload);
      state.moveSeq = Math.max(state.moveSeq, serverMe?.ack ?? 0);
      const room = model.room();
      const me = model.me();
      if (me && serverMe) model.catchUp(serverMe, state.pending, seenFinish);
      const session = loadSession();
      saveSession({
        playerId: message.payload.youId,
        code: room.code,
        name: session?.name || room.players.find((player) => player.id === message.payload.youId)?.name || "",
      });
      state.screen = "room";
      state.awaiting = false;
      screens.render(false);
      return;
    }
    if (message.type === "pong") {
      model.notePong(message.payload);
      return;
    }
    if (message.type === "list") {
      if ((message.payload.query ?? "") !== state.catalog.query) return;
      const { items, nextOffset } = message.payload;
      state.catalog.items = state.catalog.nextOffset ? state.catalog.items.concat(items) : items;
      state.catalog.nextOffset = nextOffset;
      state.catalog.loading = false;
      if (!screens.showListPage()) screens.render(true);
      return;
    }
    if (message.type === "error") {
      state.toast = message.payload.message;
      state.awaiting = false;
      state.pending.length = 0;
      if (!model.room() && (message.payload.code === "roomNotFound" || message.payload.code === "playerNotFound")) {
        clearSession();
        state.screen = "browse";
        screens.requestList(true);
      }
      screens.render(true);
      return;
    }
    if (message.type === "coinRejected") {
      state.toast = message.payload.message;
      screens.render(true);
      return;
    }
    if (message.type === "left" || message.type === "replaced") {
      if (message.type === "replaced") {
        state.kicked = true;
        state.toast = message.payload.message;
      }
      model.clear();
      state.pending.length = 0;
      if (message.type === "left") clearSession();
      state.awaiting = false;
      state.screen = "home";
      screens.render(true);
    }
  }

  return { onStatus, onMessage };
}
