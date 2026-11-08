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
    oneWay: () => clock.oneWay(),
    latestOf: (id) => remotes.latest(id),
  });
  return {
    ...api,
    ...prediction,
    applyState(payload) {
      room = payload.room;
      youId = payload.youId;
      if (payload.echoClientNow != null && payload.echoServerRecvAt != null && room?.serverNow) {
        clock.noteEcho(room.serverNow, payload.echoClientNow, payload.echoServerRecvAt);
      } else if (room?.serverNow) clock.note(room.serverNow);
      remotes.apply(room, youId);
    },
    notePong({ clientNow, recvAt, sentAt }) {
      clock.noteEcho(sentAt, clientNow, recvAt);
    },
    resetClock() {
      clock.reset();
    },
    dropRemotes() {
      remotes.drop();
    },
    remotesMoving() {
      return remotes.moving();
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
