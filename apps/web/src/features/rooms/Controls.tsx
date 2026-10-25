import { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import type { Snapshot, SessionDto, PublicConfig } from "@landrop/protocol";
export function Controls({
  room,
  me,
  config,
  act,
  confirm,
  toast,
}: {
  room: Snapshot;
  me: SessionDto;
  config: PublicConfig;
  act: (action: string, payload?: unknown) => void;
  confirm: (title: string, message: string, action: () => void) => void;
  toast: (s: string) => void;
}) {
  const [host, setHost] = useState(
    config.addresses.find(
      (a) => !a.includes("127.0.0.1") && !a.includes("localhost"),
    ) ?? location.origin,
  );
  const [qr, setQr] = useState("");
  const [manual, setManual] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);
  const owner = room.ownerId === me.id;
  const link = room.invitation
    ? `${host}/#invite=${room.id}.${room.invitation.secret}`
    : "";
  useEffect(() => {
    if (link)
      void QRCode.toDataURL(link, {
        margin: 2,
        width: 192,
        color: { dark: "#000000", light: "#ffffff" },
      }).then(setQr);
  }, [link]);
  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Manual");
      await navigator.clipboard.writeText(link);
      toast("Invitation copied.");
    } catch {
      linkRef.current?.focus();
      linkRef.current?.select();
      setManual(true);
    }
  };
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Invitations & controls</h1>
          <p>
            {owner
              ? "Manage who joins this temporary room."
              : "Only the owner can change invitations and membership."}
          </p>
        </div>
      </div>
      {owner && room.invitation && (
        <section className="panel invite-layout">
          <div className="stack">
            <h2>Invite a device</h2>
            <label>
              Connection address
              <select value={host} onChange={(e) => setHost(e.target.value)}>
                {config.addresses.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <small>
              Use a reachable LAN address on other devices. Localhost only opens
              this computer.
            </small>
            <label>
              Room code
              <input readOnly value={room.invitation.code} />
            </label>
            <label>
              Invitation link
              <input ref={linkRef} readOnly value={link} />
            </label>
            <div className="actions">
              <button onClick={copy}>Copy invitation</button>
              <button
                onClick={() =>
                  confirm(
                    "Rotate invitation",
                    "Old room codes and QR links will stop working. Joined members stay.",
                    () => act("rotate", {}),
                  )
                }
              >
                Rotate invitation
              </button>
            </div>
            {manual && (
              <p role="status">
                Link selected. Use Ctrl/Cmd+C or your browser’s Copy action.
              </p>
            )}
          </div>
          <figure className="qr">
            {qr && (
              <img
                src={qr}
                width="192"
                height="192"
                alt="QR invitation for this room"
              />
            )}
            <figcaption>Scan on a device that can reach this host.</figcaption>
          </figure>
        </section>
      )}
      <section className="panel">
        <div className="panel-head">
          <h2>Room access</h2>
          {owner && (
            <button onClick={() => act("lock", { locked: !room.locked })}>
              {room.locked ? "Unlock room" : "Lock room"}
            </button>
          )}
        </div>
        <p>
          {room.locked
            ? "Locked — new devices cannot join."
            : "Open — invited devices can join, up to 8 identities."}
        </p>
        {room.members.map((m) => (
          <div className="member-control" key={m.id}>
            <span>
              {m.name}
              <small>
                {m.owner ? "Room owner" : m.device} ·{" "}
                {m.online ? "online" : "offline"}
              </small>
            </span>
            {owner && !m.owner && (
              <button
                className="danger"
                onClick={() =>
                  confirm(
                    "Remove member",
                    `${m.name} will lose room and transfer access and cannot rejoin this room.`,
                    () => act("remove", { memberId: m.id }),
                  )
                }
              >
                Remove {m.name}
              </button>
            )}
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>Temporary by design</h2>
        <p>
          Expires {new Date(room.expiresAt).toLocaleString()}. Idle rooms close
          after 60 minutes. Files and text stay for up to 30 minutes while this
          room survives.
        </p>
        <p>
          Leaving revokes your transfers; an owner leaving closes the room for
          everyone. Deletion may continue after access is revoked.
        </p>
        <button
          className="danger"
          onClick={() =>
            confirm(
              owner ? "Close room" : "Leave room",
              owner
                ? "Everyone loses access immediately. Temporary storage will be cleaned up."
                : "You cannot rejoin this room, and your transfers will be revoked.",
              () => act(owner ? "close" : "leave", {}),
            )
          }
        >
          {owner ? "Close room" : "Leave room"}
        </button>
      </section>
    </>
  );
}
