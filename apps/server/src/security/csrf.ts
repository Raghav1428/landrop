import { timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { fault, type Session } from "../core/store";
export function csrf(req: FastifyRequest, s: Session) {
  const token = req.headers["x-csrf-token"];
  if (
    typeof token !== "string" ||
    !/^[a-f0-9]{64}$/.test(token) ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(s.csrfToken))
  )
    fault(403, "FORBIDDEN", "CSRF token required");
}
