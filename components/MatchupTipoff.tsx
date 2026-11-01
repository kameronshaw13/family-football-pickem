import { formatOrdinalDate, matchupDateFormatter } from "@/lib/displayDates";

const weekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/Chicago" });

export default function MatchupTipoff({ commenceTime }: { commenceTime: string }) {
  const date = new Date(commenceTime);
  return <div className="matchup-preview-kickoff">
    <span>{Number.isFinite(date.getTime()) ? weekdayFormatter.format(date) : "Date unavailable"}</span>
    <span>{formatOrdinalDate(matchupDateFormatter, date)} CT</span>
  </div>;
}
