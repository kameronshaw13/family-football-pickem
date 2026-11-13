export type AppSlug = "shaw-family" | "other-family" | "friends" | "friends-basketball";
export type RuleSection = { title: string; items: string[] };

type PickRule = {
  regularTotal?: number;
  cfbMinimum?: number;
  nflMinimum?: number;
  underdogTotal?: number;
  perfectBonus?: boolean;
};

export type GroupRules = {
  sport?: string;
  calendar?: { startDate?: string; endDateExclusive?: string; tournamentStartDate?: string; tournamentEndDateExclusive?: string };
  eligibleLeagues?: string[];
  excludedTeams?: string[];
  pickRules?: { default?: PickRule; weekOverrides?: Record<string, PickRule> };
  scoring?: { mode?: "record" | "confidence"; pushMultiplier?: number };
  underdog?: { enabled?: boolean; minimumSpread?: number; tiers?: Array<{ min?: number; max?: number | null; bonusWins?: number }> };
  weeklyBank?: Record<string, number | string | boolean | null | undefined>;
  seasonPrizes?: Record<string, number | string | boolean | null | undefined>;
  sideBets?: { enabled?: boolean; maxAmount?: number | null; maxPerWeek?: number | null; amountEntry?: string; fixedAmounts?: number[]; blockedUserIds?: string[] };
};

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function signedMoney(value: number) {
  return `${value >= 0 ? "+" : "-"}$${Math.abs(value)}`;
}

function pickRule(rules: GroupRules, week: number, fallback: PickRule) {
  return { ...fallback, ...(rules.pickRules?.default || {}), ...(rules.pickRules?.weekOverrides?.[String(week)] || {}) };
}

function dogItems(rules: GroupRules, pointsMode: boolean) {
  const tiers = rules.underdog?.tiers?.length ? rules.underdog.tiers : [
    { min: 7, max: 9.5, bonusWins: 1 },
    { min: 10, max: 19.5, bonusWins: 2 },
    { min: 20, max: null, bonusWins: 3 }
  ];
  const unit = pointsMode ? "point" : "win";
  const tierItems = tiers.map((tier) => {
    const minimum = numberValue(tier.min, 0);
    const maximum = tier.max == null ? null : numberValue(tier.max, minimum);
    const bonus = numberValue(tier.bonusWins, 0);
    return `${maximum == null ? `+${minimum} or more` : `+${minimum} to +${maximum}`}: +${bonus} ${unit}${bonus === 1 ? "" : "s"}.`;
  });
  return [...tierItems, pointsMode
    ? "Your dog must win outright for bonus points. A loss earns 0."
    : "Your dog must win outright for bonus wins. A loss earns 0 and does not count as a loss."];
}

function eligibleItems(rules: GroupRules) {
  const excluded = rules.excludedTeams || [];
  const items: string[] = [];
  if (excluded.some((team) => /chargers/i.test(team))) items.push("All Los Angeles Chargers games are excluded.");
  else if (excluded.length) items.push(`${excluded.join(", ")} games are excluded.`);
  items.push("Each CFB game must include at least one FBS team.", "Conference title games, bowl games, and CFP games are eligible.");
  return items;
}

function sideBetItems(rules: GroupRules, companion: boolean) {
  const settings = rules.sideBets || {};
  const fixed = settings.fixedAmounts?.length ? settings.fixedAmounts : [20, 15, 10, 5];
  const items = ["Spread and moneyline side bets are available."];
  if (companion || settings.amountEntry !== "free") items.push(`Side bets may be ${fixed.map((amount) => `$${amount}`).join(", ")}.`);
  else items.push("Choose your side bet amount.");
  if (settings.maxPerWeek == null) items.push("No weekly bet count limit.");
  else {
    const limit = numberValue(settings.maxPerWeek, 3);
    items.push(`Up to ${limit} side bets per player each week, including pending offers.`);
  }
  return [...items,
    "Offers open Tuesday at 8:00 AM CT. Pregame offers close at kickoff.",
    "Tuesday–Friday lines freeze 1 hour before kickoff; Saturday–Monday lines freeze Saturday at 10:00 AM CT.",
    "Live offers require a live market and close after a confirmed score change or the final whistle.",
    "Results post to the bank."
  ];
}

const seasonSchedule = [
  "The season runs for 20 weeks.",
  "It begins with two CFB-only weeks before NFL games begin and ends on the Monday after the final NFL regular-season games.",
  "Each week opens Tuesday and closes the following Monday."
];

const pickLocks = [
  "You can lock a pick early in My Card. This is permanent and freezes its line and dog bonus.",
  "Tuesday–Friday lines freeze 1 hour before kickoff; picks lock at kickoff.",
  "Saturday–Monday lines freeze Saturday at 10:00 AM CT; picks lock at 11:00 AM CT."
];

