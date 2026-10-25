import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { LIMITS } from "@landrop/protocol";
export interface Config {
  port: number;
  host: string;
  storageRoot: string;
  origins: string[];
  addresses: string[];
  tlsKey?: string;
  tlsCert?: string;
  maxSessions: number;
  maxRooms: number;
  diskBudget: number;
  textBudget: number;
}
export function config(
  env: Record<string, string | undefined> = process.env,
): Config {
  const port = Number(env.PORT ?? 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be 1–65535");
  if (Boolean(env.TLS_KEY) !== Boolean(env.TLS_CERT))
    throw new Error("TLS_KEY and TLS_CERT must be configured together");
  const scheme = env.TLS_KEY ? "https" : "http";
  const ips = [
    "127.0.0.1",
    "localhost",
    ...Object.values(networkInterfaces()).flatMap((list) =>
      (list ?? [])
        .filter((n) => n.family === "IPv4" && !n.internal)
        .map((n) => n.address),
    ),
  ];
  const addresses = [
    ...new Set(ips.map((ip) => new URL(`${scheme}://${ip}:${port}`).origin)),
  ];
  const budget = (key: string, fallback: number, min = 0) => {
    const value = Number(env[key] ?? fallback);
    if (!Number.isSafeInteger(value) || value < min)
      throw new Error(`${key} must be a safe integer >= ${min}`);
    return value;
  };
  const extra = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .filter(Boolean)
    .map((s) => {
      const u = new URL(s);
      if (
        !["http:", "https:"].includes(u.protocol) ||
        u.username ||
        u.password ||
        u.pathname !== "/" ||
        u.search ||
        u.hash ||
        u.hostname.includes("*") ||
        u.origin !== s
      )
        throw new Error("ALLOWED_ORIGINS must contain exact origins");
      return u.origin;
    });
  return {
    port,
    host: env.HOST ?? "0.0.0.0",
    storageRoot: resolve(env.STORAGE_ROOT ?? ".landrop/storage"),
    origins: [...addresses, ...extra],
    addresses: [...addresses, ...extra],
    tlsKey: env.TLS_KEY,
    tlsCert: env.TLS_CERT,
    maxSessions: budget("MAX_SESSIONS", LIMITS.sessions, 1),
    maxRooms: budget("MAX_ROOMS", LIMITS.rooms, 1),
    diskBudget: budget("DISK_BUDGET_BYTES", LIMITS.diskBytes),
    textBudget: budget("TEXT_BUDGET_BYTES", LIMITS.textBudget),
  };
}
