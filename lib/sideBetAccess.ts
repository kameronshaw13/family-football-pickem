/**
 * Controls whether a player may use the Side Bets feature in a league.
 * User IDs are configured per league under group_seasons.rules.sideBets.blockedUserIds.
 */
export function isSideBetRestricted(
  rules: { sideBets?: { blockedUserIds?: string[]; enabled?: boolean } } | null | undefined,
  profileId: string
): boolean {
  return Boolean(profileId && rules?.sideBets?.blockedUserIds?.includes(profileId));
}
