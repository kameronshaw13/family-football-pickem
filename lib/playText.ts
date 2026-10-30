/** Hide only a duplicated leading clock token, including ESPN's optional
 * parentheses and leading-zero form. Do not change in-play timestamps. */
export function playTextWithoutDuplicateClock(text: string, clock: string | null | undefined) {
  const time = String(clock || "").trim();
  if (!time) return text;
  const normalize = (value: string) => value.replace(/^0(?=\d:)/, "");
  const match = text.match(/^\s*\(?\s*(\d{1,2}:\d{2})\s*\)?(?=$|[\s,–—:-])(?:\s*[-–—:,]\s*|\s+)?/);
  if (!match || normalize(match[1]) !== normalize(time)) return text;
  return text.slice(match[0].length).trimStart();
}
