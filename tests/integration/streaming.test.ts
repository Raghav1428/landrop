import { it, expect } from "vitest";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { mkdtemp, mkdir, open, rm, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir, platform, release } from "node:os";
import { join } from "node:path";
import { harness, roomPair } from "../../apps/server/test/helpers";
import { sha } from "../../apps/server/test/transfers";
it(
  "generates on-disk data, streams verified download and records observed RSS (opt-in 2 GiB)",
  async () => {
    const size = process.env.LANDROP_LARGE_FILE === "1" ? 2147483648 : 33554432;
    const dir = await mkdtemp(join(tmpdir(), "landrop-stream-"));
    const h = await harness();
    try {
      const source = join(dir, "source.bin");
      const handle = await open(source, "w");
      const chunk = Buffer.alloc(1048576, 37);
      for (let written = 0; written < size; written += chunk.length)
        await handle.write(chunk);
      await handle.close();
      const { a, b, room } = await roomPair(h);
      const t = (
        await a.req("POST", `/api/rooms/${room.id}/offers`, {
          kind: "files",
          recipientId: b.dto.id,
          files: [{ id: "f", name: "generated.bin", size }],
        })
      ).json();
      await b.req("POST", `/api/transfers/${t.id}/accept`, {});
      const base = `/api/transfers/${t.id}/files/f`;
      let index = 0;
      const full = createHash("sha256");
      const baseline = process.memoryUsage().rss;
      let peak = baseline;
      for await (const data of createReadStream(source, {
        highWaterMark: 1048576,
      })) {
        const r = await a.req("PUT", `${base}/chunks/${index++}`, data, {
          "content-type": "application/octet-stream",
          "x-chunk-sha256": sha(data),
        });
        expect(r.statusCode).toBe(200);
        full.update(data);
        peak = Math.max(peak, process.memoryUsage().rss);
        if (index % 500 === 0) h.advance(60001);
      }
      const sum = full.digest("hex");
      expect(
        (await a.req("POST", `${base}/finalize`, { sha256: sum })).statusCode,
      ).toBe(200);
      await h.app.listen({ host: "127.0.0.1", port: 0 });
      const address = h.app.server.address() as { port: number };
      const result = await new Promise<IncomingMessage>((resolve, reject) => {
        const req = httpRequest(
          `http://127.0.0.1:${address.port}${base}/download`,
          { headers: { host: "127.0.0.1:4173", cookie: b.cookie } },
          resolve,
        );
        req.on("error", reject);
        req.end();
      });
      expect(result.statusCode).toBe(200);
      const received = createHash("sha256");
      let bytes = 0;
      for await (const data of result) {
        bytes += data.length;
        received.update(data);
        peak = Math.max(peak, process.memoryUsage().rss);
      }
      expect(bytes).toBe(size);
      expect(received.digest("hex")).toBe(sum);
      await mkdir(".superpowers", { recursive: true });
      await writeFile(
        ".superpowers/streaming-observations.json",
        JSON.stringify(
          {
            node: process.version,
            os: `${platform()} ${release()}`,
            bytes,
            baselineRss: baseline,
            observedPeakRss: peak,
            deltaRss: peak - baseline,
            scope:
              "Same-process Vitest server/client; chunked inject uploads, native HTTP streamed download; not a proof of constant memory or separate-browser memory.",
          },
          null,
          2,
        ),
      );
    } finally {
      await h.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
  process.env.LANDROP_LARGE_FILE === "1" ? 600000 : 30000,
);
