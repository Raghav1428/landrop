import { it, expect } from "vitest";
import { mkdtemp, rm, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Disk } from "../../apps/server/src/storage/filesystem";
it("a second host cannot sweep the live hosts storage; clean shutdown releases ownership", async () => {
  const root = await mkdtemp(join(tmpdir(), "landrop-lock-"));
  const first = new Disk(join(root, "owned")),
    second = new Disk(join(root, "owned"));
  try {
    await first.init();
    const name = "12345678-1234-1234-1234-123456789abc.part";
    await writeFile(join(first.root, name), "live");
    await expect(second.init()).rejects.toThrow("already in use");
    expect(await readdir(first.root)).toContain(name);
    await first.close();
    await second.init();
    expect(await readdir(first.root)).not.toContain(name);
  } finally {
    await first.close();
    await second.close();
    await rm(root, { recursive: true, force: true });
  }
});
