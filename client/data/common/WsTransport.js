export function createWsTransport() {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const url = `${protocol}://${location.host}`;
  let socket = null;
  let online = false;
  const listeners = new Set();
  const statusListeners = new Set();
  let reconnectTimer = null;

  function emitStatus() {
    for (const listener of statusListeners) listener(online);
  }

  function connect() {
    socket = new WebSocket(url);
    socket.addEventListener("open", () => {
      online = true;
      emitStatus();
    });
    socket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      for (const listener of listeners) listener(message);
    });
    socket.addEventListener("close", () => {
      online = false;
      emitStatus();
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 800);
    });
  }

  connect();

  return {
    send(type, payload) {
      const raw = JSON.stringify({ type, payload });
      if (socket && socket.readyState === WebSocket.OPEN) socket.send(raw);
    },
    onMessage(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onStatus(listener) {
      statusListeners.add(listener);
      listener(online);
      return () => statusListeners.delete(listener);
    },
    isOnline: () => online,
  };
}
