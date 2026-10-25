import { randomInt } from "node:crypto";
import { secret } from "../core/store";
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function invitation() {
  return {
    code: Array.from(
      { length: 10 },
      () => alphabet[randomInt(alphabet.length)],
    ).join(""),
    secret: secret(),
  };
}
