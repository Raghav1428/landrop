import { useState } from "react";
export function Lobby({
  name,
  create,
  join,
  busy,
  invitation,
}: {
  name: string;
  create: () => void;
  join: (value: { code: string } | { roomId: string; secret: string }) => void;
  busy: boolean;
  invitation?: { roomId: string; secret: string };
}) {
  const [code, setCode] = useState("");
  return (
    <div className="stack">
      <h2>Connect as {name}</h2>
      <p>
        Create a temporary room, or use an invitation from someone on this host.
      </p>
      {invitation && (
        <button
          className="primary"
          disabled={busy}
          onClick={() => join(invitation)}
        >
          Join invitation
        </button>
      )}
      <button
        className={invitation ? "" : "primary"}
        onClick={create}
        disabled={busy}
      >
        Create room
      </button>
      <div className="join-separator">Already have a room?</div>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          join({ code: code.replace(/\s/g, "").toUpperCase() });
        }}
      >
        <label>
          Room code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={10}
            autoComplete="off"
            spellCheck={false}
            required
            aria-describedby="code-help"
          />
        </label>
        <small id="code-help">
          The 10-character code shown by the room owner.
        </small>
        <button disabled={busy || code.length !== 10}>Join room</button>
      </form>
    </div>
  );
}
