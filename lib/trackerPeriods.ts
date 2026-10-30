/** Canonical display labels for ESPN periods, including football overtime. */
export function trackerPeriodLabel(period: string) {
  const raw = String(period || "").trim();
  if (!raw) return "Game";
  const overtime = raw.match(/^(?:OT|overtime)\s*(\d+)?$/i) || raw.match(/^(\d+)\s*(?:OT|overtime)$/i);
  if (overtime) {
    const number = Number(overtime[1]);
    return Number.isFinite(number) && number > 0 ? `${number}OT` : "OT";
  }
  const number = Number(raw.match(/\d+/)?.[0]);
  if (Number.isFinite(number)) {
    if (number === 1) return "1st";
    if (number === 2) return "2nd";
    if (number === 3) return "3rd";
    if (number === 4) return "4th";
    if (number > 4) return `${number - 4}OT`;
  }
  return raw;
}

/** Overtime is a period, not another numbered quarter. */
export function trackerPeriodHeading(period: string) {
  const label = trackerPeriodLabel(period);
  return /^(?:\d+)?OT$/i.test(label) ? label : label === "Game" ? "Game" : `${label} Quarter`;
}
