import { afterEach, it, expect } from "vitest";
import { harness, roomPair, type Harness } from "../../test/helpers";
import { fileOffer, readyFile, sha } from "../../test/transfers";
let h: Harness;
afterEach(async () => {
  await h?.close();
});
it("requires all bytes, handles empty file, verifies digest and duplicate finalize", async () => {
  h = await harness();
  const { a, b, room } = await roomPair(h);
  const { base } = await fileOffer(a, b, room.id, Buffer.from("hello"));
  expect(
    (await a.req("POST", `${base}/finalize`, { sha256: sha("hello") }))
      .statusCode,
  ).toBe(409);
  const empty = await readyFile(h, a, b, room.id, Buffer.alloc(0));
  expect((await b.req("GET", `${empty.base}/status`)).json().state).toBe(
    "ready",
  );
  expect(
    (await a.req("POST", `${empty.base}/finalize`, { sha256: sha("") }))
      .statusCode,
  ).toBe(200);
});
it("fails full hash mismatch without exposing content", async () => {
  h = await harness();
  const { a, b, room } = await roomPair(h);
  const { base } = await fileOffer(a, b, room.id, Buffer.from("a"));
  await a.req("PUT", `${base}/chunks/0`, Buffer.from("a"), {
    "content-type": "application/octet-stream",
    "x-chunk-sha256": sha("a"),
  });
  expect(
    (await a.req("POST", `${base}/finalize`, { sha256: sha("wrong") }))
      .statusCode,
  ).toBe(422);
  expect((await b.req("GET", `${base}/download`)).statusCode).not.toBe(200);
});
