export const LINK = { connecting: "connecting", online: "online", offline: "offline" };

export function createWsTransport() {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const url = `${protocol}://${location.host}`;
  let socket = null;
  let status = LINK.connecting;
  const listeners = new Set();
  const statusListeners = new Set();
  let reconnectTimer = null;

  function emitStatus() {
    for (const listener of statusListeners) listener(status);
  }

  function connect() {
    socket = new WebSocket(url);
    socket.addEventListener("open", () => {
      status = LINK.online;
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
      status = LINK.offline;
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
      listener(status);
      return () => statusListeners.delete(listener);
    },
    status: () => status,
    isOnline: () => status === LINK.online,
  };
}
