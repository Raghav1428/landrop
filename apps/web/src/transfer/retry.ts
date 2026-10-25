export const retryable = (error: unknown) => {
  const e = error as { status?: number; name?: string };
  return (
    e.name !== "AbortError" &&
    (e.status === undefined || [429, 500, 502, 503, 504].includes(e.status))
  );
};
export function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted)
      return reject(new DOMException("Cancelled", "AbortError"));
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
export async function attempt<T>(
  fn: () => Promise<T>,
  signal: AbortSignal,
  sleep = wait,
) {
  for (let n = 0; ; n++) {
    signal.throwIfAborted();
    try {
      return await fn();
    } catch (e) {
      if (n >= 4 || !retryable(e)) throw e;
      await sleep(Math.min(8000, 500 * 2 ** n), signal);
    }
  }
}
