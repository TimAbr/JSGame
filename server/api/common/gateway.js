import { WebSocketServer } from "ws";
import { errorText, errors } from "../../domain/common/errors.js";
import { advanceCountdowns, toPublic } from "../../domain/match/match.js";
import { listRooms } from "../../domain/lobby/lobby.js";
import { createLobbyApi } from "../lobby/handlers.js";
import { createMatchApi } from "../match/handlers.js";

const TICK_MS = 80;

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

  function persist(state) {
    repository.commit(state).catch((error) => console.error(error));
  }

  function broadcast(code, { mover, echo, rejection } = {}) {
    const room = repository.load().rooms[code];
    const pub = room ? toPublic(room, clock.now()) : null;
    for (const [ws, meta] of sockets) {
      if (meta.code !== code) continue;
      if (!pub) {
        send(ws, "left", { code });
        meta.code = null;
        continue;
      }
      const echoed = meta.playerId === mover ? echo : null;
      send(ws, "state", {
        room: pub,
        youId: meta.playerId,
        echoClientNow: echoed?.clientNow,
        echoServerRecvAt: echoed?.recvAt,
      });
      if (rejection && rejection.playerId === meta.playerId) {
        send(ws, "coinRejected", {
          coinId: rejection.coinId,
          version: rejection.version,
          coins: pub.coins ?? [],
          message: errorText[errors.coinTaken],
        });
      }
    }
  }

  function publish(result, ws, ack) {
    if (!result.ok) {
      fail(ws, result.error);
      const meta = sockets.get(ws);
      if (meta?.code) broadcast(meta.code);
      return null;
    }
    persist(result.state);
    const rejection = result.events.find((event) => event.type === "coinRejected");
    const codes = new Set(result.events.map((event) => event.code).filter(Boolean));
    for (const code of codes) {
      broadcast(code, { ...ack, rejection: rejection?.code === code ? rejection : undefined });
    }
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

  function enter(ws, handled) {
    if (!publish(handled.result, ws)) return;
    bind(ws, handled.playerId, handled.code);
    broadcast(handled.code);
  }

  const lobbyCommands = {
    ping: ({ ws, payload, recvAt }) => {
      send(ws, "pong", { clientNow: payload.clientNow, recvAt, sentAt: clock.now() });
    },
    list: ({ ws, payload }) => {
      send(ws, "list", { ...listRooms(repository.load(), payload), query: String(payload.query ?? "") });
    },
    create: ({ ws, payload }) => enter(ws, lobby.create(payload)),
    join: ({ ws, payload }) => enter(ws, lobby.join(payload)),
    resume: ({ ws, payload }) => enter(ws, lobby.resume(payload)),
  };

  const roomCommands = {
    leave: ({ ws, meta }) => {
      const code = meta.code;
      meta.code = null;
      sockets.set(ws, meta);
      if (!publish(lobby.leave({ playerId: meta.playerId, code }), ws)) return;
      send(ws, "left", { code });
    },
    move: ({ ws, meta, payload, recvAt }) => {
      const echo = { clientNow: payload.clientNow, recvAt };
      publish(match.move(meta, payload), ws, { mover: meta.playerId, echo });
    },
    start: ({ ws, meta }) => publish(match.start(meta), ws),
    stop: ({ ws, meta }) => publish(match.stop(meta), ws),
    restart: ({ ws, meta }) => publish(match.restart(meta), ws),
  };

  function onMessage(ws, raw, recvAt) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      fail(ws, errors.badPhase);
      return;
    }
    const type = message?.type;
    const meta = sockets.get(ws) ?? { playerId: null, code: null };
    const context = { ws, meta, payload: message?.payload ?? {}, recvAt };

    if (lobbyCommands[type]) {
      lobbyCommands[type](context);
      return;
    }
    if (!meta.playerId || !meta.code) {
      fail(ws, errors.playerNotFound);
      return;
    }
    if (!roomCommands[type]) {
      fail(ws, errors.badPhase);
      return;
    }
    roomCommands[type](context);
  }

  function onClose(ws) {
    const meta = sockets.get(ws);
    sockets.delete(ws);
    if (!meta?.playerId || !meta.code) return;
    const reconnected = [...sockets.values()].some((item) => item.playerId === meta.playerId);
    if (reconnected) return;
    const result = lobby.disconnect(meta);
    if (!result.ok) return;
    persist(result.state);
    broadcast(meta.code);
  }

  function tick() {
    const countdown = advanceCountdowns(repository.load(), clock.now());
    if (!countdown.changed) return;
    persist(countdown.state);
    for (const code of countdown.started) broadcast(code);
  }

  let turn = Promise.resolve();
  function enqueue(task) {
    const run = turn.then(task, task);
    turn = run.then(() => {}, () => {});
    return run.catch((error) => console.error(error));
  }

  wss.on("connection", (ws) => {
    sockets.set(ws, { playerId: null, code: null });
    ws.on("message", (data) => {
      const recvAt = clock.now();
      enqueue(() => onMessage(ws, String(data), recvAt));
    });
    ws.on("close", () => enqueue(() => onClose(ws)));
  });

  const timer = setInterval(() => enqueue(tick), TICK_MS);
  if (typeof timer.unref === "function") timer.unref();

  return wss;
}
