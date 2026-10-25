import { test, expect } from "@playwright/test";
import { pair } from "./helpers";
test("QR invitation fragment is consumed locally and shared-cookie tabs remain one online identity", async ({
  browser,
}) => {
  const { a, b, ca, cb } = await pair(browser);
  const cc = await browser.newContext();
  try {
    await a
      .getByRole("button", { name: "Invitations & controls", exact: true })
      .click();
    await a
      .getByLabel("Connection address")
      .selectOption("http://127.0.0.1:4173");
    const link = await a.getByLabel("Invitation link").inputValue();
    const c = await cc.newPage();
    await c.goto(link);
    await expect(c).toHaveURL("http://127.0.0.1:4173/");
    await c.getByLabel("Display name").fill("Isha tablet");
    await c.getByRole("button", { name: "Continue", exact: true }).click();
    await c
      .getByRole("button", { name: "Join invitation", exact: true })
      .click();
    await expect(
      c.getByRole("heading", { name: "Room", exact: true }),
    ).toBeVisible();
    const tab = await cb.newPage();
    await tab.goto("/");
    await expect(
      tab.getByRole("heading", { name: "Room", exact: true }),
    ).toBeVisible();
    await b.close();
    await expect(a.getByText("online", { exact: false }).first()).toBeVisible();
    const s = await a.evaluate(async () => {
      const s = await (await fetch("/api/session")).json();
      return (await (await fetch(`/api/rooms/${s.roomId}`)).json()).members;
    });
    expect(s).toHaveLength(3);
    expect(s.find((m: any) => m.name === "Noah phone").online).toBe(true);
  } finally {
    await ca.close();
    await cb.close();
    await cc.close();
  }
});
