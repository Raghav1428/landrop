import { LIMITS, isUnfinished } from "@landrop/protocol";
import { type Store, type Room, type Session, fault, id } from "../core/store";
import type { Config } from "../config";
import { invitation } from "./invitations";
export class Rooms {
  onRevoke: (room: Room, memberId?: string) => void = () => {};
  constructor(
    readonly store: Store,
    readonly c: Config,
    readonly now: () => number,
    readonly mono: () => number,
  ) {}
  byId(id: string) {
    const r = this.store.rooms.get(id);
    if (!r || r.closed) fault(404, "NOT_FOUND", "Room unavailable");
    const owner = [...this.store.sessions.values()].find(
      (s) => s.id === r.ownerId,
    );
    const active = [...this.store.transfers.values()].some(
      (t) =>
        t.roomId === r.id &&
        !t.revoked &&
        isUnfinished(t.state) &&
        t.state !== "offered" &&
        this.now() - t.progressAt < LIMITS.stalledMs,
    );
    if (
      r.expiresAt <= this.now() ||
      !owner ||
      owner.expiresAt <= this.now() ||
      (!active && this.now() - r.activity >= LIMITS.idleMs)
    ) {
      this.close(r);
      fault(410, "EXPIRED", "Room expired");
    }
    return r;
  }
  member(id: string, s: Session) {
    const r = this.byId(id);
    if (!r.members.has(s.id)) fault(403, "FORBIDDEN", "Not a room member");
    return r;
  }
  owner(id: string, s: Session) {
    const r = this.member(id, s);
    if (r.ownerId !== s.id) fault(403, "FORBIDDEN", "Owner action only");
    return r;
  }
  touch(r: Room) {
    r.activity = this.now();
    this.changed(r);
  }
  changed(r: Room) {
    r.revision++;
    const msg = JSON.stringify({ roomId: r.id, revision: r.revision });
    for (const s of this.store.sessions.values())
      if (r.members.has(s.id))
        for (const socket of s.sockets)
          if (socket.readyState === 1 && socket.bufferedAmount < 65536)
            socket.send(msg);
  }
  create(s: Session) {
    if (s.roomId) fault(409, "CONFLICT", "Leave your current room first");
    if (
      [...this.store.rooms.values()].filter((r) => !r.closed).length >=
      this.c.maxRooms
    )
      fault(503, "CAPACITY", "Room capacity reached");
    let inv = invitation();
    while ([...this.store.rooms.values()].some((r) => r.code === inv.code))
      inv = invitation();
    const r: Room = {
      id: id(),
      ownerId: s.id,
      ...inv,
      members: new Set([s.id]),
      banned: new Set(),
      locked: false,
      expiresAt: Math.min(this.now() + LIMITS.roomMs, s.expiresAt),
      activity: this.now(),
      revision: 1,
      closed: false,
    };
    this.store.rooms.set(r.id, r);
    s.roomId = r.id;
    s.offlineAt = this.now();
    return r;
  }
  join(
    s: Session,
    input: { code: string } | { roomId: string; secret: string },
  ) {
    const r =
      "code" in input
        ? [...this.store.rooms.values()].find(
            (r) => !r.closed && r.code === input.code,
          )
        : this.store.rooms.get(input.roomId);
    if (!r || ("secret" in input && r.secret !== input.secret))
      fault(404, "NOT_FOUND", "Invitation unavailable");
    this.byId(r.id);
    if (r.banned.has(s.id))
      fault(403, "FORBIDDEN", "You have left or been removed from this room");
    if (r.members.has(s.id)) return r;
    if (s.roomId) fault(409, "CONFLICT", "Leave your current room first");
    if (r.locked) fault(403, "FORBIDDEN", "Room is locked");
    if (r.members.size >= LIMITS.members)
      fault(409, "CAPACITY", "Room is full");
    r.members.add(s.id);
    s.roomId = r.id;
    s.offlineAt = this.now();
    this.touch(r);
    return r;
  }
  remove(r: Room, memberId: string) {
    if (memberId === r.ownerId) {
      this.close(r);
      return;
    }
    if (!r.members.has(memberId)) fault(404, "NOT_FOUND", "Member unavailable");
    this.onRevoke(r, memberId);
    r.members.delete(memberId);
    r.banned.add(memberId);
    for (const s of this.store.sessions.values())
      if (s.id === memberId) {
        s.roomId = undefined;
        for (const ws of s.sockets) ws.close(1008, "Membership ended");
      }
    this.touch(r);
  }
  close(r: Room) {
    if (r.closed) return;
    r.closed = true;
    this.onRevoke(r);
    this.changed(r);
    for (const s of this.store.sessions.values())
      if (r.members.has(s.id)) {
        s.roomId = undefined;
        for (const ws of s.sockets) ws.close(1008, "Room closed");
      }
  }
}
