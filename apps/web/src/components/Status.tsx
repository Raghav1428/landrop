export function Status({ state }: { state: string }) {
  return (
    <span
      className={`status ${state === "completed" ? "positive" : state === "failed" ? "negative" : ""}`}
    >
      {(
        {
          offered: "Awaiting approval",
          accepted: "Accepted",
          transferring: "Uploading / verifying",
          completed: "Ready",
          rejected: "Declined",
          cancelled: "Cancelled",
          expired: "Expired",
          failed: "Failed",
        } as Record<string, string>
      )[state] ?? state}
    </span>
  );
}
