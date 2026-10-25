import type { FastifyInstance } from "fastify";
import { textSchema } from "@landrop/protocol";
import type { Transfers } from "../transfers/service";
import { authorize } from "../transfers/authorization";
import { deliver } from "./service";
import { transferDto } from "../metrics/service";
import { fault } from "../core/store";
export function textRoutes(app: FastifyInstance, service: Transfers) {
  app.post<{ Params: { transferId: string } }>(
    "/api/transfers/:transferId/text",
    async (req) => {
      const { s, t } = authorize(req, service, req.params.transferId);
      deliver(service, t, s, textSchema.parse(req.body).text);
      return transferDto(t, s, service.mono);
    },
  );
  app.get<{ Params: { transferId: string } }>(
    "/api/transfers/:transferId/text",
    async (req, reply) => {
      const { s, t } = authorize(req, service, req.params.transferId);
      if (s.id !== t.recipientId)
        fault(403, "FORBIDDEN", "Receiver download only");
      if (t.kind !== "text" || t.text === undefined)
        fault(409, "CONFLICT", "Text not delivered");
      t.servedBytes += Buffer.byteLength(t.text);
      return reply
        .type("text/plain; charset=utf-8")
        .header(
          "Content-Disposition",
          'attachment; filename="landrop-message.txt"',
        )
        .send(t.text);
    },
  );
}
