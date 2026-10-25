import { describe, it, expect } from "vitest";
import { uploadFile } from "./controller";
import { incrementalDigest } from "../workers/digest";
import type { UploadStatus } from "@landrop/protocol";
describe("sender recovery", () => {
  it("reconciles a committed chunk after a lost acknowledgement instead of appending twice", async () => {
    let status: UploadStatus = {
      nextChunkIndex: 0,
      committedBytes: 0,
      state: "queued",
    };
    let puts = 0;
    let finalized = "";
    const data = new File(["hello"], "greeting.txt");
    await uploadFile({
      transferId: "t",
      fileId: "f",
      file: data,
      signal: new AbortController().signal,
      hash: incrementalDigest,
      request: async (method, path, body) => {
        if (method === "GET") return status;
        if (path.endsWith("/finalize")) {
          finalized = (body as any).sha256;
          return { ...status, state: "ready" };
        }
        puts++;
        status = { nextChunkIndex: 1, committedBytes: 5, state: "uploading" };
        throw new TypeError("Connection lost after commit");
      },
      wait: async () => {},
    });
    expect(puts).toBe(1);
    expect(finalized).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
  it("hashes empty and multi-chunk blobs without whole-blob buffering", async () => {
    expect(await incrementalDigest(new Blob([]))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    const blob = new Blob([new Uint8Array(1048577).fill(97)]);
    Object.defineProperty(blob, "arrayBuffer", {
      value: () => {
        throw new Error("whole-file buffering forbidden");
      },
    });
    expect(await incrementalDigest(blob)).toMatch(/^[a-f0-9]{64}$/);
  });
  it("stops on terminal authorization errors instead of retrying", async () => {
    let calls = 0;
    await expect(
      uploadFile({
        transferId: "t",
        fileId: "f",
        file: new File(["x"], "x"),
        signal: new AbortController().signal,
        hash: incrementalDigest,
        request: async () => {
          calls++;
          throw Object.assign(new Error("Denied"), { status: 403 });
        },
        wait: async () => {},
      }),
    ).rejects.toThrow("Denied");
    expect(calls).toBe(1);
  });
});
