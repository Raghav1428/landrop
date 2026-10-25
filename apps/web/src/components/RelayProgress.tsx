import type { TransferState } from "@landrop/protocol";
export function RelayProgress({
  state,
  committed,
  total,
  ready = false,
  downloadRequested = false,
}: {
  state: TransferState;
  committed: number;
  total: number;
  ready?: boolean;
  downloadRequested?: boolean;
}) {
  const waiting = state === "offered";
  return (
    <div className="relay" aria-label="Sender to host to receiver">
      <div>
        <span>Sender</span>
        <strong>
          {waiting
            ? "Awaiting approval"
            : state === "rejected"
              ? "Offer declined"
              : `${formatBytes(committed)} acknowledged`}
        </strong>
      </div>
      <span className="relay-arrow" aria-hidden="true">
        →
      </span>
      <div>
        <span>Host</span>
        <strong className={ready ? "positive" : ""}>
          {ready
            ? "Verified on host"
            : state === "transferring"
              ? "Receiving / verifying"
              : state === "accepted"
                ? "Approved to receive"
                : "No payload received"}
        </strong>
        <progress
          aria-label="Acknowledged upload"
          max={total || 1}
          value={committed}
        />
      </div>
      <span className="relay-arrow" aria-hidden="true">
        →
      </span>
      <div>
        <span>Receiver</span>
        <strong>
          {downloadRequested ? "Download requested" : "Not requested"}
        </strong>
      </div>
    </div>
  );
}
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes.toLocaleString()} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MiB`;
  return `${(bytes / 1073741824).toFixed(2)} GiB`;
}
