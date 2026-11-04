import { colorFor } from "../common/ids.js";

export function createPlayer(id, name, index, entrance) {
  return {
    id,
    name,
    color: colorFor(index),
    x: entrance.x,
    y: entrance.y,
    bonusMs: 0,
    finishTimeMs: null,
    finishSeq: null,
    connected: true,
    bot: false,
    botDir: null,
    botNextAt: 0,
  };
}

export function playerName(index) {
  return `Игрок ${index + 1}`;
}

export function resetRun(player, entrance) {
  player.x = entrance.x;
  player.y = entrance.y;
  player.bonusMs = 0;
  player.finishTimeMs = null;
  player.finishSeq = null;
  player.botDir = null;
  player.botNextAt = 0;
}

export function toPublicPlayer(player, reveal) {
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    x: reveal ? player.x : null,
    y: reveal ? player.y : null,
    bonusMs: player.bonusMs,
    finishTimeMs: player.finishTimeMs,
    finishSeq: player.finishSeq,
    connected: player.connected,
    bot: Boolean(player.bot),
  };
}

export function byFinish(a, b) {
  if (a.finishTimeMs == null && b.finishTimeMs == null) return 0;
  if (a.finishTimeMs == null) return 1;
  if (b.finishTimeMs == null) return -1;
  if (a.finishTimeMs !== b.finishTimeMs) return a.finishTimeMs - b.finishTimeMs;
  return a.finishSeq - b.finishSeq;
}
