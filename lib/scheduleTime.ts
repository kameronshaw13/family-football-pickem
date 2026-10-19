const MAX_TBD_KICKOFF_DISTANCE_MS = 36 * 60 * 60 * 1000;

// ESPN's TBD timestamp is a date placeholder, not an exact kickoff. Only a
// nearby provider or saved time can establish the real kickoff for that date.
export function isVerifiedTbdKickoff(candidate: string | null | undefined, placeholder: string): boolean {
  if (!candidate) return false;
  const difference = Math.abs(new Date(candidate).getTime() - new Date(placeholder).getTime());
  return Number.isFinite(difference) && difference > 60 * 1000 && difference <= MAX_TBD_KICKOFF_DISTANCE_MS;
}
