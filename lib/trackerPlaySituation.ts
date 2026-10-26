export function trackerNumber(value: unknown): number | null {
  if (value == null || (typeof value === "string" && !value.trim()) || !["string", "number"].includes(typeof value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

type Play = {
  type?: { text?: string };
  text?: string;
  shortText?: string;
  start?: { possessionText?: string; yardLine?: number | string; yardsToEndzone?: number; team?: { id?: string }; downDistanceText?: string; shortDownDistanceText?: string };
  end?: { downDistanceText?: string; shortDownDistanceText?: string };
};

export function trackerPlaySituation(play: Play, abbreviations: Record<string, string> = {}) {
  const start = play.start;
  const text = play.text || play.shortText || "";
  if (/kickoff/i.test(`${play.type?.text || ""} ${text}`)) {
    // The kickoff belongs to the kicker, even when ESPN puts it in the
    // receiving team's drive. The play text explicitly names that yard line.
    const from = text.match(/\bfrom\s+([A-Z][A-Z0-9&.-]*)\s+(\d{1,2})\b/i);
    if (from) return `${from[1].toUpperCase()} ${from[2]}`;
    const direct = start?.possessionText || start?.downDistanceText?.match(/\bat\s+(.+)$/i)?.[1] || "";
    if (/[a-z]/i.test(direct)) return direct.trim();
    const teamId = String(start?.team?.id || "");
    const toGoal = trackerNumber(start?.yardsToEndzone);
    if (abbreviations[teamId] && toGoal != null && toGoal >= 0 && toGoal <= 100) {
      const side = toGoal >= 50 ? teamId : Object.keys(abbreviations).find(id => id !== teamId);
      if (side && abbreviations[side]) return `${abbreviations[side]} ${Math.min(toGoal, 100 - toGoal)}`;
    }
    return "";
  }
  return String(start?.downDistanceText || start?.shortDownDistanceText || play.end?.downDistanceText || play.end?.shortDownDistanceText || "");
}
