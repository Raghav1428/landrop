import { test, expect } from "@playwright/test";
import { pair, textOffer } from "./helpers";
test("real file verification, native download and literal text approval", async ({
  browser,
}) => {
  const { a, b, ca, cb } = await pair(browser);
  try {
    await a.getByRole("button", { name: "Send", exact: true }).click();
    await a
      .getByLabel("Recipient", { exact: true })
      .selectOption({ label: "Noah phone" });
    await a.getByLabel("Choose files").setInputFiles({
      name: "network.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("LAN hello"),
    });
    await a.getByRole("button", { name: "Send offer", exact: true }).click();
    await expect(
      b.getByText("network.txt", { exact: true }).first(),
    ).toBeVisible();
    await b.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(
      b.getByRole("link", { name: "Download network.txt" }),
    ).toBeVisible();
    const downloadEvent = b.waitForEvent("download");
    await b.getByRole("link", { name: "Download network.txt" }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe("network.txt");
    const stream = await download.createReadStream();
    const pieces = [];
    for await (const piece of stream!) pieces.push(piece);
    expect(Buffer.concat(pieces).toString()).toBe("LAN hello");
    await b.getByRole("button", { name: "Dismiss dialog" }).click();
    await textOffer(a);
    await b.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(b.getByLabel("Received message")).toHaveValue(
      "<script>literal 😀</script>",
    );
    await b.getByRole("button", { name: "Copy text", exact: true }).click();
    await expect(b.getByLabel("Received message")).toBeVisible();
    const revokeResponse = b.waitForResponse(
      (r) =>
        r.request().method() === "DELETE" &&
        r.url().includes("/api/transfers/"),
    );
    await b
      .getByRole("button", { name: "Delete transfer", exact: true })
      .click();
    await b.getByRole("button", { name: "Confirm", exact: true }).click();
    expect((await revokeResponse).ok()).toBe(true);
    await expect(b.getByLabel("Received message")).toHaveCount(0);
    await expect(
      b.getByText(/Access revoked\. Host cleanup (is pending|has finished)/),
    ).toBeVisible();
  } finally {
    await ca.close();
    await cb.close();
  }
});
