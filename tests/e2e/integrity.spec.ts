import { test, expect } from "@playwright/test";
import { pair } from "./helpers";
test("wrong chunk digest cannot become a ready file", async ({ browser }) => {
  const { a, b, ca, cb } = await pair(browser);
  try {
    await a.route("**/chunks/0", (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          "x-chunk-sha256": "0".repeat(64),
        },
      }),
    );
    await a.getByRole("button", { name: "Send", exact: true }).click();
    await a
      .getByLabel("Recipient", { exact: true })
      .selectOption({ label: "Noah phone" });
    await a
      .getByLabel("Choose files")
      .setInputFiles({
        name: "corrupt.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("integrity"),
      });
    await a.getByRole("button", { name: "Send offer", exact: true }).click();
    await b.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(
      a.getByText(/Sending paused: Chunk checksum mismatch/),
    ).toBeVisible();
    await expect(
      b.getByRole("link", { name: "Download corrupt.txt" }),
    ).toHaveCount(0);
  } finally {
    await ca.close();
    await cb.close();
  }
});
