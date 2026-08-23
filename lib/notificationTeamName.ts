import { teamDisplayName } from "@/lib/teamNames";

export function notificationTeamName(team: string, league?: string | null) {
  return teamDisplayName(league, team);
}
