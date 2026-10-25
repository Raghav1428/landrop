import { createHash } from "node:crypto";
import type { Harness, User } from "./helpers";
export const sha = (data: Buffer | string) =>
  createHash("sha256").update(data).digest("hex");
export async function fileOffer(
  a: User,
  b: User,
  roomId: string,
  data: Buffer,
  name = "sample.txt",
) {
  const response = await a.req("POST", `/api/rooms/${roomId}/offers`, {
    kind: "files",
    recipientId: b.dto.id,
    files: [{ id: "f", name, size: data.length }],
  });
  if (response.statusCode !== 200) throw new Error(response.body);
  const t = response.json();
  await b.req("POST", `/api/transfers/${t.id}/accept`, {});
  return { t, base: `/api/transfers/${t.id}/files/f` };
}
export async function readyFile(
  _h: Harness,
  a: User,
  b: User,
  roomId: string,
  data = Buffer.from("hello"),
  name?: string,
) {
  const { t, base } = await fileOffer(a, b, roomId, data, name);
  for (let i = 0; i < Math.ceil(data.length / 1048576); i++) {
    const chunk = data.subarray(i * 1048576, (i + 1) * 1048576);
    const r = await a.req("PUT", `${base}/chunks/${i}`, chunk, {
      "content-type": "application/octet-stream",
      "x-chunk-sha256": sha(chunk),
    });
    if (r.statusCode !== 200) throw new Error(r.body);
  }
  const result = await a.req("POST", `${base}/finalize`, { sha256: sha(data) });
  if (result.statusCode !== 200) throw new Error(result.body);
  return { t, base };
}
