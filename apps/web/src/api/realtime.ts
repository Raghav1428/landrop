import { notificationSchema } from "@landrop/protocol";
export function subscribe(
  roomId: string,
  refresh: () => void,
  status: (online: boolean) => void,
) {
  let socket: WebSocket | undefined;
  let timer: ReturnType<typeof setTimeout>;
  let stopped = false;
  let failures = 0;
  const connect = () => {
    if (stopped) return;
    socket = new WebSocket(
      `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/rooms/${roomId}/events`,
    );
    socket.onopen = () => {
      failures = 0;
      status(true);
      refresh();
    };
    socket.onmessage = (event) => {
      const parsed = notificationSchema.safeParse(JSON.parse(event.data));
      if (parsed.success && parsed.data.roomId === roomId) refresh();
    };
    socket.onclose = () => {
      status(false);
      if (!stopped)
        timer = setTimeout(connect, Math.min(15000, 500 * 2 ** failures++));
    };
    socket.onerror = () => socket?.close();
  };
  connect();
  return () => {
    stopped = true;
    clearTimeout(timer);
    socket?.close();
  };
}
