/** Hide only a duplicated leading game-clock token, never an in-play time. */
export function playTextWithoutDuplicateClock(text: string, clock: string | null | undefined) {
  const time = String(clock || "").trim();
  if (!time) return text;
  const trimmed = text.trimStart();
  if (!trimmed.startsWith(time)) return text;
  const after = trimmed.slice(time.length);
  if (!/^(?:\s|[-–—,])/.test(after)) return text;
  return after.replace(/^\s*(?:[-–—,]\s*)?/, "");
}
