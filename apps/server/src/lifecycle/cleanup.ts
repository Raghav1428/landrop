import { finished } from "node:stream/promises";
import type { Readable } from "node:stream";
import type { Transfer } from "../core/store";
import type { Transfers } from "../transfers/service";
import { release } from "../transfers/reservations";
import type { Disk } from "../storage/filesystem";
import type { Locks } from "../core/locks";
export class Cleanup {
  private jobs = new Map<string, Promise<void>>();
  constructor(
    readonly service: Transfers,
    readonly disk: Disk,
    readonly locks: Locks,
  ) {
    service.cleanup = (t) => this.run(t);
  }
  run(t: Transfer): Promise<void> {
    const existing = this.jobs.get(t.id);
    if (existing) return existing;
    const job = this.perform(t).finally(() => this.jobs.delete(t.id));
    this.jobs.set(t.id, job);
    return job;
  }
  private async perform(t: Transfer) {
    try {
      await Promise.allSettled(
        [...t.handles].map((h) => finished(h as Readable)),
      );
      for (const f of t.files)
        await this.locks.run(f.diskId, () => this.disk.remove(f));
      release(this.service.rooms.store, t);
      t.cleanupPending = false;
      for (const f of t.files) f.hashes = [];
    } catch {
      t.cleanupAttempts++;
      t.retryAt =
        this.service.rooms.now() +
        Math.min(60000, 1000 * 2 ** Math.min(t.cleanupAttempts, 6));
    }
    const r = this.service.rooms.store.rooms.get(t.roomId);
    if (r) this.service.rooms.changed(r);
  }
  async drain() {
    await Promise.allSettled(this.jobs.values());
  }
}
