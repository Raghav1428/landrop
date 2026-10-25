import { afterEach, it, expect } from "vitest";
import {
  harness,
  roomPair,
  type Harness,
} from "../../apps/server/test/helpers";
let h: Harness;
afterEach(async () => {
  await h?.close();
});
it("accepts the UTF-8 limit even when JSON escaping expands the wire representation", async () => {
  h = await harness();
  const { a, b, room } = await roomPair(h);
  const text = "\0".repeat(65536);
  const t = (
    await a.req("POST", `/api/rooms/${room.id}/offers`, {
      kind: "text",
      recipientId: b.dto.id,
      byteLength: 65536,
    })
  ).json();
  await b.req("POST", `/api/transfers/${t.id}/accept`, {});
  expect(
    (await a.req("POST", `/api/transfers/${t.id}/text`, { text })).statusCode,
  ).toBe(200);
  expect((await b.req("GET", `/api/transfers/${t.id}`)).json().text).toBe(text);
});
it("rejects malformed CSRF byte sequences as authorization failures, not internal errors", async () => {
  h = await harness();
  const a = await h.user();
  expect(
    (await a.req("POST", "/api/rooms", {}, { "x-csrf-token": "é".repeat(64) }))
      .statusCode,
  ).toBe(403);
});
