export function normalizeSpreadForSelectedTeam(selectedTeam: string, spreadTeam: string | null, spread: number | null) {
  if (spread == null || !spreadTeam) return null;
  return selectedTeam === spreadTeam ? Number(spread) : Number(-spread);
}

export function formatSpread(team: string | null, spread: number | null) {
  if (spread == null || !team) return "No line";
  const value = spread > 0 ? `+${spread}` : `${spread}`;
  return `${team} ${value}`;
}

export function spreadText(spread: number | null) {
  if (spread == null) return "No line";
  return spread > 0 ? `+${spread}` : `${spread}`;
}

export function underdogWinValue(spread: number | null) {
  if (spread == null || spread < 7) return 0;
  if (spread >= 20) return 3;
  if (spread >= 10) return 2;
  return 1;
}

export function gradeAgainstSpread(selectedTeam: string, homeTeam: string, awayTeam: string, homeScore: number, awayScore: number, spread: number) {
  const selectedScore = selectedTeam === homeTeam ? homeScore : awayScore;
  const opponentScore = selectedTeam === homeTeam ? awayScore : homeScore;
  const adjusted = selectedScore + spread;
  if (adjusted > opponentScore) return "win" as const;
  if (adjusted < opponentScore) return "loss" as const;
  return "push" as const;
}

export function gradeUnderdogOutright(selectedTeam: string, homeTeam: string, awayTeam: string, homeScore: number, awayScore: number) {
  const selectedScore = selectedTeam === homeTeam ? homeScore : awayScore;
  const opponentScore = selectedTeam === homeTeam ? awayScore : homeScore;
  if (selectedScore > opponentScore) return "win" as const;
  if (selectedScore < opponentScore) return "loss" as const;
  return "push" as const;
}
