import type { Snapshot } from "@landrop/protocol";
import type { Room, Session } from "../core/store";
import type { Rooms } from "./service";
import { transferDto } from "../metrics/service";
export function snapshot(rooms: Rooms, r: Room, s: Session): Snapshot {
  const all = [...rooms.store.transfers.values()].filter(
    (t) => t.roomId === r.id && !t.revoked,
  );
  return {
    id: r.id,
    revision: r.revision,
    ownerId: r.ownerId,
    locked: r.locked,
    expiresAt: r.expiresAt,
    members: [...rooms.store.sessions.values()]
      .filter((m) => r.members.has(m.id))
      .map((m) => ({
        id: m.id,
        name: m.name,
        device: m.device,
        online: m.sockets.size > 0 && m.expiresAt > rooms.now(),
        owner: m.id === r.ownerId,
      })),
    transfers: all
      .filter((t) => [t.senderId, t.recipientId].includes(s.id))
      .map((t) => transferDto(t, s, rooms.mono)),
    aggregate: {
      members: r.members.size,
      transfers: all.length,
      acknowledgedBytes: all.reduce((n, t) => n + t.acknowledgedBytes, 0),
    },
    ...(r.ownerId === s.id
      ? { invitation: { code: r.code, secret: r.secret } }
      : {}),
  };
}
