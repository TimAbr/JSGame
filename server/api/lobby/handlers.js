import { randomUUID } from "node:crypto";
import { createRoom, joinRoom, leaveRoom, setConnected } from "../../domain/lobby/lobby.js";

export function createLobbyApi({ repository, clock }) {
  return {
    create(payload) {
      const playerId = randomUUID();
      const result = createRoom(repository.load(), {
        playerId,
        listed: payload.listed,
        now: clock.now(),
        rng: Math.random,
      });
      const code = result.ok ? result.events[0].code : null;
      return { result, playerId, code };
    },
    join(payload) {
      const playerId = randomUUID();
      const code = String(payload.code ?? "").trim().toUpperCase();
      const result = joinRoom(repository.load(), {
        playerId,
        code,
        now: clock.now(),
      });
      return { result, playerId, code };
    },
    resume(payload) {
      const code = String(payload.code ?? "").trim().toUpperCase();
      const result = setConnected(repository.load(), {
        playerId: payload.playerId,
        code,
        connected: true,
        now: clock.now(),
      });
      return { result, playerId: payload.playerId, code };
    },
    leave(meta) {
      return leaveRoom(repository.load(), {
        playerId: meta.playerId,
        code: meta.code,
        now: clock.now(),
      });
    },
    disconnect(meta) {
      return setConnected(repository.load(), {
        playerId: meta.playerId,
        code: meta.code,
        connected: false,
        now: clock.now(),
      });
    },
  };
}
