import { useCallback, useEffect, useRef, useState } from "react";
import {
  sessionSchema,
  snapshotSchema,
  type SessionDto,
  type Snapshot,
  type PublicConfig,
  type Identity,
  type TransferDto,
  type OfferInput,
} from "@landrop/protocol";
import { request, setCsrf, RequestError } from "./api/client";
import { subscribe } from "./api/realtime";
import { IdentityForm } from "./features/identity/IdentityForm";
import { Lobby } from "./features/rooms/Lobby";
import { Controls } from "./features/rooms/Controls";
import { Composer, type LocalContent } from "./features/offers/Composer";
import { TransferList } from "./features/transfers/TransferList";
import { TransferDetail } from "./features/transfers/TransferDetail";
import { useTransfers } from "./features/transfers/useTransfers";
import { Insights } from "./features/insights/Insights";
import { AppShell, Mark, type View } from "./components/AppShell";
import { Dialog } from "./components/Dialog";
import { Toast } from "./components/Toast";
export function App() {
  const [me, setMe] = useState<SessionDto>();
  const [room, setRoom] = useState<Snapshot>();
  const [roomId, setRoomId] = useState<string>();
  const [config, setConfig] = useState<PublicConfig>();
  const [view, setView] = useState<View>("room");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [composer, setComposer] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    action: () => void;
  }>();
  const [invitation] = useState(() => {
    const value = new URLSearchParams(location.hash.slice(1)).get("invite");
    if (!value) return;
    history.replaceState(null, "", location.pathname + location.search);
    const [roomId, secret] = value.split(".");
    if (roomId && /^[a-f0-9]{64}$/.test(secret ?? ""))
      return { roomId, secret };
  });
  const fetching = useRef(false);
  const showError = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : "Unable to reach host");
  }, []);
  const init = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setConfig(await request("GET", "/api/config"));
      try {
        const s = sessionSchema.parse(await request("GET", "/api/session"));
        setCsrf(s.csrfToken);
        setMe(s);
        setRoomId(s.roomId);
      } catch (e) {
        if (!(e instanceof RequestError && e.status === 401)) throw e;
      }
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [showError]);
  useEffect(() => {
    void init();
  }, [init]);
  const refresh = useCallback(() => {
    if (!roomId || fetching.current) return;
    fetching.current = true;
    void request("GET", `/api/rooms/${roomId}`)
      .then((raw) => {
        setRoom(snapshotSchema.parse(raw));
      })
      .catch((e) => {
        if (
          e instanceof RequestError &&
          [401, 403, 404, 410].includes(e.status)
        ) {
          setRoom(undefined);
          setRoomId(undefined);
          setSelected(undefined);
          setToast(
            "Room unavailable: it was closed, expired, or your membership ended.",
          );
          if (e.status === 401) {
            setMe(undefined);
            setCsrf("");
          }
        } else showError(e);
      })
      .finally(() => {
        fetching.current = false;
      });
  }, [roomId, showError]);
  useEffect(() => {
    if (!roomId) return;
    refresh();
    const stop = subscribe(roomId, refresh, setConnected);
    const interval = setInterval(refresh, 5000);
    return () => {
      stop();
      clearInterval(interval);
    };
  }, [roomId, refresh]);
  const sends = useTransfers(room, me, refresh);
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      return await fn();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  const identify = (v: Identity) => {
    void run(async () => {
      const s = sessionSchema.parse(await request("POST", "/api/session", v));
      setCsrf(s.csrfToken);
      setMe(s);
    });
  };
  const enter = (path: string, body: unknown) => {
    void run(async () => {
      const r = snapshotSchema.parse(await request("POST", path, body));
      setRoom(r);
      setRoomId(r.id);
      setView("room");
    });
  };
  const act = (action: string, payload: unknown = {}) => {
    if (!room) return;
    void run(async () => {
      const result = await request(
        "POST",
        `/api/rooms/${room.id}/${action}`,
        payload,
      );
      if (result.closed) {
        setRoom(undefined);
        setRoomId(undefined);
        setToast("Access revoked. Temporary storage cleanup is scheduled.");
      } else setRoom(snapshotSchema.parse(result));
    });
  };
  const decide = (t: TransferDto, action: "accept" | "reject") => {
    void run(async () => {
      await request("POST", `/api/transfers/${t.id}/${action}`, {});
      if (action === "accept") setSelected(t.id);
      refresh();
    });
  };
  const offer = (input: OfferInput, content: LocalContent) => {
    if (!room) return;
    void run(async () => {
      const t: TransferDto = await request(
        "POST",
        `/api/rooms/${room.id}/offers`,
        input,
      );
      setRoom((r) => (r ? { ...r, transfers: [...r.transfers, t] } : r));
      sends.remember(t.id, content);
      setComposer(false);
      setSelected(t.id);
      refresh();
    });
  };
  const remove = (t: TransferDto) => {
    setConfirmation({
      title: "Delete transfer",
      message:
        "Both participants lose access immediately. Storage cleanup may continue afterward.",
      action: () => {
        void run(async () => {
          sends.abort(t.id);
          const result = await request("DELETE", `/api/transfers/${t.id}`);
          setSelected(undefined);
          setToast(
            result.cleanupPending
              ? "Access revoked. Host cleanup is pending; capacity remains held until deletion succeeds."
              : "Access revoked. Host cleanup has finished.",
          );
          refresh();
        });
      },
    });
  };
  const detail = room?.transfers.find((t) => t.id === selected);
  const errorView = error && (
    <div role="alert" className="error-box">
      <span>{error}</span>
      <div className="actions">
        <button
          onClick={() => {
            setError("");
            if (roomId) refresh();
            else void init();
          }}
        >
          Retry
        </button>
        <button onClick={() => setError("")}>Dismiss error</button>
      </div>
    </div>
  );
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {room && me && config ? (
        <AppShell
          room={room}
          me={me}
          view={view}
          setView={setView}
          connected={connected}
        >
          {errorView}
          {view === "room" ? (
            <>
              <div className="page-title">
                <div>
                  <h1>Room</h1>
                  <p>
                    Share with joined devices. Every transfer starts with
                    approval.
                  </p>
                </div>
                <button className="primary" onClick={() => setComposer(true)}>
                  Send
                </button>
              </div>
              <div className="room-grid">
                <div className="stack">
                  <TransferList
                    room={room}
                    me={me}
                    onSelect={setSelected}
                    decide={decide}
                  />
                </div>
                <aside className="room-reference">
                  <section className="panel">
                    <h2>The relay path</h2>
                    <div className="reference-path">
                      <span>Sender</span>
                      <span>→</span>
                      <span>Host</span>
                      <span>→</span>
                      <span>Receiver</span>
                    </div>
                    <p>
                      Upload begins after approval. The host verifies SHA-256
                      before a download becomes available.
                    </p>
                    <dl className="reference-facts">
                      <div>
                        <dt>Room expiry</dt>
                        <dd>
                          {new Date(room.expiresAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </dd>
                      </div>
                      <div>
                        <dt>File retention</dt>
                        <dd>Up to 30 min</dd>
                      </div>
                      <div>
                        <dt>File offer limit</dt>
                        <dd>20 files · 2 GiB</dd>
                      </div>
                    </dl>
                    <button onClick={() => setView("controls")}>
                      Invite a device
                    </button>
                  </section>
                  <section className="panel">
                    <h2>Keep the sender open</h2>
                    <p>
                      Short interruptions can recover from host checkpoints.
                      Refreshing loses selected files and cannot resume an
                      unfinished send.
                    </p>
                    <button onClick={() => setView("insights")}>
                      View network insights
                    </button>
                  </section>
                </aside>
              </div>
            </>
          ) : view === "insights" ? (
            <Insights room={room} />
          ) : (
            <Controls
              room={room}
              me={me}
              config={config}
              act={act}
              confirm={(title, message, action) =>
                setConfirmation({ title, message, action })
              }
              toast={setToast}
            />
          )}
        </AppShell>
      ) : (
        <div className="first-run">
          <header>
            <a className="brand" href="/">
              <Mark />
              LANDrop
            </a>
            <span className="muted">Local network sharing</span>
          </header>
          <main id="main-content">
            <div className="page-title">
              <div>
                <h1>Share across your network</h1>
                <p>
                  Files and plain text. One temporary host, no cloud or
                  accounts.
                </p>
              </div>
            </div>
            {errorView}
            <div className="welcome-grid">
              <section className="panel">
                {loading ? (
                  <p role="status">Connecting to the host…</p>
                ) : me ? (
                  <Lobby
                    name={me.name}
                    create={() => enter("/api/rooms", {})}
                    join={(v) => enter("/api/rooms/join", v)}
                    busy={busy}
                    invitation={invitation}
                  />
                ) : (
                  <IdentityForm submit={identify} busy={busy} />
                )}
              </section>
              <aside className="welcome-help">
                <div className="reference-path">
                  <span>Sender</span>
                  <span>→</span>
                  <span>Host</span>
                  <span>→</span>
                  <span>Receiver</span>
                </div>
                <h2>Local, with your approval.</h2>
                <p>
                  A sender offers content. You choose whether to receive it. The
                  host temporarily stores verified files for your browser to
                  download.
                </p>
                <dl className="reference-facts">
                  <div>
                    <dt>Join</dt>
                    <dd>Room code or QR</dd>
                  </div>
                  <div>
                    <dt>Room capacity</dt>
                    <dd>8 browser identities</dd>
                  </div>
                  <div>
                    <dt>Content</dt>
                    <dd>Up to 2 GiB / offer</dd>
                  </div>
                  <div>
                    <dt>Text</dt>
                    <dd>64 KiB UTF-8</dd>
                  </div>
                </dl>
                <details>
                  <summary>Connecting another device</summary>
                  <p>
                    Open this computer’s LAN IPv4 address on the other device.
                    Localhost points to the device you’re using, not this host.
                    Guest Wi-Fi, VPNs and firewalls may prevent a connection.
                  </p>
                  {config?.addresses.map((a) => (
                    <p key={a} className="address">
                      {a}
                    </p>
                  ))}
                  <p>
                    After installation and build, no internet connection is
                    needed. Both devices must still reach this host.
                  </p>
                </details>
              </aside>
            </div>
          </main>
          <footer className="trust">
            {config?.encrypted
              ? "HTTPS transport enabled."
              : "HTTP is unencrypted."}{" "}
            The host operator can access shared content. Use a trusted local
            network.
          </footer>
        </div>
      )}
      {composer && room && me && (
        <Dialog title="Send an offer" onClose={() => setComposer(false)}>
          <Composer room={room} me={me} onOffer={offer} busy={busy} />
        </Dialog>
      )}
      {detail && room && me && !composer && (
        <Dialog
          title={detail.kind === "text" ? "Text transfer" : "File transfer"}
          onClose={() => setSelected(undefined)}
        >
          <TransferDetail
            transfer={detail}
            room={room}
            me={me}
            decide={decide}
            remove={remove}
            hasContent={sends.hasContent(detail.id)}
            error={sends.errors[detail.id]}
            retry={() => sends.retry(detail.id)}
            toast={setToast}
          />
        </Dialog>
      )}
      {confirmation && (
        <Dialog
          title={confirmation.title}
          onClose={() => setConfirmation(undefined)}
        >
          <p>{confirmation.message}</p>
          <div className="actions">
            <button onClick={() => setConfirmation(undefined)}>Keep it</button>
            <button
              className="primary"
              onClick={() => {
                confirmation.action();
                setConfirmation(undefined);
              }}
            >
              Confirm
            </button>
          </div>
        </Dialog>
      )}
      {toast && <Toast message={toast} dismiss={() => setToast("")} />}
    </>
  );
}
