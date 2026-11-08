import { movePlayer, restartMatch, startMatch, stopMatch } from "../../domain/match/match.js";

export function createMatchApi({ repository, clock }) {
  const now = () => clock.now();
  return {
    start(meta) {
      return startMatch(repository.load(), { playerId: meta.playerId, code: meta.code, now: now() });
    },
    move(meta, payload) {
      return movePlayer(repository.load(), {
        playerId: meta.playerId,
        code: meta.code,
        dir: payload.dir,
        coinVersion: payload.coinVersion ?? null,
        seq: payload.seq,
        now: now(),
      });
    },
    stop(meta) {
      return stopMatch(repository.load(), { playerId: meta.playerId, code: meta.code, now: now() });
    },
    restart(meta) {
      return restartMatch(repository.load(), {
        playerId: meta.playerId,
        code: meta.code,
        now: now(),
        rng: Math.random,
      });
    },
  };
}
