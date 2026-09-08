const POSITION_KEYS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"] as const;

function finiteNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positionValues(source: any, fallback: number[]) {
  return POSITION_KEYS.map((key, index) => finiteNumber(source?.[key], fallback[index] ?? 0));
}

export function friendsWeeklyPositionPayouts(bankRules: any, perfect: boolean) {
  const regular = positionValues(bankRules, [
    finiteNumber(bankRules?.winner, 40),
    20,
    0,
    0,
    0,
    -10,
    -20,
    -30
  ]);
  if (!perfect) return regular;

  const explicitPerfect = bankRules?.perfectPayouts;
  if (explicitPerfect && typeof explicitPerfect === "object") {
    return positionValues(explicitPerfect, regular);
  }

  const configuredMultiplier = finiteNumber(bankRules?.perfectMultiplier, 1.5);
  const multiplier = configuredMultiplier > 0 ? configuredMultiplier : 1.5;
  return regular.map((value) => value * multiplier);
}
