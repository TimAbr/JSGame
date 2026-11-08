const REMOTE_STEP_MS = 80;
const REMOTE_QUEUE_LIMIT = 8;

export function createRemoteMotion() {
  const remote = new Map();
  return {
    apply(room, youId) {
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
    advance(room, now) {
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
    moving() {
      for (const track of remote.values()) if (track.queue.length) return true;
      return false;
    },
    latest(id) {
      const track = remote.get(id);
      if (!track) return null;
      return track.queue.at(-1) ?? track;
    },
    drop() {
      remote.clear();
    },
  };
}
