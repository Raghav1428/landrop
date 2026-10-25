import { test, expect } from "@playwright/test";
import { pair } from "./helpers";
test("lost chunk acknowledgement reconciles committed data and refresh never implies resumability", async ({
  browser,
}) => {
  const { a, b, ca, cb } = await pair(browser);
  try {
    let lost = false;
    await a.route("**/chunks/0", async (route) => {
      if (!lost) {
        lost = true;
        await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    await a.getByRole("button", { name: "Send", exact: true }).click();
    await a
      .getByLabel("Recipient", { exact: true })
      .selectOption({ label: "Noah phone" });
    await a.getByLabel("Choose files").setInputFiles({
      name: "recovered.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("one committed copy"),
    });
    await a.getByRole("button", { name: "Send offer", exact: true }).click();
    await b.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(
      b.getByRole("link", { name: "Download recovered.txt" }),
    ).toBeVisible();
    expect(lost).toBe(true);
    await a.getByRole("button", { name: "Dismiss dialog" }).click();
    await b.getByRole("button", { name: "Dismiss dialog" }).click();
    await a.getByRole("button", { name: "Send", exact: true }).click();
    await a
      .getByLabel("Recipient", { exact: true })
      .selectOption({ label: "Noah phone" });
    await a.getByLabel("Choose files").setInputFiles({
      name: "refresh.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not resumable"),
    });
    await a.getByRole("button", { name: "Send offer", exact: true }).click();
    await a.reload();
    await b.getByRole("button", { name: "Accept", exact: true }).click();
    await a.getByRole("button").filter({ hasText: "refresh.txt" }).click();
    await expect(a.getByText(/cannot resume after refresh/)).toBeVisible();
  } finally {
    await ca.close();
    await cb.close();
  }
});
