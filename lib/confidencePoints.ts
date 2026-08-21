import type { Pick } from "./types";

export function normalizeConfidenceCard(card: Pick[], regularTotal: number) {
  const regular = card.filter((pick) => pick.pick_type === "regular");
  const lockedValues = new Set(regular
    .filter((pick) => pick.status === "locked")
    .map((pick) => Number(pick.confidence_points))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= regularTotal));
  const availableValues = Array.from({ length: regularTotal }, (_, index) => regularTotal - index)
    .filter((value) => !lockedValues.has(value));
  const editable = regular
    .map((pick, index) => ({ pick, index }))
    .filter(({ pick }) => pick.status !== "locked")
    .sort((a, b) => Number(b.pick.confidence_points || 0) - Number(a.pick.confidence_points || 0) || a.index - b.index);
  const pointsByGame = new Map(editable.map(({ pick }, index) => [pick.game_id, availableValues[index] ?? null]));

  return card.map((pick) => {
    if (pick.pick_type !== "regular" || pick.status === "locked") return pick;
    const confidencePoints = pointsByGame.get(pick.game_id);
    return pick.confidence_points === confidencePoints ? pick : { ...pick, confidence_points: confidencePoints };
  });
}

export function moveConfidencePick(picks: Pick[], index: number, direction: -1 | 1, regularTotal: number) {
  if (picks[index]?.status === "locked") return picks;
  let target = index + direction;
  while (target >= 0 && target < picks.length && picks[target]?.status === "locked") target += direction;
  if (target < 0 || target >= picks.length) return picks;

  const reordered = [...picks];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  return reordered.map((pick, slot) => pick.status === "locked"
    ? pick
    : { ...pick, confidence_points: Math.max(1, regularTotal - slot) });
}
