let sequence = 0;
// One worker per active file keeps cancellation and memory ownership simple.
export function hasher(signal: AbortSignal) {
  const worker = new Worker(new URL("./hash.worker.ts", import.meta.url), {
    type: "module",
  });
  const pending = new Map<
    number,
    { resolve: (hash: string) => void; reject: (error: Error) => void }
  >();
  worker.onmessage = ({ data }) => {
    const request = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) request?.reject(new Error(data.error));
    else request?.resolve(data.digest);
  };
  worker.onerror = () => {
    for (const p of pending.values()) p.reject(new Error("Hash worker failed"));
    pending.clear();
  };
  const close = () => {
    worker.terminate();
    for (const p of pending.values())
      p.reject(new DOMException("Cancelled", "AbortError"));
    pending.clear();
  };
  signal.addEventListener("abort", close, { once: true });
  return {
    hash: (blob: Blob) =>
      new Promise<string>((resolve, reject) => {
        if (signal.aborted) {
          reject(new DOMException("Cancelled", "AbortError"));
          return;
        }
        const id = sequence++;
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, blob });
      }),
    close: () => {
      signal.removeEventListener("abort", close);
      close();
    },
  };
}
