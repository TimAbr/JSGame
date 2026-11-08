const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export const STEP_MS = 160;
const REMOTE_STEP_MS = 80;
const REMOTE_QUEUE_LIMIT = 8;
const DANGER_STEPS = 8;

function pathLength(maze, from, to) {
  if (!maze || from?.x == null || to?.x == null) return Infinity;
  if (from.x === to.x && from.y === to.y) return 0;
  const target = `${to.x},${to.y}`;
  const queue = [[from.x, from.y, 0]];
  const seen = new Set([`${from.x},${from.y}`]);
  while (queue.length) {
    const [x, y, dist] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key) || maze.cells[ny]?.[nx] !== 1) continue;
      if (key === target) return dist + 1;
      seen.add(key);
      queue.push([nx, ny, dist + 1]);
    }
  }
  return Infinity;
}

export function createMatchModel() {
  let room = null;
  let youId = null;
  let offset = 0;
  const clockSamples = [];
  const remote = new Map();

  function noteClock(serverNow, reset) {
    if (reset) clockSamples.length = 0;
    clockSamples.push(serverNow - Date.now());
    if (clockSamples.length > 8) clockSamples.shift();
    offset = Math.max(...clockSamples);
  }

  return {
    applyState(payload, resetClock = false) {
      room = payload.room;
      youId = payload.youId;
      if (room?.serverNow) noteClock(room.serverNow, resetClock);
      for (const player of room.players) {
        if (player.id === youId || player.x == null) continue;
        let track = remote.get(player.id);
        if (!track) {
          track = { x: player.x, y: player.y, queue: [], nextAt: 0 };
          remote.set(player.id, track);
          continue;
        }
        const tail = track.queue.at(-1) ?? track;
        const adjacent = Math.abs(tail.x - player.x) + Math.abs(tail.y - player.y) === 1;
        if (adjacent) track.queue.push({ x: player.x, y: player.y });
        else {
          track.queue = [];
          track.x = player.x;
          track.y = player.y;
        }
        while (track.queue.length > REMOTE_QUEUE_LIMIT) {
          const dropped = track.queue.shift();
          track.x = dropped.x;
          track.y = dropped.y;
        }
        player.x = track.x;
        player.y = track.y;
      }
    },
    dropRemotes() {
      remote.clear();
    },
    advanceRemotes(now) {
      if (!room) return;
      for (const player of room.players) {
        const track = remote.get(player.id);
        if (!track?.queue.length || now < track.nextAt) continue;
        const next = track.queue.shift();
        track.x = next.x;
        track.y = next.y;
        track.nextAt = now + REMOTE_STEP_MS;
        player.x = track.x;
        player.y = track.y;
      }
    },
    clear() {
      room = null;
      youId = null;
      remote.clear();
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
    coinContested(coin) {
      const me = this.me();
      if (!coin || !room?.maze || !me) return false;
      return room.players.some((player) => player.id !== me.id && player.x != null && pathLength(room.maze, player, coin) <= DANGER_STEPS);
    },
    unackedLimit() {
      const me = this.me();
      if (!me || !room?.maze) return 1;
      let nearest = Infinity;
      let contested = false;
      for (const coin of room.coins ?? []) {
        const distance = pathLength(room.maze, me, coin);
        if (distance < nearest) nearest = distance;
        if (this.coinContested(coin) && distance <= DANGER_STEPS) contested = true;
      }
      if (contested || nearest <= 2) return 1;
      if (nearest <= DANGER_STEPS) return 3;
      return 8;
    },
    step(dir, grantBonus = true) {
      const me = this.me();
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
        finishTimeMs = this.personalMs();
        me.finishTimeMs = finishTimeMs;
      }
      return { x, y, bonusAdd, coinId: coin?.id ?? null, finishTimeMs };
    },
    catchUp(serverMe, pending, seenFinish) {
      const me = this.me();
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
