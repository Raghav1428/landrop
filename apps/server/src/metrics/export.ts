import type { Session } from "../core/store";
import type { Transfers } from "../transfers/service";
import { transferDto } from "./service";
export function insights(service: Transfers, roomId: string, s: Session) {
  const r = service.rooms.member(roomId, s);
  const all = [...service.rooms.store.transfers.values()].filter(
    (t) => t.roomId === r.id && !t.revoked,
  );
  return {
    version: 1,
    scope: "participant",
    generatedAt: service.rooms.now(),
    units: {
      bytes: "bytes",
      time: "milliseconds",
      goodput: "bytes per second",
    },
    notice:
      "Application goodput is not bandwidth, RTT, packet loss or TCP retransmissions. Served bytes are not proof of saving.",
    aggregate: {
      members: r.members.size,
      transfers: all.length,
      acknowledgedBytes: all.reduce((n, t) => n + t.acknowledgedBytes, 0),
    },
    transfers: all
      .filter((t) => [t.senderId, t.recipientId].includes(s.id))
      .map((t) => transferDto(t, s, service.mono)),
  };
}
