import type { StoredFile } from "../core/store";
export function uploadStatus(f: StoredFile) {
  return {
    nextChunkIndex: f.hashes.length,
    committedBytes: f.committedBytes,
    state: f.state,
  };
}
