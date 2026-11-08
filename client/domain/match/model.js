import { createClockSync } from "./clock.js";
import { createPrediction, STEP_MS } from "./prediction.js";
import { createRemoteMotion } from "./remotes.js";

export { STEP_MS };

export function createMatchModel() {
  let room = null;
  let youId = null;
  const clock = createClockSync();
  const remotes = createRemoteMotion();
  const api = {
    room: () => room,
    youId: () => youId,
    offset: () => clock.offset(),
    me() {
      return room?.players?.find((player) => player.id === youId) ?? null;
    },
    personalMs() {
      const me = this.me();
      if (!room?.startedAt || !me) return 0;
      if (me.finishTimeMs != null) return me.finishTimeMs;
      return Math.max(0, Date.now() + clock.offset() - room.startedAt - (me.bonusMs || 0));
    },
  };
  const prediction = createPrediction({
    getRoom: () => room,
    getMe: () => api.me(),
    personalMs: () => api.personalMs(),
  });
  return {
    ...api,
    ...prediction,
    applyState(payload, resetClock = false) {
      room = payload.room;
      youId = payload.youId;
      if (room?.serverNow) clock.note(room.serverNow, resetClock);
      remotes.apply(room, youId);
    },
    dropRemotes() {
      remotes.drop();
    },
    advanceRemotes(now) {
      remotes.advance(room, now);
    },
    clear() {
      room = null;
      youId = null;
      remotes.drop();
    },
  };
}
