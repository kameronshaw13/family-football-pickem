type Side = "away" | "home";
type Play = {
  id?: string;
  text?: string;
  type?: { text?: string };
  team?: { id?: string };
  period?: { number?: number };
  clock?: { displayValue?: string };
  shootingPlay?: boolean;
  scoringPlay?: boolean;
  scoreValue?: number;
};

function playSide(play: Play, awayId: string, homeId: string): Side | null {
  const id = String(play.team?.id || "");
  if (!id) return null;
  return id === awayId ? "away" : id === homeId ? "home" : null;
}

/** ESPN does not publish a basketball possession flag; use only clear changes of possession. */
export function basketballLiveState(plays: Play[], awayId: string, homeId: string) {
  let possessionSide: Side | null = null;
  for (let index = plays.length - 1; index >= 0; index--) {
    const play = plays[index];
    const side = playSide(play, awayId, homeId);
    if (!side) continue;
    const type = String(play.type?.text || "").toLowerCase();
    if (/rebound|jumpball|jump ball|steal/.test(type)) {
      possessionSide = side;
      break;
    }
    if (type.includes("turnover") || (play.shootingPlay && play.scoringPlay && Number(play.scoreValue) > 0 && !type.includes("free throw"))) {
      possessionSide = side === "away" ? "home" : "away";
      break;
    }
    // A missed shot leaves the ball loose until the next recorded rebound.
    if (play.shootingPlay && !play.scoringPlay) break;
  }

  const latest = [...plays].reverse().find((play) => {
    const type = String(play.type?.text || "").toLowerCase();
    return play.text && !/substitution|start period|end period/.test(type);
  });
  return {
    possessionSide,
    latestAction: latest ? {
      id: String(latest.id || ""),
      text: String(latest.text),
      side: playSide(latest, awayId, homeId),
      period: Number(latest.period?.number || 1),
      clock: String(latest.clock?.displayValue || "")
    } : null
  };
}
