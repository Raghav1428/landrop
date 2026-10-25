import { it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RelayProgress } from "./RelayProgress";
it("separates host readiness from observable download request without claiming saved", () => {
  const html = renderToStaticMarkup(
    <RelayProgress
      state="completed"
      committed={5}
      total={5}
      ready
      downloadRequested={false}
    />,
  );
  expect(html).toContain("Sender");
  expect(html).toContain("Host");
  expect(html).toContain("Receiver");
  expect(html).toContain("Verified on host");
  expect(html).toContain("Not requested");
  expect(html).not.toContain("Saved");
});
