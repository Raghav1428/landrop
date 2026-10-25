import type { FastifyRequest } from "fastify";
import { session } from "../security/sessions";
import type { Transfers } from "./service";
export function authorize(
  req: FastifyRequest,
  service: Transfers,
  transferId: string,
  allowRevoked = false,
) {
  const s = session(req, service.rooms.store, service.rooms.now);
  return { s, t: service.get(transferId, s, allowRevoked) };
}
