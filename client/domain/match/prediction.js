import { pathLength } from "./path.js";

export const STEP_MS = 160;
const OPPONENT_STEP_MS = 90;
const DANGER_STEPS = 8;
const BONUS_MS = { gold: 2000, silver: 1000 };
const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export function createPrediction({ getRoom, getMe, personalMs, oneWay, latestOf }) {
  function blindSteps() {
    if (oneWay() <= 0) return DANGER_STEPS;
    return Math.ceil((oneWay() * 2) / OPPONENT_STEP_MS) + 1;
  }

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
      if (!coin || !room?.maze || !me) return true;
      const hidden = blindSteps();
      return room.players.some((player) => {
        if (player.id === me.id || player.x == null) return false;
        const at = latestOf(player.id) ?? player;
        return pathLength(room.maze, at, coin) <= hidden;
      });
    },
    unackedLimit() {
      return 8;
    },
    step(dir, grantBonus = false) {
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
      const bonusAdd = coin && grantBonus ? BONUS_MS[coin.kind] ?? 0 : 0;
      if (bonusAdd) me.bonusMs = (me.bonusMs || 0) + bonusAdd;
      if (coin) room.coins = room.coins.filter((item) => item.id !== coin.id);
      const exit = room.maze.exit;
      let finishTimeMs = null;
      if (exit && x === exit.x && y === exit.y && me.finishTimeMs == null) {
        finishTimeMs = personalMs() + oneWay();
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
        const lag = oneWay() * 2;
        const server = serverMe.finishTimeMs;
        const lagOnly = seenFinish != null && server > seenFinish && server <= seenFinish + lag;
        me.finishTimeMs = lagOnly ? seenFinish : server;
      } else {
        const predicted = pending.findLast((step) => step.finishTimeMs != null);
        if (predicted) me.finishTimeMs = predicted.finishTimeMs;
      }
    },
  };
}
