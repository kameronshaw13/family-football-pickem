export function ordinalDay(day: number) {
  return String(day);
}

/** Preserve locale punctuation and Central Time without ordinal day suffixes. */
export function formatOrdinalDate(formatter: Intl.DateTimeFormat, date: Date) {
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return formatter.format(date);
}

/** Uppercase a date label without adding ordinal day suffixes. */
export function formatUppercaseOrdinalDate(formatter: Intl.DateTimeFormat, date: Date) {
  if (!Number.isFinite(date.getTime())) return "DATE UNAVAILABLE";
  return formatter.format(date).toUpperCase();
}

export const matchupDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago"
});
