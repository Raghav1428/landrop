import type { FastifyInstance } from "fastify";
import type { Transfers } from "../transfers/service";
import { session } from "../security/sessions";
import { insights } from "./export";
export function metricsRoutes(app: FastifyInstance, service: Transfers) {
  for (const suffix of ["", "/export"])
    app.get<{ Params: { roomId: string } }>(
      `/api/rooms/:roomId/insights${suffix}`,
      async (req, reply) => {
        const s = session(req, service.rooms.store, service.rooms.now);
        if (suffix)
          reply.header(
            "Content-Disposition",
            'attachment; filename="landrop-insights.json"',
          );
        return insights(service, req.params.roomId, s);
      },
    );
}
