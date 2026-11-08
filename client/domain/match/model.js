const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export function createMatchModel() {
  let room = null;
  let youId = null;
  let offset = 0;

  return {
    applyState(payload) {
      room = payload.room;
      youId = payload.youId;
      if (room?.serverNow) offset = room.serverNow - Date.now();
    },
    clear() {
      room = null;
      youId = null;
    },
    room: () => room,
    youId: () => youId,
    offset: () => offset,
    me() {
      return room?.players?.find((player) => player.id === youId) ?? null;
    },
    personalMs() {
      const me = this.me();
      if (!room?.startedAt || !me) return 0;
      if (me.finishTimeMs != null) return me.finishTimeMs;
      return Math.max(0, Date.now() + offset - room.startedAt - (me.bonusMs || 0));
    },
    coinAhead(dir) {
      if (!room?.maze || !room.coins) return null;
      const me = this.me();
      if (!me || me.x == null) return null;
      const delta = DIRS[dir];
      if (!delta) return null;
      const x = me.x + delta[0];
      const y = me.y + delta[1];
      return room.coins.find((coin) => coin.x === x && coin.y === y) ?? null;
    },
    step(dir) {
      const me = this.me();
      const delta = DIRS[dir];
      if (!me || !delta || !room?.maze || me.x == null) return null;
      const x = me.x + delta[0];
      const y = me.y + delta[1];
      if (room.maze.cells[y]?.[x] !== 1) return null;
      me.x = x;
      me.y = y;
      const coin = room.coins?.find((item) => item.x === x && item.y === y) ?? null;
      if (coin) room.coins = room.coins.filter((item) => item !== coin);
      return { x, y, coin };
    },
  };
}
