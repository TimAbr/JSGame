import { WebSocketServer } from "ws";
import { errorText, errors } from "../../domain/common/errors.js";
import { advanceCountdowns, toPublic } from "../../domain/match/match.js";
import { advanceBots, setBot } from "../../domain/match/bot.js";
import { listRooms } from "../../domain/lobby/lobby.js";
import { createLobbyApi } from "../lobby/handlers.js";
import { createMatchApi } from "../match/handlers.js";

export function createGateway({ server, repository, clock }) {
  const wss = new WebSocketServer({ server });
  const lobby = createLobbyApi({ repository, clock });
  const match = createMatchApi({ repository, clock });
  const sockets = new Map();

  function send(ws, type, payload) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type, payload }));
  }

  function fail(ws, code) {
    send(ws, "error", { code, message: errorText[code] || "Ошибка" });
  }

  function broadcast(code, extra) {
    const room = repository.load().rooms[code];
    const pub = room ? toPublic(room, clock.now()) : null;
    for (const [ws, meta] of sockets) {
      if (meta.code !== code) continue;
      if (!pub) {
        send(ws, "left", { code });
        meta.code = null;
        continue;
      }
      send(ws, "state", { room: pub, youId: meta.playerId });
      if (extra && extra.playerId === meta.playerId) {
        send(ws, "coinRejected", {
          coinId: extra.coinId,
          version: extra.version,
          coins: pub.coins ?? [],
          message: errorText[errors.coinTaken],
        });
      }
    }
  }

  async function commit(result, ws) {
    if (!result.ok) {
      fail(ws, result.error);
      const meta = sockets.get(ws);
      if (meta?.code) broadcast(meta.code);
      return null;
    }
    await repository.commit(result.state);
    const rejection = result.events.find((event) => event.type === "coinRejected");
    const codes = [...new Set(result.events.map((event) => event.code).filter(Boolean))];
    for (const code of codes) broadcast(code, rejection && rejection.code === code ? rejection : null);
    return result;
  }

  function bind(ws, playerId, code) {
    for (const [other, meta] of sockets) {
      if (other !== ws && meta.playerId === playerId) {
        send(other, "replaced", { message: "Сессия открыта в другом окне" });
        sockets.delete(other);
        other.close();
      }
    }
    sockets.set(ws, { playerId, code });
  }

  async function onMessage(ws, raw) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      fail(ws, errors.badPhase);
      return;
    }
    const type = message?.type;
    const payload = message?.payload ?? {};
    const meta = sockets.get(ws) ?? { playerId: null, code: null };

    if (type === "list") {
      send(ws, "list", { ...listRooms(repository.load(), payload), query: String(payload.query ?? "") });
      return;
    }

    if (type === "create" || type === "join" || type === "resume") {
      const handled = lobby[type](payload);
      if (!await commit(handled.result, ws)) return;
      bind(ws, handled.playerId, handled.code);
      broadcast(handled.code);
      return;
    }

    if (!meta.playerId || !meta.code) {
      fail(ws, errors.playerNotFound);
      return;
    }

    if (type === "leave") {
      const code = meta.code;
      meta.code = null;
      sockets.set(ws, meta);
      if (!await commit(lobby.leave({ playerId: meta.playerId, code }), ws)) return;
      send(ws, "left", { code });
      return;
    }

    if (type === "move") {
      const self = repository.load().rooms[meta.code]?.players.find((player) => player.id === meta.playerId);
      if (self?.bot) return;
    }
    if (type === "bot") {
      await commit(setBot(repository.load(), { playerId: meta.playerId, code: meta.code, enabled: payload.enabled }), ws);
      return;
    }

    const commands = { start: () => match.start(meta), move: () => match.move(meta, payload), stop: () => match.stop(meta), restart: () => match.restart(meta) };
    if (!commands[type]) {
      fail(ws, errors.badPhase);
      return;
    }
    await commit(commands[type](), ws);
  }

  let turn = Promise.resolve();
  function enqueue(task) {
    const run = turn.then(task, task);
    turn = run.then(() => {}, () => {});
    return run;
  }

  wss.on("connection", (ws) => {
    sockets.set(ws, { playerId: null, code: null });
    ws.on("message", (data) => {
      enqueue(() => onMessage(ws, String(data))).catch((error) => console.error(error));
    });
    ws.on("close", () => {
      enqueue(async () => {
        const meta = sockets.get(ws);
        sockets.delete(ws);
        if (!meta?.playerId || !meta.code) return;
        const still = [...sockets.values()].some((item) => item.playerId === meta.playerId);
        if (still) return;
        const result = lobby.disconnect(meta);
        if (result.ok) {
          await repository.commit(result.state);
          broadcast(meta.code);
        }
      }).catch((error) => console.error(error));
    });
  });

  const timer = setInterval(() => {
    enqueue(async () => {
      const now = clock.now();
      const bots = advanceBots(repository.load(), now, Math.random);
      const countdown = advanceCountdowns(bots.state, now);
      if (!bots.changed && !countdown.changed) return;
      await repository.commit(countdown.state);
      for (const code of new Set([...bots.codes, ...countdown.started])) broadcast(code);
    }).catch((error) => console.error(error));
  }, 80);
  if (typeof timer.unref === "function") timer.unref();

  return wss;
}