export function ruleSections(appSlug: AppSlug, rules: GroupRules = {}): RuleSection[] {
  if (appSlug === "friends-basketball") {
    const sections = ruleSections("friends", rules);
    return sections.map((section) => {
      if (section.title === "Season Schedule") return { ...section, items: ["November 1, 2026–April 11, 2027. Opening week is November 1–8; later weeks run Monday–Sunday, Central Time."] };
      if (section.title === "Weekly Card") return { ...section, items: ["Pick 5 CBB/NBA spreads and 1 dog each week. A perfect regular card earns the bonus."] };
      if (section.title === "Eligible Games") return { ...section, items: ["NBA regular season and Division I men's college games count, including conference tournaments and March Madness."] };
      if (section.title === "Pick Locks") return { ...section, items: [pickLocks[0], "Picks and lines lock 1 hour before tipoff."] };
      if (section.title === "Weekly Bank") return { ...section, items: [...section.items, "March Madness weeks (March 15–April 11) double every weekly payout after ties and perfect-week adjustments."] };
      if (section.title === "Side Bets") return { ...section, items: ["Spread, moneyline, and over/under bets are available.", "Pregame offers close at tipoff. Live offers close after a confirmed score change or when the game ends.", "Bets use credit; no deposit is needed. Players settle up later."] };
      return section;
    });
  }
  const week1 = pickRule(rules, 1, { regularTotal: 3, cfbMinimum: 3, nflMinimum: 0, underdogTotal: 1, perfectBonus: false });
  const week2 = pickRule(rules, 2, { regularTotal: 5, cfbMinimum: 5, nflMinimum: 0, underdogTotal: 1, perfectBonus: true });
  const mixed = pickRule(rules, 3, { regularTotal: 5, cfbMinimum: appSlug === "friends" ? 0 : 1, nflMinimum: appSlug === "friends" ? 0 : 1, underdogTotal: 1, perfectBonus: true });

  if (appSlug === "other-family") {
    const pushMultiplier = numberValue(rules.scoring?.pushMultiplier, 0.5);
    return [
      { title: "Season Schedule", items: seasonSchedule },
      { title: "Weekly Card", items: [
        `Weeks 1–2: ${week2.regularTotal} CFB regular spread picks plus ${week2.underdogTotal} underdog.`,
        `Weeks 3–20: ${mixed.regularTotal} regular spread picks, including at least ${mixed.cfbMinimum} CFB pick and ${mixed.nflMinimum} NFL pick, plus ${mixed.underdogTotal} underdog.`
      ] },
      { title: "Confidence Points", items: [
        `Rank the ${mixed.regularTotal} regular picks in My Card from ${mixed.regularTotal} points (most confident) down to 1 point.`,
        `A winning regular spread pick earns its confidence value. A push earns ${pushMultiplier} of its confidence value, and a loss earns 0 points.`,
        "When a game locks, it stays in its assigned point slot. Unlocked picks may still move among the remaining slots."
      ] },
      { title: "Eligible Games", items: eligibleItems(rules) },
      { title: "Underdog", items: dogItems(rules, true) },
      { title: "Standings", items: [
        "Season and weekly standings are ranked by total points.",
        "Points ties are broken by regular-pick wins, then fewer regular-pick losses, then pushes.",
        "The season prize is winner-take-all using the season pot Caleb submits once during Week 1.",
        "The season pot locks immediately after submission. Tied winners split it evenly.",
        "The total season-pot loss is divided equally among all players outside first place. If every player is tied, there is no payment."
      ] },
      { title: "Weekly Bank", items: [
        "Each week is winner-take-all using the Week pot Caleb submits in the Bank tab.",
        "The weekly pot locks immediately after submission.",
        "Caleb must submit the weekly pot before selecting a Tuesday–Friday game.",
        "Tied winners split the pot evenly. The total loss is divided equally among all players outside first place.",
        "If every player is tied, there is no payment."
      ] },
      { title: "Pick Locks", items: pickLocks },
      { title: "Side Bets", items: sideBetItems(rules, true) }
    ];
  }

  if (appSlug === "friends") {
    const prizes = rules.seasonPrizes || {};
    const weekly = rules.weeklyBank || {};
    return [
      { title: "Season Schedule", items: seasonSchedule },
      { title: "Weekly Card", items: [
        `Week 1: ${week1.regularTotal} regular spread picks plus ${week1.underdogTotal} dog.`,
        `Week 2: ${week2.regularTotal} regular spread picks plus ${week2.underdogTotal} dog.`,
        `Weeks 3–20: ${mixed.regularTotal} regular spread picks plus ${mixed.underdogTotal} dog.`,
        `There is no required CFB/NFL mix. All ${mixed.regularTotal} regular picks may be CFB, all NFL, or any combination.`
      ] },
      { title: "Eligible Games", items: eligibleItems(rules) },
      { title: "Underdog", items: dogItems(rules, false) },
      { title: "Standings", items: [
        "Weekly standings are ranked by win percentage. Season standings are ranked by win percentage, with total wins used when percentages are equal.",
        `Season payouts: 1st ${signedMoney(numberValue(prizes.first, 200))}, 2nd ${signedMoney(numberValue(prizes.second, 100))}, 3rd ${signedMoney(numberValue(prizes.third, 50))}, 4th ${signedMoney(numberValue(prizes.fourth, 0))}, 5th ${signedMoney(numberValue(prizes.fifth, -50))}, 6th ${signedMoney(numberValue(prizes.sixth, -75))}, 7th ${signedMoney(numberValue(prizes.seventh, -100))}, 8th ${signedMoney(numberValue(prizes.eighth, -125))}.`,
        "If players remain tied for payout positions, they share the average payout for the positions they occupy."
      ] },
      { title: "Weekly Bank", items: [
        `Normal weekly payouts: 1st ${signedMoney(numberValue(weekly.first, 40))}, 2nd ${signedMoney(numberValue(weekly.second, 20))}, 3rd ${signedMoney(numberValue(weekly.third, 0))}, 4th ${signedMoney(numberValue(weekly.fourth, 0))}, 5th ${signedMoney(numberValue(weekly.fifth, 0))}, 6th ${signedMoney(numberValue(weekly.sixth, -10))}, 7th ${signedMoney(numberValue(weekly.seventh, -20))}, 8th ${signedMoney(numberValue(weekly.eighth, -30))}.`,
        "If players finish a week tied for a payout position, they share the average payout for the positions they occupy."
      ] },
      { title: "Perfect Week", items: [
        "Does not apply in Week 1.",
        "A perfect week changes the payouts to: 1st +$60, 2nd +$20, 3rd +$0, 4th +$0, 5th +$0, 6th -$15, 7th -$25, 8th -$40.",
        "The 1.5× perfect-week bonus applies to first place only; second place remains +$20."
      ] },
      { title: "Pick Locks", items: pickLocks },
      { title: "Side Bets", items: [...sideBetItems(rules, true), "Side Bets are credit-based: no deposit or positive balance required. Players settle up later."] }
    ];
  }

  const prizes = rules.seasonPrizes || {};
  const weekly = rules.weeklyBank || {};
  return [
    { title: "Season Schedule", items: [
      "The season runs for 20 weeks.",
      "It begins with two CFB-only weeks before NFL games start and ends Sunday, Jan. 10, after the final NFL regular-season games.",
      "Each week runs from Tuesday through the following Monday."
    ] },
    { title: "Weekly Card", items: [
      `Week 1: ${week1.regularTotal} CFB picks plus ${week1.underdogTotal} dog.`,
      `Week 2: ${week2.regularTotal} CFB picks plus ${week2.underdogTotal} dog.`,
      `Weeks 3–20: ${mixed.regularTotal} picks, including at least ${mixed.cfbMinimum} CFB and ${mixed.nflMinimum} NFL pick, plus ${mixed.underdogTotal} dog.`
    ] },
    { title: "Eligible Games", items: eligibleItems(rules) },
    { title: "Underdog", items: dogItems(rules, false) },
    { title: "Standings", items: [
      "Season and weekly standings are ranked by win percentage. Win-percentage ties are broken by total wins.",
      `The season winner wins $${numberValue(prizes.first, 300)}.`,
      `Second place loses $${Math.abs(numberValue(prizes.second, -100))}.`,
      `Last place loses $${Math.abs(numberValue(prizes.last, -200))}.`
    ] },
    { title: "Weekly Bank", items: [
      `Last place pays first place $${numberValue(weekly.lastPaysWinner, 20)}.`,
      `Second place pays first place $${numberValue(weekly.secondPaysWinner, 10)}.`,
      `If last place is tied, each tied player pays first place $${numberValue(weekly.tiedLastPaysEach, 15)}.`,
      `If first place is tied, the tied players split $${numberValue(weekly.tiedFirstPool, 20)} from last place.`,
      "A three-way tie has no payment."
    ] },
    { title: "Perfect Week", items: ["Does not apply in Week 1.", "A perfect card doubles every weekly payment."] },
    { title: "Pick Locks", items: pickLocks },
    { title: "Side Bets", items: sideBetItems(rules, false) }
  ];
}
