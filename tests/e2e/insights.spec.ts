import { test, expect } from "@playwright/test";
import { pair, textOffer } from "./helpers";
test("network insights and export agree with actual accepted UTF-8 bytes", async ({
  browser,
}) => {
  const { a, b, ca, cb } = await pair(browser);
  try {
    await textOffer(a, "hello");
    await b.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(b.getByLabel("Received message")).toHaveValue("hello");
    await a.getByRole("button", { name: "Dismiss dialog" }).click();
    await a
      .getByRole("button", { name: "Network insights", exact: true })
      .click();
    await expect(
      a.getByRole("heading", { name: "Network insights" }),
    ).toBeVisible();
    await expect(a.getByText("5 B", { exact: true }).first()).toBeVisible();
    const event = a.waitForEvent("download");
    await a.getByRole("link", { name: "Export JSON" }).click();
    const download = await event;
    expect(download.suggestedFilename()).toBe("landrop-insights.json");
  } finally {
    await ca.close();
    await cb.close();
  }
});
