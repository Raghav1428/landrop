import { it, expect } from "vitest";
import { request, type IncomingMessage } from "node:http";
import { harness, roomPair } from "../../apps/server/test/helpers";
import { readyFile } from "../../apps/server/test/transfers";
it("aborts an active native download on deletion rather than serving the remaining file", async () => {
  const h = await harness();
  try {
    const { a, b, room } = await roomPair(h);
    const size = 16777216;
    const { base, t } = await readyFile(
      h,
      a,
      b,
      room.id,
      Buffer.alloc(size, 23),
    );
    await h.app.listen({ host: "127.0.0.1", port: 0 });
    const address = h.app.server.address() as { port: number };
    const res = await new Promise<IncomingMessage>((resolve, reject) => {
      const req = request(
        `http://127.0.0.1:${address.port}${base}/download`,
        { headers: { host: "127.0.0.1:4173", cookie: b.cookie } },
        resolve,
      );
      req.on("error", reject);
      req.end();
    });
    expect(res.statusCode).toBe(200);
    const aborted = new Promise<void>((resolve) =>
      res.once("aborted", resolve),
    );
    const first = new Promise<void>((resolve) =>
      res.once("data", () => {
        res.pause();
        resolve();
      }),
    );
    res.on("error", () => {});
    await first;
    await a.req("DELETE", `/api/transfers/${t.id}`);
    res.resume();
    await aborted;
    const detail = (await a.req("GET", `/api/rooms/${room.id}`)).json();
    expect(detail.transfers).toHaveLength(0);
    expect((await b.req("GET", `${base}/download`)).statusCode).toBe(410);
  } finally {
    await h.close();
  }
}, 15000);
