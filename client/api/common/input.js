import { LINK } from "../../data/common/WsTransport.js";
import { STEP_MS } from "../../domain/match/model.js";
import { botDelayMs, nextBotDir } from "../../domain/match/bot.js";

const HOLD_DELAY_MS = 220;
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

export function createInput({ transport, model, state, screens }) {
  const heldAt = new Map();
  let botDir = null;
  let botNextAt = 0;

  function sendStep(dir) {
    const room = model.room();
    const me = model.me();
    if (state.link !== LINK.online || !room || room.phase !== "race") return false;
    if (!me || me.finishTimeMs != null) return false;
    if (state.pending.length >= model.unackedLimit()) return false;
    const started = heldAt.get(dir);
    if (started && performance.now() - started >= HOLD_DELAY_MS && performance.now() < (sendStep.nextAt || 0)) return false;
    const coin = model.coinAhead(dir);
    const grantBonus = !coin || !model.coinContested(coin);
    const moved = model.step(dir, grantBonus);
    if (!moved) return false;
    state.moveSeq += 1;
    state.pending.push({ ...moved, seq: state.moveSeq });
    transport.send("move", { dir, seq: state.moveSeq, coinVersion: coin ? coin.version : null, clientNow: Date.now() });
    if (started && performance.now() - started >= HOLD_DELAY_MS) sendStep.nextAt = performance.now() + STEP_MS;
    screens.paintLive();
    return true;
  }

  function autopilot(now) {
    const room = model.room();
    const me = model.me();
    if (!state.autopilot || room?.phase !== "race" || !me || me.finishTimeMs != null) {
      botDir = null;
      return;
    }
    if (now < botNextAt) return;
    const dir = nextBotDir(room.maze, me, botDir);
    if (dir && sendStep(dir)) {
      botDir = dir;
      botNextAt = now + botDelayMs();
    }
  }

  function heldDir() {
    return [...heldAt.keys()].at(-1) ?? null;
  }

  function frame() {
    const room = model.room();
    if (room && (room.phase === "race" || room.phase === "countdown")) {
      model.advanceRemotes(performance.now());
      screens.paintLive();
    }
    autopilot(performance.now());
    const dir = state.autopilot ? null : heldDir();
    const since = dir ? heldAt.get(dir) : 0;
    if (dir && performance.now() - since >= HOLD_DELAY_MS) sendStep(dir);
    requestAnimationFrame(frame);
  }

  function bind() {
    window.addEventListener("keydown", (event) => {
      const dir = keyDir[event.key];
      if (!dir) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      if (event.repeat || heldAt.has(dir)) return;
      heldAt.set(dir, performance.now());
      if (state.link !== LINK.online || state.autopilot) return;
      sendStep(dir);
    });
    window.addEventListener("keyup", (event) => {
      const dir = keyDir[event.key];
      if (dir) heldAt.delete(dir);
    });
    requestAnimationFrame(frame);
  }

  return { bind };
}
