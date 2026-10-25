import type { Config } from "../config";
import { type Store, type Transfer, fault } from "../core/store";
export function reserve(store: Store, c: Config, t: Transfer) {
  if (t.reserved) return;
  if (t.kind === "files") {
    if (store.diskReserved + t.byteLength > c.diskBudget)
      fault(507, "CAPACITY", "Temporary file storage is full");
    store.diskReserved += t.byteLength;
  } else {
    if (store.textReserved + t.byteLength > c.textBudget)
      fault(507, "CAPACITY", "Temporary text storage is full");
    store.textReserved += t.byteLength;
  }
  t.reserved = true;
}
export function release(store: Store, t: Transfer) {
  if (!t.reserved) return;
  if (t.kind === "files") store.diskReserved -= t.byteLength;
  else store.textReserved -= t.byteLength;
  t.reserved = false;
}
