import type { FastifyRequest } from "fastify";
import type { Config } from "../config";
import { fault } from "../core/store";
export function checkOrigin(
  req: FastifyRequest,
  c: Config,
  requireOrigin = false,
) {
  const host = req.headers.host;
  if (!host || !c.origins.some((s) => new URL(s).host === host))
    fault(403, "FORBIDDEN", "Unrecognized Host");
  const origin = req.headers.origin;
  if (
    origin !== undefined &&
    (!c.origins.includes(origin) || new URL(origin).host !== host)
  )
    fault(403, "FORBIDDEN", "Origin is not this deployment");
  if (requireOrigin && !origin) fault(403, "FORBIDDEN", "Origin required");
  if (req.headers["sec-fetch-site"] === "cross-site")
    fault(403, "FORBIDDEN", "Cross-site request denied");
}
