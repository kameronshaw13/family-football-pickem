type Side = "away" | "home";
type Situation = Record<string, any> | null;
type Play = { id?: string; team?: { id?: string }; period?: { number?: number }; clock?: { displayValue?: string }; type?: { text?: string }; text?: string };

function count(value: unknown) {
  const number = Number(value);
  return value == null || value === "" || !Number.isFinite(number) ? null : Math.max(0, Math.trunc(number));
}

/** Reconstruct team timeouts only when the feed includes the start of the game. */
function collegeTimeouts(plays: Play[], teamId: string, period: number) {
  if (!plays.some(play => Number(play.period?.number) === 1 && (/start game/i.test(play.text || "") || play.clock?.displayValue === "20:00"))) return null;
  const teamTimeouts = plays.filter(play => String(play.team?.id || "") === teamId && /time\s*out/i.test(`${play.type?.text || ""} ${play.text || ""}`) && !/official|media|TV/i.test(`${play.type?.text || ""} ${play.text || ""}`));
  let short = 3, full = 1;
  for (let p = 1; p <= period; p++) {
    if (p === 2) short = Math.min(short, 2);
    if (p > 2) short++;
    for (const timeout of teamTimeouts.filter(play => Number(play.period?.number || 1) === p)) {
      if (/regular|full|60.second/i.test(`${timeout.type?.text || ""} ${timeout.text || ""}`) && full > 0) full--;
      else if (short > 0) short--;
      else full = Math.max(0, full - 1);
    }
  }
  return short + full;
}

/** Core's basketball situation uses flat homeTimeouts/homeFouls fields. */
export function basketballSituation(situation: Situation, side: Side, swapped: boolean, competitor: any, plays: Play[], period: number, college: boolean) {
  const providerSide = swapped ? side === "away" ? "home" : "away" : side;
  // Some games expose an all-zero placeholder even after recorded fouls.
  // Use the complete play log rather than treating that placeholder as live data.
  const placeholder = ["home", "away"].every(key => count(situation?.[`${key}Timeouts`]?.timeoutsRemainingCurrent) === 0 && count(situation?.[`${key}Fouls`]?.teamFoulsCurrent) === 0)
    && plays.some(play => /foul/i.test(`${play.type?.text || ""} ${play.text || ""}`));
  const live = placeholder ? null : situation;
  const timeouts = live?.[`${providerSide}Timeouts`] ?? live?.[providerSide]?.timeouts;
  const fouls = live?.[`${providerSide}Fouls`] ?? live?.[providerSide]?.fouls;
  const maxTimeouts = college ? 4 + Math.max(0, period - 2) : 7;
  const used = count(competitor?.timeoutsUsed);
  const remaining = count(timeouts?.timeoutsRemainingCurrent) ?? count(competitor?.timeoutsRemaining ?? competitor?.timeouts)
    ?? (used == null ? null : Math.max(0, maxTimeouts - used))
    ?? (college ? collegeTimeouts(plays, String(competitor?.team?.id || ""), period) : null);
  // College overtime continues the second-half team foul count. ESPN uses
  // compact type names (PersonalFoul), so also match the readable play text.
  const periodFouls = plays.filter(play => {
    const playPeriod = Number(play.period?.number || 1);
    return (college && period >= 2 ? playPeriod >= 2 : playPeriod === period)
      && String(play.team?.id || "") === String(competitor?.team?.id || "")
      && /foul/i.test(`${play.type?.text || ""} ${play.text || ""}`)
      && !/foul\s*(?:drawn|on opponent)/i.test(`${play.type?.text || ""} ${play.text || ""}`);
  }).length;
  const rawBonus = String(fouls?.bonusState || "").toUpperCase();
  return {
    timeoutsRemaining: remaining == null ? null : Math.min(maxTimeouts, remaining),
    fouls: count(fouls?.teamFoulsCurrent) ?? (plays.length ? periodFouls : null),
    bonus: /DOUBLE/.test(rawBonus) ? 2 : /^(?:BONUS|IN_BONUS|SINGLE_BONUS)$/.test(rawBonus) ? 1 : /^(?:NONE|NO_BONUS|NOT_IN_BONUS)$/.test(rawBonus) ? 0 : null
  };
}
