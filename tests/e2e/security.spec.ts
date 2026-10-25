import { test, expect, type Page } from "@playwright/test";
import { pair, identify, textOffer } from "./helpers";
export async function api(
  page: Page,
  method: string,
  path: string,
  body?: unknown,
) {
  return page.evaluate(
    async ({ method, path, body }) => {
      const session = await (await fetch("/api/session")).json();
      const res = await fetch(path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": session.csrfToken,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, body: await res.json() };
    },
    { method, path, body },
  );
}
test("room owner cannot inspect another pair; rejection uploads no payload", async ({
  browser,
}) => {
  const { a, b, ca, cb, code } = await pair(browser);
  const cc = await browser.newContext();
  const c = await cc.newPage();
  try {
    await identify(c, "Leena tablet");
    await c.getByLabel("Room code", { exact: true }).fill(code);
    await c.getByRole("button", { name: "Join room", exact: true }).click();
    await expect(
      c.getByRole("heading", { name: "Room", exact: true }),
    ).toBeVisible();
    const s = (await api(c, "GET", "/api/session")).body;
    const sb = (await api(b, "GET", "/api/session")).body;
    const made = await api(b, "POST", `/api/rooms/${sb.roomId}/offers`, {
      kind: "text",
      recipientId: s.id,
      byteLength: 5,
    });
    expect(made.status).toBe(200);
    expect((await api(a, "GET", `/api/transfers/${made.body.id}`)).status).toBe(
      404,
    );
    const scoped = await api(a, "GET", `/api/rooms/${sb.roomId}/insights`);
    expect(JSON.stringify(scoped.body)).not.toContain(made.body.id);
    await api(c, "POST", `/api/transfers/${made.body.id}/reject`, {});
    let payload = 0;
    a.on("request", (r) => {
      if (r.method() === "PUT" || r.url().endsWith("/text")) payload++;
    });
    await textOffer(a, "must stay local");
    await b.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(
      a.getByText("Declined", { exact: true }).first(),
    ).toBeVisible();
    expect(payload).toBe(0);
  } finally {
    await ca.close();
    await cb.close();
    await cc.close();
  }
});
