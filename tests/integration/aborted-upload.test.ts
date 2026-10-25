import { it, expect } from "vitest";
import { createConnection } from "node:net";
import { createHash } from "node:crypto";
import { harness, roomPair } from "../../apps/server/test/helpers";
it("aborted partial request bodies cannot permanently consume all eight upload slots", async () => {
  const h = await harness();
  try {
    const { a, b, room } = await roomPair(h);
    const t = (
      await a.req("POST", `/api/rooms/${room.id}/offers`, {
        kind: "files",
        recipientId: b.dto.id,
        files: [{ id: "f", name: "partial.txt", size: 12 }],
      })
    ).json();
    await b.req("POST", `/api/transfers/${t.id}/accept`, {});
    await h.app.listen({ port: 0, host: "127.0.0.1" });
    const port = (h.app.server.address() as { port: number }).port;
    const path = `/api/transfers/${t.id}/files/f/chunks/0`;
    for (let i = 0; i < 8; i++) {
      await new Promise<void>((resolve, reject) => {
        const socket = createConnection({ host: "127.0.0.1", port }, () =>
          socket.write(
            `PUT ${path} HTTP/1.1\r\nHost: 127.0.0.1:4173\r\nOrigin: http://127.0.0.1:4173\r\nCookie: ${a.cookie}\r\nX-CSRF-Token: ${a.dto.csrfToken}\r\nContent-Type: application/octet-stream\r\nContent-Length: 12\r\n\r\nx`,
          ),
        );
        socket.on("error", reject);
        h.app.server.once("request", (req) => {
          req.once("aborted", () => resolve());
          req.once("data", () => socket.destroy());
        });
      });
      await new Promise((r) => setTimeout(r, 0));
    }
    const body = Buffer.from("abcdefghijkl");
    const res = await a.req("PUT", path, body, {
      "content-type": "application/octet-stream",
      "x-chunk-sha256": createHash("sha256").update(body).digest("hex"),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().committedBytes).toBe(12);
  } finally {
    await h.close();
  }
});
