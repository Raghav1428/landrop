import type { Snapshot, SessionDto, TransferDto } from "@landrop/protocol";
import { formatBytes } from "../../components/RelayProgress";
import { Status } from "../../components/Status";
export function TransferList({
  room,
  me,
  onSelect,
  decide,
}: {
  room: Snapshot;
  me: SessionDto;
  onSelect: (id: string) => void;
  decide: (t: TransferDto, action: "accept" | "reject") => void;
}) {
  const incoming = room.transfers.filter(
    (t) => t.recipientId === me.id && t.state === "offered",
  );
  const recent = room.transfers
    .filter((t) => !incoming.includes(t))
    .slice()
    .reverse();
  const name = (id: string) =>
    room.members.find((m) => m.id === id)?.name ?? "Departed member";
  const label = (t: TransferDto) =>
    t.kind === "text"
      ? "Plain-text message"
      : t.files.map((f) => f.name).join(", ");
  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <h2>Incoming approvals</h2>
          <span className="muted num">{incoming.length} waiting</span>
        </div>
        {incoming.length === 0 ? (
          <p className="empty">
            No offers waiting. Nothing uploads without your approval.
          </p>
        ) : (
          incoming.map((t) => (
            <article className="offer-row" key={t.id}>
              <div className="offer-summary">
                <strong>{label(t)}</strong>
                <span>
                  {name(t.senderId)} → You · {formatBytes(t.byteLength)}
                </span>
                <small>
                  Expires{" "}
                  {new Date(t.expiresAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </div>
              <div className="actions">
                <button onClick={() => onSelect(t.id)}>Review</button>
                <button onClick={() => decide(t, "reject")}>Reject</button>
                <button className="primary" onClick={() => decide(t, "accept")}>
                  Accept
                </button>
              </div>
            </article>
          ))
        )}
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Your transfers</h2>
          <span className="muted num">{recent.length}</span>
        </div>
        {recent.length === 0 ? (
          <p className="empty">
            Files and messages you send or receive will appear here.
          </p>
        ) : (
          recent.map((t) => (
            <button
              className="transfer-row"
              key={t.id}
              onClick={() => onSelect(t.id)}
            >
              <span className="transfer-identity">
                <strong>{label(t)}</strong>
                <span>
                  {t.senderId === me.id ? "You" : name(t.senderId)} →{" "}
                  {t.recipientId === me.id ? "You" : name(t.recipientId)}
                </span>
              </span>
              <span className="transfer-meta">
                <Status state={t.state} />
                <span className="num">{formatBytes(t.byteLength)}</span>
              </span>
              <span aria-hidden="true">↗</span>
            </button>
          ))
        )}
      </section>
    </>
  );
}
