import { fault } from "../core/store";
export class RateLimits {
  private entries = new Map<string, { start: number; count: number }>();
  constructor(private now: () => number) {}
  hit(key: string, max: number, window = 60000) {
    const now = this.now();
    for (const [k, v] of this.entries)
      if (now - v.start >= window) this.entries.delete(k);
    let e = this.entries.get(key);
    if (!e) {
      if (this.entries.size >= 4096)
        fault(429, "RATE_LIMIT", "Rate limiter at capacity", true);
      e = { start: now, count: 0 };
      this.entries.set(key, e);
    }
    if (++e.count > max)
      fault(429, "RATE_LIMIT", "Too many requests; try later", true);
  }
}
