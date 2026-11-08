import { pathLength } from "./path.js";

export const STEP_MS = 160;
const DANGER_STEPS = 8;
const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export function createPrediction({ getRoom, getMe, personalMs }) {
  return {
    coinAhead(dir) {
      const room = getRoom();
      const me = getMe();
      if (!room?.maze || !room.coins || !me || me.x == null) return null;
      const delta = DIRS[dir];
      if (!delta) return null;
      return room.coins.find((coin) => coin.x === me.x + delta[0] && coin.y === me.y + delta[1]) ?? null;
    },
    coinContested(coin) {
      const room = getRoom();
      const me = getMe();
      if (!coin || !room?.maze || !me) return false;
      return room.players.some((player) => player.id !== me.id && player.x != null && pathLength(room.maze, player, coin) <= DANGER_STEPS);
    },
    unackedLimit() {
      const room = getRoom();
      const me = getMe();
      if (!me || !room?.maze) return 1;
      let nearest = Infinity;
      let contested = false;
      for (const coin of room.coins ?? []) {
        const distance = pathLength(room.maze, me, coin);
        if (distance < nearest) nearest = distance;
        if (distance <= DANGER_STEPS && this.coinContested(coin)) contested = true;
      }
      if (!contested) return 8;
      if (nearest <= 2) return 1;
      if (nearest <= DANGER_STEPS) return 3;
      return 8;
    },
    step(dir, grantBonus = true) {
      const room = getRoom();
      const me = getMe();
      const delta = DIRS[dir];
      if (!me || !delta || !room?.maze || me.x == null) return null;
      const x = me.x + delta[0];
      const y = me.y + delta[1];
      if (room.maze.cells[y]?.[x] !== 1) return null;
      me.x = x;
      me.y = y;
      const coin = room.coins?.find((item) => item.x === x && item.y === y) ?? null;
      const bonusAdd = coin && grantBonus ? (coin.kind === "gold" ? 2000 : 1000) : 0;
      if (coin) {
        if (bonusAdd) me.bonusMs = (me.bonusMs || 0) + bonusAdd;
        room.coins = room.coins.filter((item) => item.id !== coin.id);
      }
      const exit = room.maze.exit;
      let finishTimeMs = null;
      if (exit && x === exit.x && y === exit.y && me.finishTimeMs == null) {
        finishTimeMs = personalMs();
        me.finishTimeMs = finishTimeMs;
      }
      return { x, y, bonusAdd, coinId: coin?.id ?? null, finishTimeMs };
    },
    catchUp(serverMe, pending, seenFinish) {
      const room = getRoom();
      const me = getMe();
      if (!me || !serverMe) return;
      const ack = serverMe.ack ?? 0;
      while (pending.length && pending[0].seq <= ack) pending.shift();
      for (let i = 0; i < pending.length; i += 1) {
        const step = pending[i];
        if (step.coinId && !room.coins.some((coin) => coin.id === step.coinId)) {
          for (let j = i; j < pending.length; j += 1) {
            if (pending[j].finishTimeMs != null) pending[j].finishTimeMs += step.bonusAdd;
          }
          step.bonusAdd = 0;
          step.coinId = null;
        }
      }
      for (const step of pending) {
        me.x = step.x;
        me.y = step.y;
        me.bonusMs += step.bonusAdd;
        if (step.coinId) room.coins = room.coins.filter((coin) => coin.id !== step.coinId);
      }
      if (serverMe.finishTimeMs != null) {
        me.finishTimeMs = seenFinish == null ? serverMe.finishTimeMs : Math.max(seenFinish, serverMe.finishTimeMs);
      } else {
        const predicted = pending.findLast((step) => step.finishTimeMs != null);
        if (predicted) me.finishTimeMs = predicted.finishTimeMs;
      }
    },
  };
}
