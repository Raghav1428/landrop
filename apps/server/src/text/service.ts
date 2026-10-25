import { utf8Bytes } from "@landrop/protocol";
import { type Session, type Transfer, fault } from "../core/store";
import type { Transfers } from "../transfers/service";
export function deliver(
  service: Transfers,
  t: Transfer,
  s: Session,
  text: string,
) {
  if (t.kind !== "text") fault(409, "CONFLICT", "Not a text offer");
  if (s.id !== t.senderId) fault(403, "FORBIDDEN", "Sender action only");
  if (t.state === "completed") {
    t.ingressBytes += utf8Bytes(text);
    if (t.text !== text) fault(409, "CONFLICT", "Conflicting text replay");
    return;
  }
  service.writable(t, s);
  if (utf8Bytes(text) !== t.byteLength)
    fault(400, "VALIDATION", "Text UTF-8 bytes differ from offer");
  t.startedAt = service.mono();
  t.text = text;
  t.acknowledgedBytes = t.byteLength;
  t.ingressBytes += t.byteLength;
  t.finishedAt = service.mono();
  t.state = "transferring";
  service.complete(t);
}
