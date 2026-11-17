type Side = "away" | "home";
type Situation = Record<string, any> | null;
type Play = { team?: { id?: string }; period?: { number?: number }; type?: { text?: string }; text?: string };

function count(value: unknown) {
  const number = Number(value);
  return value == null || value === "" || !Number.isFinite(number) ? null : Math.max(0, Math.trunc(number));
}

/** Core's basketball situation uses flat homeTimeouts/homeFouls fields. */
export function basketballSituation(situation: Situation, side: Side, swapped: boolean, competitor: any, plays: Play[], period: number, college: boolean) {
  const providerSide = swapped ? side === "away" ? "home" : "away" : side;
  const timeouts = situation?.[`${providerSide}Timeouts`] ?? situation?.[providerSide]?.timeouts;
  const fouls = situation?.[`${providerSide}Fouls`] ?? situation?.[providerSide]?.fouls;
  const maxTimeouts = college ? 4 : 7;
  const used = count(competitor?.timeoutsUsed);
  const remaining = count(timeouts?.timeoutsRemainingCurrent) ?? count(competitor?.timeoutsRemaining ?? competitor?.timeouts)
    ?? (used == null ? null : Math.max(0, maxTimeouts - used));
  // College overtime continues the second-half team foul count.
  const periodFouls = plays.filter(play => {
    const playPeriod = Number(play.period?.number || 1);
    return (college && period >= 2 ? playPeriod >= 2 : playPeriod === period)
      && String(play.team?.id || "") === String(competitor?.team?.id || "")
      && /\bfoul\b/i.test(String(play.type?.text || play.text || ""));
  }).length;
  const rawBonus = String(fouls?.bonusState || "").toUpperCase();
  return {
    timeoutsRemaining: remaining == null ? null : Math.min(maxTimeouts, remaining),
    fouls: count(fouls?.teamFoulsCurrent) ?? (plays.length ? periodFouls : null),
    bonus: /DOUBLE/.test(rawBonus) ? 2 : /^(?:BONUS|IN_BONUS|SINGLE_BONUS)$/.test(rawBonus) ? 1 : /^(?:NONE|NO_BONUS|NOT_IN_BONUS)$/.test(rawBonus) ? 0 : null
  };
}
