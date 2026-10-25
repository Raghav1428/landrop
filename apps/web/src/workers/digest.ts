import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { LIMITS } from "@landrop/protocol";
export async function incrementalDigest(blob: Blob): Promise<string> {
  const hash = sha256.create();
  for (let offset = 0; offset < blob.size; offset += LIMITS.chunkBytes)
    hash.update(
      new Uint8Array(
        await blob.slice(offset, offset + LIMITS.chunkBytes).arrayBuffer(),
      ),
    );
  return bytesToHex(hash.digest());
}
