import { formatOrdinalDate, matchupDateFormatter } from "@/lib/displayDates";

export default function MatchupTipoff({ commenceTime }: { commenceTime: string }) {
  const date = new Date(commenceTime);
  if (!Number.isFinite(date.getTime())) return <div className="matchup-preview-kickoff">Date unavailable</div>;
  return <time className="matchup-preview-kickoff" dateTime={commenceTime}>
    {formatOrdinalDate(matchupDateFormatter, date)} CT
  </time>;
}
