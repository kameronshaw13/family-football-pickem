export function normalizeSpreadForSelectedTeam(selectedTeam: string, spreadTeam: string | null, spread: number | null) {
  if (spreadTeam == null || spread == null) return null;
  return selectedTeam === spreadTeam ? spread : -spread;
}

export function gradeAgainstSpread(params: {
  selectedTeam: string;
  lockedSpreadTeam: string;
  lockedSpread: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}) {
  const { selectedTeam, lockedSpreadTeam, lockedSpread, homeTeam, awayTeam, homeScore, awayScore } = params;
  const selectedScore = selectedTeam === homeTeam ? homeScore : awayScore;
  const opponentScore = selectedTeam === homeTeam ? awayScore : homeScore;
  const selectedSpread = selectedTeam === lockedSpreadTeam ? lockedSpread : -lockedSpread;
  const marginWithSpread = selectedScore + selectedSpread - opponentScore;
  if (Math.abs(marginWithSpread) < 0.0001) return "push" as const;
  return marginWithSpread > 0 ? "win" as const : "loss" as const;
}

export function formatSpread(team: string | null, spread: number | null) {
  if (!team || spread == null) return "No line";
  const value = spread > 0 ? `+${spread}` : `${spread}`;
  return `${team} ${value}`;
}
