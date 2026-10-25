import { expect, type Browser, type Page } from "@playwright/test";
export async function identify(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel("Display name").fill(name);
  const result = page.waitForResponse(
    (r) => r.url().endsWith("/api/session") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  // The production limiter is intentionally not disabled for browser tests sharing one loopback IP.
  if ((await result).status() === 429) {
    await page.waitForTimeout(61000);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  }
  await expect(
    page.getByRole("button", { name: "Create room", exact: true }),
  ).toBeVisible();
}
export async function pair(browser: Browser) {
  const ca = await browser.newContext();
  const cb = await browser.newContext();
  const a = await ca.newPage();
  const b = await cb.newPage();
  await identify(a, "Mira laptop");
  await a.getByRole("button", { name: "Create room", exact: true }).click();
  await a
    .getByRole("button", { name: "Invitations & controls", exact: true })
    .click();
  const code = await a.getByLabel("Room code", { exact: true }).inputValue();
  await identify(b, "Noah phone");
  await b.getByLabel("Room code", { exact: true }).fill(code);
  await b.getByRole("button", { name: "Join room", exact: true }).click();
  await a.getByRole("button", { name: "Room", exact: true }).click();
  await expect(
    a.getByText("Noah phone", { exact: true }).first(),
  ).toBeVisible();
  return { ca, cb, a, b, code };
}
export async function textOffer(a: Page, text = "<script>literal 😀</script>") {
  if (await a.getByRole("dialog").count())
    await a.getByRole("button", { name: "Dismiss dialog" }).click();
  await a.getByRole("button", { name: "Send", exact: true }).click();
  await a
    .getByLabel("Recipient", { exact: true })
    .selectOption({ label: "Noah phone" });
  await a.getByRole("button", { name: "Text", exact: true }).click();
  await a.getByLabel("Message", { exact: true }).fill(text);
  await a.getByRole("button", { name: "Send offer", exact: true }).click();
}
