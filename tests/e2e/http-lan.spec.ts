import { test, expect } from "@playwright/test";
import { identify } from "./helpers";
test("local browser uses genuinely insecure LAN HTTP, worker hashing and no external runtime assets", async ({
  browser,
  request,
}) => {
  const config = await (await request.get("/api/config")).json();
  const origin = config.addresses.find(
    (s: string) => !s.includes("127.0.0.1") && !s.includes("localhost"),
  );
  test.skip(!origin, "No nonloopback IPv4 interface available on this runner");
  const ca = await browser.newContext({ baseURL: origin }),
    cb = await browser.newContext({ baseURL: origin });
  const external: string[] = [];
  for (const context of [ca, cb])
    await context.route("**/*", (route) => {
      const url = route.request().url();
      if (new URL(url).origin !== origin) {
        external.push(url);
        return route.abort();
      }
      return route.continue();
    });
  const a = await ca.newPage(),
    b = await cb.newPage();
  try {
    await identify(a, "LAN sender");
    expect(await a.evaluate(() => isSecureContext)).toBe(false);
    await a.getByRole("button", { name: "Create room", exact: true }).click();
    await a
      .getByRole("button", { name: "Invitations & controls", exact: true })
      .click();
    const code = await a.getByLabel("Room code", { exact: true }).inputValue();
    await identify(b, "LAN receiver");
    await b.getByLabel("Room code", { exact: true }).fill(code);
    await b.getByRole("button", { name: "Join room", exact: true }).click();
    await b.getByRole("heading", { name: "Room", exact: true }).waitFor();
    await a.getByRole("button", { name: "Room", exact: true }).click();
    await a.getByRole("button", { name: "Send", exact: true }).click();
    await a
      .getByLabel("Recipient", { exact: true })
      .selectOption({ label: "LAN receiver" });
    await a
      .getByLabel("Choose files")
      .setInputFiles({
        name: "http-worker.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Hashing does not require subtle crypto"),
      });
    await a.getByRole("button", { name: "Send offer", exact: true }).click();
    await b.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(
      b.getByRole("link", { name: "Download http-worker.txt" }),
    ).toBeVisible();
    expect(external).toEqual([]);
  } finally {
    await ca.close();
    await cb.close();
  }
});
