import { LIMITS, type UploadStatus } from "@landrop/protocol";
import type { Request } from "../api/client";
import { attempt, retryable, wait } from "./retry";
export interface UploadOptions {
  transferId: string;
  fileId: string;
  file: File;
  signal: AbortSignal;
  hash: (blob: Blob) => Promise<string>;
  request: Request;
  wait?: typeof wait;
  progress?: (status: UploadStatus) => void;
}
export async function uploadFile(o: UploadOptions): Promise<void> {
  const base = `/api/transfers/${o.transferId}/files/${o.fileId}`;
  const status = () =>
    attempt<UploadStatus>(
      () => o.request("GET", `${base}/status`, undefined, { signal: o.signal }),
      o.signal,
      o.wait,
    );
  let current = await status();
  if (current.state === "ready") return;
  const fullHash = await o.hash(o.file);
  let failures = 0;
  while (current.committedBytes < o.file.size) {
    o.signal.throwIfAborted();
    const index = current.nextChunkIndex;
    const blob = o.file.slice(
      index * LIMITS.chunkBytes,
      (index + 1) * LIMITS.chunkBytes,
    );
    const hash = await o.hash(blob);
    try {
      current = await o.request("PUT", `${base}/chunks/${index}`, blob, {
        signal: o.signal,
        headers: { "X-Chunk-SHA256": hash },
      });
      failures = 0;
    } catch (e) {
      if (!retryable(e) || failures++ >= 4) throw e;
      const before = current.nextChunkIndex;
      current = await status();
      if (current.state === "ready") return;
      if (current.nextChunkIndex === before)
        await (o.wait ?? wait)(Math.min(8000, 500 * 2 ** failures), o.signal);
      else failures = 0;
    }
    o.progress?.(current);
  }
  await attempt(
    () =>
      o.request(
        "POST",
        `${base}/finalize`,
        { sha256: fullHash },
        { signal: o.signal },
      ),
    o.signal,
    o.wait,
  );
}
// Shared across all sends in this page: at most two File objects actively read/hashed/uploaded.
let active = 0;
const queue: Array<() => void> = [];
export async function fileSlot<T>(fn: () => Promise<T>) {
  if (active >= 2) await new Promise<void>((resolve) => queue.push(resolve));
  else active++;
  try {
    return await fn();
  } finally {
    const next = queue.shift();
    // Hand the already-counted slot directly to its waiter; never expose a gap.
    if (next) next();
    else active--;
  }
}
