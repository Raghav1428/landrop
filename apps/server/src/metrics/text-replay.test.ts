import { it, expect } from "vitest";
import { harness, roomPair } from "../../test/helpers";
it("text retries count as ingress, never duplicate useful content", async () => {
  const h = await harness();
  try {
    const { a, b, room } = await roomPair(h);
    const t = (
      await a.req("POST", `/api/rooms/${room.id}/offers`, {
        kind: "text",
        recipientId: b.dto.id,
        byteLength: 5,
      })
    ).json();
    await b.req("POST", `/api/transfers/${t.id}/accept`, {});
    await a.req("POST", `/api/transfers/${t.id}/text`, { text: "hello" });
    await a.req("POST", `/api/transfers/${t.id}/text`, { text: "hello" });
    const m = (await a.req("GET", `/api/transfers/${t.id}`)).json().metrics;
    expect(m.acknowledgedBytes).toBe(5);
    expect(m.ingressBytes).toBe(10);
  } finally {
    await h.close();
  }
});
