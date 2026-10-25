import { test, expect } from "@playwright/test";
import { pair, textOffer } from "./helpers";
test("owner room closure revokes content and updates the other context", async ({
  browser,
}) => {
  const { a, b, ca, cb } = await pair(browser);
  try {
    await textOffer(a, "temporary");
    await b.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(b.getByLabel("Received message")).toHaveValue("temporary");
    await a.getByRole("button", { name: "Dismiss dialog" }).click();
    await a
      .getByRole("button", { name: "Invitations & controls", exact: true })
      .click();
    await a.getByRole("button", { name: "Close room", exact: true }).click();
    await a.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(
      a.getByRole("button", { name: "Create room", exact: true }),
    ).toBeVisible();
    await expect(
      b.getByRole("button", { name: "Create room", exact: true }),
    ).toBeVisible();
    await expect(b.getByLabel("Received message")).toHaveCount(0);
  } finally {
    await ca.close();
    await cb.close();
  }
});
