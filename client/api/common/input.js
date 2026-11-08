import { STEP_MS } from "../../domain/match/model.js";

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

  function sendStep(dir) {
    const room = model.room();
    const me = model.me();
    if (state.offline || !room || room.phase !== "race") return;
    if (!me || me.finishTimeMs != null || me.bot) return;
    const waitingContest = state.pending.some((step) => step.coinId && !step.bonusAdd);
    if (state.pending.length >= (waitingContest ? 1 : model.unackedLimit())) return;
    const started = heldAt.get(dir);
    if (started && performance.now() - started >= HOLD_DELAY_MS && performance.now() < (sendStep.nextAt || 0)) return;
    const coin = model.coinAhead(dir);
    const grantBonus = !coin || !model.coinContested(coin);
    const moved = model.step(dir, grantBonus);
    if (!moved) return;
    state.moveSeq += 1;
    state.pending.push({ ...moved, seq: state.moveSeq });
    transport.send("move", { dir, seq: state.moveSeq, coinVersion: coin ? coin.version : null });
    if (started && performance.now() - started >= HOLD_DELAY_MS) sendStep.nextAt = performance.now() + STEP_MS;
    screens.paintLive();
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
    const dir = heldDir();
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
      if (state.offline) return;
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
