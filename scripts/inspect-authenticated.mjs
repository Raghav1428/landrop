// Real authenticated production state, not mocked HTML. Uses the unmodified tasteskill probes/rules.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import {
  probe,
  app as appProbe,
  layout,
} from "../.agents/skills/design-taste-frontend/scripts/lib/probe.mjs";
import {
  judge,
  judgeApp,
  judgeLayout,
  APP_SKIP,
} from "../.agents/skills/design-taste-frontend/scripts/lib/rules.mjs";
const out = ".taste-skill/authenticated";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chromium" });
const ca = await browser.newContext({ baseURL: "http://127.0.0.1:4173" }),
  cb = await browser.newContext({ baseURL: "http://127.0.0.1:4173" });
const a = await ca.newPage(),
  b = await cb.newPage();
const reports = [];
async function identify(page, name) {
  await page.goto("/");
  await page.getByLabel("Display name").fill(name);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Create room", exact: true })
    .waitFor();
}
async function photograph(page, screen) {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: width === 768 ? 1024 : 900 });
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(probe),
      A = await page.evaluate(appProbe),
      L = await page.evaluate(layout);
    const findings = [
      ...judge(m, { width }).filter((f) => !APP_SKIP.has(f.id)),
      ...judgeApp(A, m, { width }),
      ...judgeLayout(L, { width }).filter((f) => !APP_SKIP.has(f.id)),
    ];
    await page.screenshot({
      path: `${out}/${screen}-${width}.png`,
      fullPage: true,
    });
    reports.push({ screen, width, findings });
    console.log(
      screen,
      width,
      findings.map((f) => `${f.level} ${f.id}: ${f.message}`).join("\n"),
    );
  }
}
try {
  await identify(a, "Mira laptop");
  await a.getByRole("button", { name: "Create room", exact: true }).click();
  await a
    .getByRole("button", { name: "Invitations & controls", exact: true })
    .click();
  const code = await a.getByLabel("Room code", { exact: true }).inputValue();
  await identify(b, "Noah phone");
  await b.getByLabel("Room code", { exact: true }).fill(code);
  await b.getByRole("button", { name: "Join room", exact: true }).click();
  await b.getByRole("heading", { name: "Room", exact: true }).waitFor();
  await a.getByRole("button", { name: "Room", exact: true }).click();
  await a.getByRole("button", { name: "Send", exact: true }).click();
  await a
    .getByLabel("Recipient", { exact: true })
    .selectOption({ label: "Noah phone" });
  await a
    .getByLabel("Choose files")
    .setInputFiles({
      name: "field-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "Local network field notes\nReceiver approval before content.\n",
      ),
    });
  await a.getByRole("button", { name: "Send offer", exact: true }).click();
  await b.getByRole("button", { name: "Accept", exact: true }).waitFor();
  await photograph(b, "approval");
  await a.getByRole("button", { name: "Dismiss dialog" }).click();
  await photograph(a, "room");
  await b.getByRole("button", { name: "Accept", exact: true }).click();
  await b.getByRole("link", { name: "Download field-notes.txt" }).waitFor();
  await photograph(b, "detail");
  await a
    .getByRole("button", { name: "Network insights", exact: true })
    .click();
  await photograph(a, "insights");
  await a
    .getByRole("button", { name: "Invitations & controls", exact: true })
    .click();
  await a.getByAltText("QR invitation for this room").waitFor();
  await photograph(a, "controls");
  await writeFile(`${out}/report.json`, JSON.stringify(reports, null, 2));
} finally {
  await browser.close();
}
if (reports.some((r) => r.findings.some((f) => f.level === "FAIL")))
  process.exitCode = 1;
