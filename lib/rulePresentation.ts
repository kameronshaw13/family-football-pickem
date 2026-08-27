export type AppSlug = "shaw-family" | "other-family" | "friends";
export type RuleSection = { title: string; items: string[] };

type PickRule = {
  regularTotal?: number;
  cfbMinimum?: number;
  nflMinimum?: number;
  underdogTotal?: number;
  perfectBonus?: boolean;
};

export type GroupRules = {
  eligibleLeagues?: string[];
  excludedTeams?: string[];
  pickRules?: { default?: PickRule; weekOverrides?: Record<string, PickRule> };
  scoring?: { mode?: "record" | "confidence"; pushMultiplier?: number };
  underdog?: { enabled?: boolean; minimumSpread?: number; tiers?: Array<{ min?: number; max?: number | null; bonusWins?: number }> };
  weeklyBank?: Record<string, number | string | boolean | null | undefined>;
  seasonPrizes?: Record<string, number | string | boolean | null | undefined>;
  sideBets?: { enabled?: boolean; maxAmount?: number | null; maxPerWeek?: number | null; amountEntry?: string; fixedAmounts?: number[] };
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
  return [...tierItems, "The dog must win outright.", pointsMode
    ? "A winning dog adds its tier value to the weekly and season point totals. A losing dog earns 0 points."
    : "A losing dog earns 0 bonus wins and does not add a loss."];
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
  const items = ["Spread bets only."];
  if (companion || settings.amountEntry !== "free") items.push(`Side bets may be ${fixed.map((amount) => `$${amount}`).join(", ")}.`);
  else items.push(`Maximum: $${numberValue(settings.maxAmount, 20)} per bet.`);
  if (settings.maxPerWeek == null) items.push("There is no weekly side-bet count limit.");
  else {
    const limit = numberValue(settings.maxPerWeek, 3);
    items.push(`Each player has ${limit} side-bet slots per week.`, `Accepted and pending offers count toward the ${limit}-bet limit.`);
  }
  return [...items,
    "Offers open Tuesday at 8:00 AM CT with the new week.",
    "Tuesday–Friday lines freeze 1 hour before kickoff.",
    "Saturday–Monday lines freeze Saturday at 9:00 AM CT.",
    "Offers may be sent or accepted until kickoff.",
    "Settled bets post directly to the bank."
  ];
}

const seasonSchedule = [
  "The season runs for 20 weeks.",
  "It begins with two CFB-only weeks before NFL games begin and ends on the Monday after the final NFL regular-season games.",
  "Each week opens Tuesday and closes the following Monday."
];

const pickLocks = [
  "Tuesday–Friday lines freeze 1 hour before kickoff.",
  "Tuesday–Friday picks lock at kickoff.",
  "Saturday–Monday lines freeze Saturday at 9:00 AM CT.",
  "Saturday–Monday picks lock Saturday at 10:00 AM CT."
];

export function ruleSections(appSlug: AppSlug, rules: GroupRules = {}): RuleSection[] {
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
    const perfectMultiplier = numberValue(weekly.perfectMultiplier, 1.5);
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
        `Weekly payouts: 1st ${signedMoney(numberValue(weekly.first, 40))}, 2nd ${signedMoney(numberValue(weekly.second, 20))}, 3rd ${signedMoney(numberValue(weekly.third, 0))}, 4th ${signedMoney(numberValue(weekly.fourth, 0))}, 5th ${signedMoney(numberValue(weekly.fifth, 0))}, 6th ${signedMoney(numberValue(weekly.sixth, -10))}, 7th ${signedMoney(numberValue(weekly.seventh, -20))}, 8th ${signedMoney(numberValue(weekly.eighth, -30))}.`,
        "If players finish a week tied for a payout position, they share the average payout for the positions they occupy."
      ] },
      { title: "Perfect Week", items: ["Does not apply in Week 1.", `A perfect card multiplies all eight weekly payout amounts by ${perfectMultiplier}.`] },
      { title: "Pick Locks", items: pickLocks },
      { title: "Side Bets", items: sideBetItems(rules, true) }
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
