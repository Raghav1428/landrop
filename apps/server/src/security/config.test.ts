import { it, expect } from "vitest";
import { config } from "../config";
it("normalizes default-port origins and validates operator budgets without exposing them as public limits", () => {
  expect(config({ PORT: "80" }).origins).toContain("http://127.0.0.1");
  const c = config({
    DISK_BUDGET_BYTES: "0",
    TEXT_BUDGET_BYTES: "100",
    MAX_ROOMS: "2",
    MAX_SESSIONS: "8",
  });
  expect(c.diskBudget).toBe(0);
  expect(c.textBudget).toBe(100);
  expect(c.maxRooms).toBe(2);
  expect(c.maxSessions).toBe(8);
  for (const env of [
    { DISK_BUDGET_BYTES: "-1" },
    { TEXT_BUDGET_BYTES: "1.5" },
    { MAX_ROOMS: "0" },
    { MAX_SESSIONS: "NaN" },
  ])
    expect(() => config(env)).toThrow();
});
