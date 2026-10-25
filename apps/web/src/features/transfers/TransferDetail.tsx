import { useRef, useState } from "react";
import {
  isUnfinished,
  type SessionDto,
  type Snapshot,
  type TransferDto,
} from "@landrop/protocol";
import { RelayProgress, formatBytes } from "../../components/RelayProgress";
import { Status } from "../../components/Status";
export function TransferDetail({
  transfer: t,
  room,
  me,
  decide,
  remove,
  hasContent,
  error,
  retry,
  toast,
}: {
  transfer: TransferDto;
  room: Snapshot;
  me: SessionDto;
  decide: (t: TransferDto, action: "accept" | "reject") => void;
  remove: (t: TransferDto) => void;
  hasContent: boolean;
  error?: string;
  retry: () => void;
  toast: (s: string) => void;
}) {
  const text = useRef<HTMLTextAreaElement>(null);
  const [manual, setManual] = useState(false);
  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Manual");
      await navigator.clipboard.writeText(t.text ?? "");
      toast("Text copied.");
    } catch {
      setManual(true);
      text.current?.focus();
      text.current?.select();
    }
  };
  return (
    <div className="stack detail">
      <div className="panel-head">
        <Status state={t.state} />
        <span className="num muted">{formatBytes(t.byteLength)}</span>
      </div>
      <p>
        {room.members.find((m) => m.id === t.senderId)?.name ?? "Sender"} →{" "}
        {room.members.find((m) => m.id === t.recipientId)?.name ?? "Receiver"}
      </p>
      <RelayProgress
        state={t.state}
        committed={t.metrics.acknowledgedBytes}
        total={t.byteLength}
        ready={t.state === "completed"}
        downloadRequested={t.files.some((f) => f.downloadRequested)}
      />
      {t.senderId === me.id && isUnfinished(t.state) && !hasContent && (
        <p role="alert" className="notice">
          This page no longer has the original content. An unfinished send
          cannot resume after refresh. Cancel it and send a new offer. Another
          open sender tab may still be sending.
        </p>
      )}
      {error && (
        <div role="alert">
          <p className="negative">Sending paused: {error}</p>
          <button onClick={retry}>Retry send</button>
        </div>
      )}
      {t.files.map((f) => (
        <div className="file-detail" key={f.id}>
          <strong>{f.name}</strong>
          <div className="panel-head">
            <span>{f.state}</span>
            <span className="num">
              {formatBytes(f.committedBytes)} / {formatBytes(f.size)}
            </span>
          </div>
          {f.state === "ready" && me.id === t.recipientId && (
            <a
              className="button primary"
              href={`/api/transfers/${t.id}/files/${f.id}/download`}
            >
              Download {f.name}
            </a>
          )}
          {f.downloadRequested && (
            <small>Download requested · saving is not observable</small>
          )}
        </div>
      ))}
      {t.text !== undefined && (
        <>
          <label>
            Received message
            <textarea ref={text} readOnly value={t.text} rows={7} />
          </label>
          <div className="actions">
            <button onClick={copy}>Copy text</button>
            <a className="button" href={`/api/transfers/${t.id}/text`}>
              Download text
            </a>
          </div>
          {manual && (
            <p role="status">
              Text selected. Use your browser’s Copy action or Ctrl/Cmd+C.
            </p>
          )}
        </>
      )}
      {t.state === "offered" && t.recipientId === me.id && (
        <div className="actions">
          <button onClick={() => decide(t, "reject")}>Reject</button>
          <button className="primary" onClick={() => decide(t, "accept")}>
            Accept
          </button>
        </div>
      )}
      <small>
        Content expires by {new Date(t.expiresAt).toLocaleTimeString()}. A
        download request is not proof the file was saved.
      </small>
      <button className="danger" onClick={() => remove(t)}>
        {isUnfinished(t.state) ? "Cancel transfer" : "Delete transfer"}
      </button>
    </div>
  );
}
