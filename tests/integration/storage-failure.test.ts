import { it, expect, vi } from "vitest";
import { mkdtemp, stat, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Disk } from "../../apps/server/src/storage/filesystem";
import type { StoredFile } from "../../apps/server/src/core/store";
it("truncates a partially written chunk back to the authoritative committed offset", async () => {
  const root = await mkdtemp(join(tmpdir(), "landrop-partial-"));
  const disk = new Disk(join(root, "owned"));
  try {
    await disk.init();
    const file: StoredFile = {
      id: "f",
      diskId: "12345678-1234-1234-1234-123456789abc",
      name: "x",
      size: 5,
      state: "uploading",
      committedBytes: 0,
      hashes: [],
      downloadRequested: false,
    };
    const handle = await disk.file(file);
    const original = handle.write.bind(handle);
    let writes = 0;
    vi.spyOn(handle, "write").mockImplementation(async (...args: any[]) => {
      if (writes++ === 0) return original(args[0], args[1], 2, args[3]);
      throw new Error("simulated disk failure");
    });
    const opened = vi.spyOn(disk, "file").mockResolvedValueOnce(handle);
    await expect(disk.append(file, Buffer.from("hello"))).rejects.toThrow(
      "simulated disk failure",
    );
    opened.mockRestore();
    expect((await stat(disk.path(file))).size).toBe(0);
    expect(file.committedBytes).toBe(0);
    await disk.append(file, Buffer.from("hello"));
    expect((await stat(disk.path(file))).size).toBe(5);
  } finally {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  }
});
