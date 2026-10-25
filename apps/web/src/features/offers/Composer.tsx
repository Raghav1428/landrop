import { useState } from "react";
import {
  LIMITS,
  offerSchema,
  utf8Bytes,
  type Snapshot,
  type SessionDto,
  type OfferInput,
} from "@landrop/protocol";
import { formatBytes } from "../../components/RelayProgress";
export type LocalContent = { files?: Map<string, File>; text?: string };
export function Composer({
  room,
  me,
  onOffer,
  busy,
}: {
  room: Snapshot;
  me: SessionDto;
  onOffer: (offer: OfferInput, content: LocalContent) => void;
  busy: boolean;
}) {
  const [recipient, setRecipient] = useState("");
  const [kind, setKind] = useState<"files" | "text">("files");
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const recipients = room.members.filter((m) => m.id !== me.id);
  const selected = recipients.find((m) => m.id === recipient);
  const choose = (list: File[]) => {
    if (list.length > LIMITS.files) {
      setError(`Choose at most ${LIMITS.files} files.`);
      return;
    }
    setError("");
    setFiles(list);
  };
  const metadata = files.map((f, i) => ({
    id: `file-${i}`,
    name: f.name,
    size: f.size,
  }));
  const offer = {
    kind,
    recipientId: recipient,
    ...(kind === "files"
      ? { files: metadata }
      : { byteLength: utf8Bytes(text) }),
  };
  const parsed = offerSchema.safeParse(offer);
  return (
    <form
      className="stack composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (parsed.success)
          onOffer(
            parsed.data,
            kind === "text"
              ? { text }
              : { files: new Map(files.map((f, i) => [`file-${i}`, f])) },
          );
      }}
    >
      <p>
        Only the offer is sent now. Content stays here until the receiver
        accepts.
      </p>
      <label htmlFor="recipient">Recipient</label>
      <select
        id="recipient"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        required
      >
        <option value="">Choose a device</option>
        {recipients.map((m) => (
          <option key={m.id} value={m.id} disabled={!m.online}>
            {m.name}
            {m.online ? "" : " (offline)"}
          </option>
        ))}
      </select>
      {!recipients.length && (
        <small>Invite another device before sending.</small>
      )}
      <div className="segmented" aria-label="Content type">
        <button
          type="button"
          aria-pressed={kind === "files"}
          onClick={() => setKind("files")}
        >
          Files
        </button>
        <button
          type="button"
          aria-pressed={kind === "text"}
          onClick={() => setKind("text")}
        >
          Text
        </button>
      </div>
      {kind === "files" ? (
        <>
          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              choose([...e.dataTransfer.files]);
            }}
          >
            <label>
              Choose files
              <input
                type="file"
                multiple
                onChange={(e) => choose([...(e.target.files ?? [])])}
              />
            </label>
            <span>or drop them here</span>
          </div>
          <small>
            Up to {LIMITS.files} files · {formatBytes(LIMITS.offerBytes)} total
          </small>
          {files.length > 0 && (
            <ul className="file-picks">
              {files.map((file, i) => (
                <li key={i}>
                  <span>{file.name}</span>
                  <span className="num">{formatBytes(file.size)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <label>
            Message
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
            />
          </label>
          <small
            className={utf8Bytes(text) > LIMITS.textBytes ? "negative" : "num"}
          >
            {utf8Bytes(text).toLocaleString()} /{" "}
            {LIMITS.textBytes.toLocaleString()} UTF-8 bytes
          </small>
        </>
      )}
      {error && (
        <p role="alert" className="negative">
          {error}
        </p>
      )}
      {!parsed.success &&
        (files.length > 0 || text.length > 0) &&
        recipient && (
          <small>Check file names and size limits before sending.</small>
        )}
      <button
        className="primary"
        disabled={busy || !selected?.online || !parsed.success}
      >
        Send offer
      </button>
      <small>
        Unanswered offers expire in two minutes. Keep this page open while
        sending.
      </small>
    </form>
  );
}
