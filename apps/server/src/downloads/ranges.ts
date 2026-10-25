export type ByteRange = { start: number; end: number };
export function parseRange(
  header: string | undefined,
  size: number,
): ByteRange | null | "invalid" {
  if (header === undefined) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!m || (!m[1] && !m[2]) || size === 0) return "invalid";
  const a = m[1] ? Number(m[1]) : undefined,
    b = m[2] ? Number(m[2]) : undefined;
  if (
    (a !== undefined && !Number.isSafeInteger(a)) ||
    (b !== undefined && !Number.isSafeInteger(b))
  )
    return "invalid";
  if (a === undefined) {
    if (!b || b < 1) return "invalid";
    return { start: Math.max(0, size - b), end: size - 1 };
  }
  if (a >= size || (b !== undefined && b < a)) return "invalid";
  return { start: a, end: Math.min(b ?? size - 1, size - 1) };
}
