import { afterEach, it, expect } from "vitest";
import { harness, roomPair, type Harness } from "../../test/helpers";
let h: Harness;
afterEach(async () => {
  await h?.close();
});
it("authenticates sockets, aggregates tabs and sends invalidation only", async () => {
  h = await harness();
  const { a, b, room } = await roomPair(h);
  await h.app.ready();
  const context = {
    headers: {
      host: "127.0.0.1:4173",
      origin: "http://127.0.0.1:4173",
      cookie: a.cookie,
    },
  };
  const one = await h.app.injectWS(`/api/rooms/${room.id}/events`, context);
  const two = await h.app.injectWS(`/api/rooms/${room.id}/events`, context);
  let snapshot = (await b.req("GET", `/api/rooms/${room.id}`)).json();
  expect(snapshot.members.find((m: any) => m.id === a.dto.id).online).toBe(
    true,
  );
  one.close();
  await new Promise((r) => setTimeout(r, 15));
  snapshot = (await b.req("GET", `/api/rooms/${room.id}`)).json();
  expect(snapshot.members.find((m: any) => m.id === a.dto.id).online).toBe(
    true,
  );
  const msg = new Promise<any>((resolve) =>
    two.once("message", (data) => resolve(JSON.parse(data.toString()))),
  );
  await a.req("POST", `/api/rooms/${room.id}/lock`, { locked: true });
  expect(Object.keys(await msg).sort()).toEqual(["revision", "roomId"]);
  two.close();
  await expect(
    h.app.injectWS(`/api/rooms/${room.id}/events`, {
      headers: {
        host: "127.0.0.1:4173",
        origin: "http://evil.test",
        cookie: b.cookie,
      },
    }),
  ).rejects.toThrow();
});
