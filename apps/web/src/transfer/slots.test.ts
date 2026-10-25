import { it, expect } from "vitest";
import { fileSlot } from "./controller";
it("bounds concurrent active file readers at two", async () => {
  let active = 0,
    peak = 0;
  await Promise.all(
    Array.from({ length: 8 }, () =>
      fileSlot(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--;
      }),
    ),
  );
  expect(peak).toBe(2);
});
it("reserves a released slot for its waiter before a new caller can overtake it", async () => {
  let active = 0,
    peak = 0;
  const gates = Array.from({ length: 4 }, () => {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  });
  const start = (index: number) =>
    fileSlot(() => {
      active++;
      peak = Math.max(peak, active);
      return gates[index].promise;
    });
  const tasks = [start(0), start(1), start(2)];
  active--;
  gates[0].resolve();
  queueMicrotask(() => {
    tasks.push(start(3));
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const observedPeak = peak;
  for (const gate of gates) gate.resolve();
  await Promise.all(tasks);
  expect(observedPeak).toBe(2);
});
