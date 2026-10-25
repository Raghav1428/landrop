// A rejected operation must not poison the queue. Entries are removed after draining.
export class Locks {
  private tails = new Map<string, Promise<unknown>>();
  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const before = this.tails.get(key) ?? Promise.resolve();
    const task = before.catch(() => {}).then(fn);
    this.tails.set(key, task);
    try {
      return await task;
    } finally {
      if (this.tails.get(key) === task) this.tails.delete(key);
    }
  }
  async drain() {
    await Promise.allSettled(this.tails.values());
  }
}
export class Gate {
  active = 0;
  constructor(readonly max: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max)
      throw new ApiFault(503, "UNAVAILABLE", "Host busy; retry shortly", true);
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
    }
  }
}
import { ApiFault } from "./store";
