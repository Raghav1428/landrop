import { readFileSync, writeFileSync, unlinkSync, lstatSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
// A host must not mistake another running host's payloads for restart orphans.
export class StorageLease {
  private nonce = randomUUID();
  private owned = false;
  constructor(private root: string) {}
  acquire() {
    const path = join(this.root, ".landrop-lock-v1");
    try {
      if (lstatSync(path).isSymbolicLink())
        throw new Error("Invalid storage lease");
      const old = JSON.parse(readFileSync(path, "utf8")) as { pid: number };
      if (!Number.isSafeInteger(old.pid) || old.pid <= 0)
        throw new Error("Invalid storage lease");
      try {
        process.kill(old.pid, 0);
        throw new Error("Storage already in use by a running host");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e;
      }
      unlinkSync(path);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    try {
      writeFileSync(
        path,
        JSON.stringify({ pid: process.pid, nonce: this.nonce }),
        { flag: "wx", mode: 0o600 },
      );
      this.owned = true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST")
        throw new Error("Storage already in use by another host");
      throw e;
    }
  }
  release() {
    if (!this.owned) return;
    const path = join(this.root, ".landrop-lock-v1");
    try {
      if (JSON.parse(readFileSync(path, "utf8")).nonce === this.nonce)
        unlinkSync(path);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    this.owned = false;
  }
}
