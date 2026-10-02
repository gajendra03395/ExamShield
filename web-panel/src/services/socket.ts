type SocketHandler = (payload?: any) => void;

/** Minimal Socket.IO v4 client over Engine.IO's native WebSocket transport. */
export function connectSocket(token: string) {
  const handlers = new Map<string, Set<SocketHandler>>();
  const queuedEvents: Array<[string, unknown]> = [];
  let socket: WebSocket | null = null;
  let connected = false;
  let closed = false;
  let reconnectTimer: number | undefined;

  const dispatch = (event: string, payload?: unknown) => handlers.get(event)?.forEach((handler) => handler(payload));
  const sendEvent = (event: string, payload?: unknown) => {
    const packet = `42${JSON.stringify(payload === undefined ? [event] : [event, payload])}`;
    if (connected && socket?.readyState === WebSocket.OPEN) socket.send(packet);
    else queuedEvents.push([event, payload]);
  };

  const open = () => {
    if (closed) return;
    const socketProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const localSocket = `${socketProtocol}//127.0.0.1:5000/socket.io/?EIO=4&transport=websocket`;
    const productionSocket = "wss://examshield-d1l1.onrender.com/socket.io/?EIO=4&transport=websocket";
    const socketUrl = import.meta.env.VITE_SOCKET_URL || (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? localSocket : productionSocket);
    socket = new WebSocket(socketUrl);
    socket.onmessage = ({ data }) => {
      if (typeof data !== "string") return;
      if (data.startsWith("0")) {
        socket?.send(`40${JSON.stringify({ token })}`);
      } else if (data.startsWith("40")) {
        connected = true;
        dispatch("connect");
        while (queuedEvents.length) {
          const [event, payload] = queuedEvents.shift()!;
          sendEvent(event, payload);
        }
      } else if (data === "2") {
        socket?.send("3");
      } else if (data.startsWith("42")) {
        try {
          const [event, payload] = JSON.parse(data.slice(2));
          dispatch(event, payload);
        } catch {
          // Ignore malformed packets and keep the socket available.
        }
      } else if (data.startsWith("44")) {
        dispatch("connect_error", data.slice(2));
      }
    };
    socket.onclose = () => {
      connected = false;
      if (!closed) reconnectTimer = window.setTimeout(open, 1500);
    };
    socket.onerror = () => socket?.close();
  };

  open();
  return {
    on(event: string, handler: SocketHandler) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
      return () => handlers.get(event)?.delete(handler);
    },
    emit: sendEvent,
    close() {
      closed = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      socket?.close();
      handlers.clear();
    },
  };
}
