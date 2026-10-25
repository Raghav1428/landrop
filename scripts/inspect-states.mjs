// Visual fault-state inspection against the real production app. Faults are browser-local.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const out = ".taste-skill/states";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chromium" });
async function shot(page, name) {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      path: `${out}/${name}-${width}.png`,
      fullPage: true,
    });
  }
}
async function identify(page, name) {
  await page.goto("/");
  await page.getByLabel("Display name").fill(name);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Create room", exact: true })
    .waitFor();
}
const ca = await browser.newContext({ baseURL: "http://127.0.0.1:4173" }),
  cb = await browser.newContext({ baseURL: "http://127.0.0.1:4173" });
const a = await ca.newPage(),
  b = await cb.newPage();
try {
  let fail;
  const gate = new Promise((resolve) => {
    fail = resolve;
  });
  await a.route("**/api/config", async (route) => {
    await gate;
    await route.abort();
  });
  await a.goto("/", { waitUntil: "domcontentloaded" });
  await a.getByRole("status").waitFor();
  await shot(a, "loading");
  fail();
  await a.getByRole("alert").waitFor();
  await shot(a, "host-error");
  await a.unroute("**/api/config");
  await identify(a, "State sender");
  await a.getByRole("button", { name: "Create room", exact: true }).click();
  await a
    .getByRole("button", { name: "Invitations & controls", exact: true })
    .click();
  const code = await a.getByLabel("Room code", { exact: true }).inputValue();
  await identify(b, "State receiver");
  await b.getByLabel("Room code", { exact: true }).fill(code);
  await b.getByRole("button", { name: "Join room", exact: true }).click();
  await b.getByRole("heading", { name: "Room", exact: true }).waitFor();
  await a.getByRole("button", { name: "Room", exact: true }).click();
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
    .selectOption({ label: "State receiver" });
  await a
    .getByLabel("Choose files")
    .setInputFiles({
      name: "integrity-state.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("literal state fixture"),
    });
  await a.getByRole("button", { name: "Send offer", exact: true }).click();
  await b.getByRole("button", { name: "Accept", exact: true }).click();
  await a.getByText(/Sending paused: Chunk checksum mismatch/).waitFor();
  await shot(a, "hash-paused");
  await a.getByRole("button", { name: "Cancel transfer", exact: true }).click();
  await a.getByRole("button", { name: "Confirm", exact: true }).click();
  await a.getByText(/Access revoked\. Host cleanup/).waitFor();
  await shot(a, "cleanup");
  await b.routeWebSocket("**/events", (ws) => ws.close());
  await b.reload();
  await b.getByText(/Live updates disconnected/).waitFor();
  await shot(b, "disconnected");
  await a
    .getByRole("button", { name: "Invitations & controls", exact: true })
    .click();
  await a.getByRole("button", { name: "Close room", exact: true }).click();
  await a.getByRole("button", { name: "Confirm", exact: true }).click();
  await a.getByRole("button", { name: "Create room", exact: true }).waitFor();
} finally {
  await browser.close();
}
console.log(
  `Inspected loading, host-error, hash-paused, cleanup and disconnected at 1440/768/390: ${out}`,
);
