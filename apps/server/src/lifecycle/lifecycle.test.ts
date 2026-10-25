import { afterEach, it, expect, vi } from "vitest";
import { harness, roomPair, type Harness } from "../../test/helpers";
import { readyFile } from "../../test/transfers";
import { Disk } from "../storage/filesystem";
let h: Harness;
afterEach(async () => {
  vi.restoreAllMocks();
  await h?.close();
});
it("revokes retention without waiting for timer, excludes expired snapshot content and polling does not keep idle rooms alive", async () => {
  h = await harness();
  const { a, b, room } = await roomPair(h);
  const { base, t } = await readyFile(h, a, b, room.id);
  h.advance(1800000);
  expect((await b.req("GET", `${base}/download`)).statusCode).toBe(410);
  expect((await b.req("GET", `/api/rooms/${room.id}`)).body).not.toContain(
    t.id,
  );
  h.advance(1800000);
  expect(
    (await a.req("GET", `/api/rooms/${room.id}`)).statusCode,
  ).toBeGreaterThanOrEqual(400);
});
it("retains reservations through failed deletion and releases after successful retry", async () => {
  h = await harness({ diskBudget: 5 });
  const { a, b, room } = await roomPair(h);
  const { t } = await readyFile(h, a, b, room.id);
  const remove = vi
    .spyOn(Disk.prototype, "remove")
    .mockRejectedValue(new Error("EPERM"));
  await a.req("DELETE", `/api/transfers/${t.id}`);
  await new Promise((r) => setTimeout(r, 10));
  const next = (
    await a.req("POST", `/api/rooms/${room.id}/offers`, {
      kind: "files",
      recipientId: b.dto.id,
      files: [{ id: "f", name: "next", size: 5 }],
    })
  ).json();
  expect(
    (await b.req("POST", `/api/transfers/${next.id}/accept`, {})).statusCode,
  ).toBe(507);
  remove.mockRestore();
  h.advance(120000);
  await a.req("GET", `/api/rooms/${room.id}`);
  await new Promise((r) => setTimeout(r, 30));
  const newer = (
    await a.req("POST", `/api/rooms/${room.id}/offers`, {
      kind: "files",
      recipientId: b.dto.id,
      files: [{ id: "f", name: "newer", size: 5 }],
    })
  ).json();
  expect(
    (await b.req("POST", `/api/transfers/${newer.id}/accept`, {})).statusCode,
  ).toBe(200);
});
it("expires unfinished work after last connection grace but preserves verified nonowner sends", async () => {
  h = await harness();
  const { a, b, room } = await roomPair(h);
  const sent = await readyFile(h, b, a, room.id);
  const pending = (
    await b.req("POST", `/api/rooms/${room.id}/offers`, {
      kind: "text",
      recipientId: a.dto.id,
      byteLength: 1,
    })
  ).json();
  for (const ws of h.app.websocketServer.clients) ws.terminate();
  await new Promise((r) => setTimeout(r, 15));
  h.advance(60000);
  expect((await a.req("GET", `/api/transfers/${pending.id}`)).statusCode).toBe(
    410,
  );
  expect((await a.req("GET", `${sent.base}/download`)).statusCode).toBe(200);
});
