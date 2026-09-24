export function ordinalDay(day: number) {
  const lastTwo = day % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] || "th";
  return `${day}${suffix}`;
}

/** Preserve locale punctuation and Central Time, changing only the displayed day. */
export function formatOrdinalDate(formatter: Intl.DateTimeFormat, date: Date) {
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return formatter.formatToParts(date).map(part => part.type === "day" ? ordinalDay(Number(part.value)) : part.value).join("");
}

/** Uppercase a date label while preserving the ordinal suffix in lowercase. */
export function formatUppercaseOrdinalDate(formatter: Intl.DateTimeFormat, date: Date) {
  return formatOrdinalDate(formatter, date)
    .toUpperCase()
    .replace(/(\d+)(ST|ND|RD|TH)\b/g, (_, day: string, suffix: string) => `${day}${suffix.toLowerCase()}`);
}

export const matchupDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago"
});
