import { describe, it, expect } from "vitest";
import {
  offerSchema,
  identitySchema,
  textSchema,
  canTransition,
  canFileTransition,
} from "./index";
describe("untrusted protocol input", () => {
  const file = { id: "f1", name: "report.pdf", size: 1 };
  const offer = { kind: "files", recipientId: "recipient", files: [file] };
  it("accepts empty and exact size files but rejects unsafe numbers", () => {
    expect(
      offerSchema.safeParse({ ...offer, files: [{ ...file, size: 0 }] })
        .success,
    ).toBe(true);
    expect(
      offerSchema.safeParse({
        ...offer,
        files: [{ ...file, size: 2147483648 }],
      }).success,
    ).toBe(true);
    for (const size of [-1, 0.5, NaN, Infinity, 2147483649, "1"])
      expect(
        offerSchema.safeParse({ ...offer, files: [{ ...file, size }] }).success,
      ).toBe(false);
  });
  it("enforces count, sum, unique IDs and metadata-only consent", () => {
    for (const files of [
      [],
      Array.from({ length: 21 }, (_, i) => ({ ...file, id: `f${i}` })),
      [file, file],
      [
        { ...file, size: 2147483648 },
        { ...file, id: "f2" },
      ],
    ])
      expect(offerSchema.safeParse({ ...offer, files }).success).toBe(false);
    expect(offerSchema.safeParse({ ...offer, content: "secret" }).success).toBe(
      false,
    );
    expect(
      offerSchema.safeParse({
        kind: "text",
        recipientId: "r",
        byteLength: 1,
        text: "x",
      }).success,
    ).toBe(false);
  });
  it("rejects unsafe names and counts UTF-8 bytes", () => {
    for (const name of ["../a", "a\\b", "a\r\n.txt", "", "a".repeat(256)])
      expect(
        offerSchema.safeParse({ ...offer, files: [{ ...file, name }] }).success,
      ).toBe(false);
    expect(textSchema.safeParse({ text: "😀".repeat(16384) }).success).toBe(
      true,
    );
    expect(textSchema.safeParse({ text: "😀".repeat(16385) }).success).toBe(
      false,
    );
    expect(
      identitySchema.safeParse({ name: "", device: "phone" }).success,
    ).toBe(false);
  });
  it("forbids skipped and terminal transitions", () => {
    expect(canTransition("offered", "accepted")).toBe(true);
    expect(canTransition("offered", "completed")).toBe(false);
    expect(canTransition("completed", "accepted")).toBe(false);
    expect(canFileTransition("queued", "ready")).toBe(false);
    expect(canFileTransition("verifying", "ready")).toBe(true);
  });
});
