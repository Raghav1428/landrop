import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "../src/app";
import { config } from "../src/config";
export async function harness(overrides: Record<string, unknown> = {}) {
  let time = 1000000;
  const root = await mkdtemp(join(tmpdir(), "landrop-test-"));
  const app = await buildApp(
    { ...config({}), storageRoot: join(root, "owned"), ...overrides },
    { now: () => time, monotonic: () => time, schedule: false },
  );
  const request = (
    method: string,
    url: string,
    payload?: any,
    headers: Record<string, string> = {},
  ) =>
    app.inject({
      method: method as any,
      url,
      payload,
      headers: {
        host: "127.0.0.1:4173",
        origin: "http://127.0.0.1:4173",
        ...(payload !== undefined
          ? { "content-type": "application/json" }
          : {}),
        ...headers,
      },
    });
  async function user(name = "Alex") {
    const res = await request("POST", "/api/session", {
      name,
      device: "computer",
    });
    const dto = res.json();
    const cookie = String(res.headers["set-cookie"]).split(";")[0];
    const headers = { cookie, "x-csrf-token": dto.csrfToken };
    return {
      dto,
      cookie,
      headers,
      req: (
        method: string,
        url: string,
        payload?: any,
        extra: Record<string, string> = {},
      ) => request(method, url, payload, { ...headers, ...extra }),
    };
  }
  return {
    app,
    request,
    user,
    advance: (ms: number) => {
      time += ms;
    },
    close: async () => {
      await app.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}
export type Harness = Awaited<ReturnType<typeof harness>>;
export type User = Awaited<ReturnType<Harness["user"]>>;
export async function roomPair(h: Harness) {
  const a = await h.user("Sender");
  const b = await h.user("Receiver");
  const room = (await a.req("POST", "/api/rooms", {})).json();
  await b.req("POST", "/api/rooms/join", { code: room.invitation.code });
  await h.app.ready();
  for (const u of [a, b])
    await h.app.injectWS(`/api/rooms/${room.id}/events`, {
      headers: {
        host: "127.0.0.1:4173",
        origin: "http://127.0.0.1:4173",
        cookie: u.cookie,
      },
    });
  return { a, b, room };
}
