import { test, expect } from "@playwright/test";
import { pair, textOffer } from "./helpers";
for (const width of [1440, 768, 390])
  test(`keyboard, locally loaded font and no page overflow at ${width}px`, async ({
    browser,
  }) => {
    const { a, b, ca, cb } = await pair(browser);
    try {
      await a.setViewportSize({ width, height: 900 });
      await b.setViewportSize({ width, height: 900 });
      await textOffer(a, "a keyboard-accessible message");
      await b.getByRole("button", { name: "Accept", exact: true }).click();
      await expect(b.getByLabel("Received message")).toHaveValue(
        "a keyboard-accessible message",
      );
      await b.evaluate(() =>
        Object.defineProperty(navigator, "clipboard", {
          value: undefined,
          configurable: true,
        }),
      );
      await b.getByRole("button", { name: "Copy text", exact: true }).click();
      await expect(b.getByText(/Text selected/)).toBeVisible();
      await b.keyboard.press("Escape");
      await expect(b.getByRole("dialog")).toHaveCount(0);
      await a.getByRole("button", { name: "Dismiss dialog" }).click();
      await a
        .getByRole("button", { name: "Invitations & controls", exact: true })
        .click();
      await expect(a.getByAltText("QR invitation for this room")).toBeVisible();
      expect(
        await a.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await a.evaluate(() => document.fonts.ready);
      expect(await a.evaluate(() => document.fonts.check("14px Inter"))).toBe(
        true,
      );
      if (width === 390) {
        await a
          .getByRole("button", { name: "Network insights", exact: true })
          .click();
        expect(
          await a
            .locator("table")
            .evaluate((el) => el.getBoundingClientRect().width),
        ).toBeLessThanOrEqual(354);
        await a
          .getByRole("button", { name: "Invitations & controls", exact: true })
          .click();
      }
      await a.screenshot({
        path: `.taste-skill/browser/controls-${width}.png`,
        fullPage: true,
      });
    } finally {
      await ca.close();
      await cb.close();
    }
  });
