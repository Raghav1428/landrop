import { afterEach, it, expect, vi } from "vitest";
import {
  harness,
  roomPair,
  type Harness,
} from "../../apps/server/test/helpers";
import { readyFile, fileOffer, sha } from "../../apps/server/test/transfers";
import { Disk } from "../../apps/server/src/storage/filesystem";
let h: Harness;
afterEach(async () => {
  vi.restoreAllMocks();
  await h?.close();
});
it("bounds each ready file retention even while its sibling upload stays active", async () => {
  h = await harness();
  const { a, b, room } = await roomPair(h);
  const t = (
    await a.req("POST", `/api/rooms/${room.id}/offers`, {
      kind: "files",
      recipientId: b.dto.id,
      files: [
        { id: "one", name: "one", size: 0 },
        { id: "two", name: "two", size: 4194305 },
      ],
    })
  ).json();
  await b.req("POST", `/api/transfers/${t.id}/accept`, {});
  await a.req("POST", `/api/transfers/${t.id}/files/one/finalize`, {
    sha256: sha(""),
  });
  for (let i = 0; i < 4; i++) {
    h.advance(450000);
    const chunk = Buffer.alloc(1048576, 1);
    await a.req("PUT", `/api/transfers/${t.id}/files/two/chunks/${i}`, chunk, {
      "content-type": "application/octet-stream",
      "x-chunk-sha256": sha(chunk),
    });
  }
  expect(
    (await b.req("GET", `/api/transfers/${t.id}/files/one/download`))
      .statusCode,
  ).toBe(410);
});
it("serializes finalize/delete and keeps revocation authoritative", async () => {
  h = await harness();
  const { a, b, room } = await roomPair(h);
  const { t, base } = await fileOffer(a, b, room.id, Buffer.from("x"));
  await a.req("PUT", `${base}/chunks/0`, Buffer.from("x"), {
    "content-type": "application/octet-stream",
    "x-chunk-sha256": sha("x"),
  });
  const results = await Promise.all([
    a.req("POST", `${base}/finalize`, { sha256: sha("x") }),
    a.req("DELETE", `/api/transfers/${t.id}`),
  ]);
  expect([200, 410]).toContain(results[0].statusCode);
  expect(results[1].statusCode).toBe(200);
  expect((await b.req("GET", `${base}/download`)).statusCode).toBe(410);
});
it("reserves competing accepts atomically and frees capacity only after file removal", async () => {
  h = await harness({ diskBudget: 5 });
  const { a, b, room } = await roomPair(h);
  const make = async () =>
    (
      await a.req("POST", `/api/rooms/${room.id}/offers`, {
        kind: "files",
        recipientId: b.dto.id,
        files: [{ id: "f", name: "a", size: 5 }],
      })
    ).json();
  const [one, two] = await Promise.all([make(), make()]);
  const r = await Promise.all(
    [one, two].map((t) => b.req("POST", `/api/transfers/${t.id}/accept`, {})),
  );
  expect(r.map((x) => x.statusCode).sort()).toEqual([200, 507]);
});
it("revokes a disk write failure and releases reservation only after cleanup", async () => {
  h = await harness({ diskBudget: 1 });
  const { a, b, room } = await roomPair(h);
  const { base } = await fileOffer(a, b, room.id, Buffer.from("x"));
  vi.spyOn(Disk.prototype, "append").mockRejectedValueOnce(new Error("ENOSPC"));
  expect(
    (
      await a.req("PUT", `${base}/chunks/0`, Buffer.from("x"), {
        "content-type": "application/octet-stream",
        "x-chunk-sha256": sha("x"),
      })
    ).statusCode,
  ).toBe(500);
  expect((await a.req("GET", `${base}/status`)).statusCode).toBe(410);
});
it("room owner cannot enumerate private transfer details between two other members", async () => {
  h = await harness();
  const { a, b, room } = await roomPair(h);
  const c = await h.user("Third");
  await c.req("POST", "/api/rooms/join", { code: room.invitation.code });
  await h.app.injectWS(`/api/rooms/${room.id}/events`, {
    headers: {
      host: "127.0.0.1:4173",
      origin: "http://127.0.0.1:4173",
      cookie: c.cookie,
    },
  });
  const { t, base } = await readyFile(
    h,
    b,
    c,
    room.id,
    Buffer.from("secret"),
    "confidential.txt",
  );
  for (const path of [
    `/api/transfers/${t.id}`,
    `${base}/status`,
    `${base}/download`,
  ])
    expect((await a.req("GET", path)).statusCode).toBe(404);
  for (const suffix of ["", "/insights", "/insights/export"]) {
    const r = await a.req("GET", `/api/rooms/${room.id}${suffix}`);
    expect(r.body).not.toContain(t.id);
    expect(r.body).not.toContain("confidential.txt");
  }
});
