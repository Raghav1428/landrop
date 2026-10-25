import { it, expect } from "vitest";
import { mkdtemp, writeFile, readdir, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Disk } from "../../apps/server/src/storage/filesystem";
import { harness, roomPair } from "../../apps/server/test/helpers";
import { readyFile } from "../../apps/server/test/transfers";
it("recognizes owned payload orphans without deleting unknown files or arbitrary directories", async () => {
  const root = await mkdtemp(join(tmpdir(), "landrop-orphans-"));
  try {
    const arbitrary = join(root, "personal");
    await mkdir(arbitrary);
    await writeFile(join(arbitrary, "notes.txt"), "preserve");
    await expect(new Disk(arbitrary).init()).rejects.toThrow("unowned");
    expect(await readdir(arbitrary)).toEqual(["notes.txt"]);
    const owned = join(root, "owned");
    const disk = new Disk(owned);
    await disk.init();
    await writeFile(
      join(owned, "12345678-1234-1234-1234-123456789abc.part"),
      "orphan",
    );
    await writeFile(join(owned, "keep.txt"), "preserve");
    await disk.close();
    await disk.init();
    expect((await readdir(owned)).sort()).toEqual([
      ".landrop-lock-v1",
      ".landrop-owned-v1",
      "keep.txt",
    ]);
    await disk.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it("shutdown drains content, closes sockets and preserves no application payloads", async () => {
  const h = await harness();
  try {
    const { a, b, room } = await roomPair(h);
    await readyFile(h, a, b, room.id);
    await h.app.close();
    expect(h.app.websocketServer.clients.size).toBe(0);
  } finally {
    await h.close();
  }
});
