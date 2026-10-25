import type { ReactNode } from "react";
import type { Snapshot, SessionDto } from "@landrop/protocol";
export type View = "room" | "insights" | "controls";
export function Mark() {
  return (
    <svg
      viewBox="0 0 32 32"
      width="30"
      height="30"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 9h8v14H3M21 9h8v14h-8M11 16h10m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function AppShell({
  room,
  me,
  view,
  setView,
  connected,
  children,
}: {
  room: Snapshot;
  me: SessionDto;
  view: View;
  setView: (v: View) => void;
  connected: boolean;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="/" className="brand">
          <Mark />
          LANDrop
        </a>
        <p className="scope">Temporary room</p>
        <nav aria-label="Main navigation">
          <button
            aria-current={view === "room" ? "page" : undefined}
            onClick={() => setView("room")}
          >
            Room
          </button>
          <button
            aria-current={view === "insights" ? "page" : undefined}
            onClick={() => setView("insights")}
          >
            Network insights
          </button>
          <button
            aria-current={view === "controls" ? "page" : undefined}
            onClick={() => setView("controls")}
          >
            Invitations & controls
          </button>
        </nav>
        <div className="sidebar-members">
          <h2>
            Joined devices <span className="num">{room.members.length}/8</span>
          </h2>
          {room.members.map((m) => (
            <div className="member" key={m.id}>
              <span
                className={`presence ${m.online ? "online" : ""}`}
                aria-label={m.online ? "online" : "offline"}
              />
              <div>
                <strong>
                  {m.name}
                  {m.id === me.id ? " (you)" : ""}
                </strong>
                <small>
                  {m.device}
                  {m.owner ? " · owner" : ""}
                </small>
              </div>
            </div>
          ))}
        </div>
        <div className="identity-footer">
          <span>{me.name}</span>
          <small>
            {connected ? "Live room updates" : "Disconnected · reconnecting"}
          </small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Sender <span aria-hidden="true">→</span> Host{" "}
            <span aria-hidden="true">→</span> Receiver
          </span>
          <span className="muted">
            {room.locked ? "Locked room" : "Open room"} ·{" "}
            <span className="num">{room.members.length}/8 devices</span>
          </span>
        </header>
        <main id="main-content">
          {!connected && (
            <p className="notice" role="status">
              Live updates disconnected. Reconnecting; snapshots also refresh
              periodically. Sending may pause.
            </p>
          )}
          {children}
        </main>
        <footer className="trust">
          {location.protocol === "http:"
            ? "HTTP is unencrypted. "
            : "HTTPS protects transport, not content from the host. "}
          The host operator can access shared content. Use a trusted local
          network.
        </footer>
      </div>
    </div>
  );
}
