import websocket from "@fastify/websocket";
import type { FastifyInstance } from "fastify";
import type { Rooms } from "../rooms/service";
import { session } from "../security/sessions";
import { checkOrigin } from "../security/origins";
import { attachPresence } from "./presence";
import { fault } from "../core/store";
export async function realtime(app: FastifyInstance, rooms: Rooms) {
  await app.register(websocket, {
    options: { maxPayload: 1024, perMessageDeflate: false },
  });
  app.get<{ Params: { roomId: string } }>(
    "/api/rooms/:roomId/events",
    {
      websocket: true,
      preValidation: async (req) => {
        checkOrigin(req, rooms.c, true);
        const s = session(req, rooms.store, rooms.now);
        rooms.member(req.params.roomId, s);
        if (s.sockets.size >= 4) fault(429, "RATE_LIMIT", "Too many tabs");
      },
    },
    (socket, req) => {
      const s = session(req, rooms.store, rooms.now);
      attachPresence(socket, s, rooms.member(req.params.roomId, s), rooms);
    },
  );
  app.addHook("preClose", async () => {
    for (const s of rooms.store.sessions.values())
      for (const ws of s.sockets) ws.terminate();
  });
}
