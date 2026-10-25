import type { Snapshot } from "@landrop/protocol";
import { formatBytes } from "../../components/RelayProgress";
export function Insights({ room }: { room: Snapshot }) {
  const metrics = room.transfers.map((t) => t.metrics);
  const sum = (key: "acknowledgedBytes" | "ingressBytes" | "servedBytes") =>
    metrics.reduce((n, m) => n + m[key], 0);
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Network insights</h1>
          <p>
            Your application traffic in this room, not your network’s bandwidth.
          </p>
        </div>
        <a className="button" href={`/api/rooms/${room.id}/insights/export`}>
          Export JSON
        </a>
      </div>
      <section className="panel">
        <h2>Your transfer traffic</h2>
        <dl className="metric-strip">
          <div>
            <dt>Unique acknowledged</dt>
            <dd>{formatBytes(sum("acknowledgedBytes"))}</dd>
          </div>
          <div>
            <dt>Ingress, including retries</dt>
            <dd>{formatBytes(sum("ingressBytes"))}</dd>
          </div>
          <div>
            <dt>Download bytes emitted</dt>
            <dd>{formatBytes(sum("servedBytes"))}</dd>
          </div>
        </dl>
      </section>
      <section className="panel">
        <h2>Application goodput</h2>
        {!room.transfers.length ? (
          <p className="empty">
            No transfers yet. Measurements appear when real content moves.
          </p>
        ) : (
          <div className="metrics-table">
            <table>
              <thead>
                <tr>
                  <th>Transfer</th>
                  <th className="num">Logical size</th>
                  <th className="num">Goodput</th>
                  <th className="num">Verification</th>
                </tr>
              </thead>
              <tbody>
                {room.transfers.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {t.kind === "text"
                        ? "Plain-text message"
                        : t.files.map((f) => f.name).join(", ")}
                    </td>
                    <td className="num" data-label="Logical size">
                      {formatBytes(t.byteLength)}
                    </td>
                    <td className="num" data-label="Goodput">
                      {t.metrics.goodputBytesPerSecond === null
                        ? "—"
                        : `${formatBytes(t.metrics.goodputBytesPerSecond)}/s`}
                    </td>
                    <td className="num" data-label="Verification">
                      {t.kind === "text"
                        ? "—"
                        : `${t.metrics.verificationMs.toFixed(1)} ms`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p>
          Goodput = unique acknowledged bytes ÷ elapsed upload time. A dash
          means no measurable duration. Retry bytes increase ingress, not useful
          content.
        </p>
      </section>
      <section className="panel">
        <h2>Room totals, without private details</h2>
        <p className="num">
          {room.aggregate.members} members · {room.aggregate.transfers}{" "}
          transfers · {formatBytes(room.aggregate.acknowledgedBytes)}{" "}
          acknowledged
        </p>
        <p>
          Other pairs’ filenames, content and detailed measurements are private.
          These are application measurements: not RTT, packet loss, TCP
          retransmissions, or proof of saving.
        </p>
      </section>
    </>
  );
}
