import { incrementalDigest } from "./digest";
self.onmessage = async ({ data }: { data: { id: number; blob: Blob } }) => {
  try {
    self.postMessage({
      id: data.id,
      digest: await incrementalDigest(data.blob),
    });
  } catch {
    self.postMessage({ id: data.id, error: "Unable to hash selected file" });
  }
};
