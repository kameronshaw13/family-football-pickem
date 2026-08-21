"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import NumericText from "@/components/NumericText";

type AppSlug = "other-family" | "friends";
type RuleSection = { title: string; items: string[] };

const SHARED_SEASON = [
  "The season runs for 20 weeks.",
  "It begins with two CFB-only weeks before NFL games start and ends after the final NFL regular-season games.",
  "Each week runs from Tuesday through the following Monday."
];

const SHARED_ELIGIBLE = [
  "Each CFB game must include at least one FBS team.",
  "Conference title games, bowl games, and CFP games are eligible."
];

function eligibleRules(slug: AppSlug) {
  return slug === "other-family" ? SHARED_ELIGIBLE : ["Chargers games are ineligible.", ...SHARED_ELIGIBLE];
}

const SHARED_LOCKS = [
  "Tuesday–Friday lines freeze 1 hour before kickoff.",
  "Tuesday–Friday picks lock at kickoff.",
  "Saturday–Monday lines freeze Friday at 7:00 PM CT.",
  "Saturday–Monday picks lock Friday at 8:00 PM CT."
];

const SHARED_SIDE_BET_TIMING = [
  "Offers open Tuesday at 8:00 AM CT with the new week.",
  "Tuesday–Friday lines freeze 1 hour before kickoff.",
  "Saturday–Monday lines freeze Friday at 7:00 PM CT.",
  "Offers may be sent or accepted until kickoff.",
  "Settled bets post directly to the bank."
];

function rulesFor(slug: AppSlug): RuleSection[] {
  if (slug === "other-family") {
    return [
      { title: "Season Schedule", items: SHARED_SEASON },
      { title: "Weekly Card", items: [
        "Weeks 1–2: 5 CFB regular spread picks plus 1 underdog.",
        "Weeks 3–20: 5 regular spread picks, including at least 1 CFB and 1 NFL pick, plus 1 underdog."
      ] },
      { title: "Confidence Points", items: [
        "Rank the 5 regular picks in My Card from 5 points (most confident) down to 1 point.",
        "A winning regular spread pick earns its confidence value. A push earns half its confidence value, and a loss earns 0 points.",
        "When a game locks, it stays in its assigned point slot. Unlocked picks may still move among the remaining slots."
      ] },
      { title: "Eligible Games", items: eligibleRules(slug) },
      { title: "Underdog", items: [
        "+7 to +9.5: +1 point.",
        "+10 to +19.5: +2 points.",
        "+20 or more: +3 points.",
        "The dog must win outright.",
        "A losing dog earns 0 points and does not subtract points."
      ] },
      { title: "Standings", items: [
        "Season and weekly standings are ranked by total points.",
        "Points ties are broken by regular-pick wins, then fewer regular-pick losses, then pushes.",
        "The season prize is winner-take-all using the season pot Caleb submits once during Week 1.",
        "The season pot locks immediately after submission.",
        "The winner receives the season pot, and all remaining players split the contribution equally.",
        "If first place remains tied, the tied winners split the season pot."
      ] },
      { title: "Weekly Bank", items: [
        "Each week is winner-take-all using the Week pot Caleb submits in the Bank tab.",
        "The weekly pot locks immediately after submission.",
        "Caleb must submit the weekly pot before selecting a Tuesday–Friday game.",
        "The weekly winner receives the configured pot and the remaining players split the contribution equally.",
        "If first place remains tied, the tied winners split the pot.",
        "If every player is tied, there is no payment."
      ] },
      { title: "Pick Locks", items: SHARED_LOCKS },
      { title: "Side Bets", items: [
        "Spread bets only.",
        "Side bets may be $20, $15, $10, or $5.",
        "There is no weekly side-bet count limit.",
        ...SHARED_SIDE_BET_TIMING
      ] }
    ];
  }

  return [
    { title: "Season Schedule", items: SHARED_SEASON },
    { title: "Weekly Card", items: [
      "Week 1: 3 regular spread picks plus 1 dog.",
      "Week 2: 5 regular spread picks plus 1 dog.",
      "Weeks 3–20: 5 regular spread picks plus 1 dog.",
      "There is no required CFB/NFL mix. All 5 regular picks may be CFB, all NFL, or any combination."
    ] },
    { title: "Eligible Games", items: eligibleRules(slug) },
    { title: "Underdog", items: [
      "+7 to +9.5: +1 win.",
      "+10 to +19.5: +2 wins.",
      "+20 or more: +3 wins.",
      "The dog must win outright.",
      "A losing dog does not add a loss."
    ] },
    { title: "Standings", items: [
      "Season and weekly standings are ranked by win percentage.",
      "Win-percentage ties are broken by total wins.",
      "Season payouts: 1st +$150, 2nd +$50, 3rd -$30, 4th -$70, 5th -$100.",
      "If finishing positions remain tied after the normal tiebreakers, the payouts for the tied positions are shared evenly."
    ] },
    { title: "Weekly Bank", items: [
      "Weekly payouts: 1st +$20, 2nd +$10, 3rd -$5, 4th -$10, 5th -$15.",
      "If weekly positions remain tied after the normal tiebreakers, the payouts for the tied positions are shared evenly."
    ] },
    { title: "Perfect Week", items: [
      "Does not apply in Week 1.",
      "A perfect card doubles every weekly payment."
    ] },
    { title: "Pick Locks", items: SHARED_LOCKS },
    { title: "Side Bets", items: [
      "Spread bets only.",
      "Side bets may be $20, $15, $10, or $5.",
      "There is no weekly side-bet count limit.",
      ...SHARED_SIDE_BET_TIMING
    ] }
  ];
}

function FullRules({ slug }: { slug: AppSlug }) {
  return <div className="rules-list companion-full-rules">
    {rulesFor(slug).map((section) => <details className="rule-item" key={section.title}>
      <summary><strong>{section.title}</strong><ChevronDown className="rule-chevron" size={17} /></summary>
      <div className="rule-copy"><ul>{section.items.map((item) => <li key={item}><NumericText text={item} /></li>)}</ul></div>
    </details>)}
  </div>;
}

function ensureRulesHost(panel: HTMLElement) {
  let host = panel.querySelector<HTMLElement>(':scope > [data-companion-fine-host="rules"]');
  if (host) return host;
  host = document.createElement("div");
  host.dataset.companionFineHost = "rules";
  const notification = panel.querySelector<HTMLElement>(":scope > .notification-settings");
  const title = panel.querySelector<HTMLElement>(":scope > .section-title");
  if (notification) notification.insertAdjacentElement("afterend", host);
  else if (title) title.insertAdjacentElement("afterend", host);
  else panel.prepend(host);
  return host;
}

function normalizeSideBetSheet() {
  const sheet = document.querySelector<HTMLElement>(".side-bet-slip-sheet");
  if (!sheet) return;
  const summary = sheet.querySelector<HTMLElement>(".side-bet-slip-summary");
  const submit = sheet.querySelector<HTMLButtonElement>(".companion-side-bet-submit");
  if (summary && submit && summary.nextElementSibling !== submit) summary.insertAdjacentElement("afterend", submit);
}

export default function CompanionFineTune({ slug }: { slug: AppSlug }) {
  const [rulesHost, setRulesHost] = useState<HTMLElement | null>(null);

  const apply = useCallback(() => {
    const panel = document.querySelector<HTMLElement>(".rules-panel");
    if (panel) setRulesHost(ensureRulesHost(panel));
    normalizeSideBetSheet();
  }, []);

  useEffect(() => {
    let active = true;
    const timers = new Set<number>();
    const schedule = (delay: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (active) apply();
      }, delay);
      timers.add(timer);
    };
    const burst = () => [0, 50, 140, 320, 700].forEach(schedule);
    burst();
    schedule(1300);

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(".primary-nav button, .section-tabs button, .side-bet-slip-bar, .team-row.selectable, .side-bet-recipient-grid label, .companion-side-bet-submit, .custom-select-option")) return;
      burst();
    };
    const onRefresh = () => burst();
    document.addEventListener("click", onClick, true);
    window.addEventListener("pickem:companion-refresh", onRefresh);
    return () => {
      active = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pickem:companion-refresh", onRefresh);
    };
  }, [apply]);

  return rulesHost ? createPortal(<FullRules slug={slug} />, rulesHost) : null;
}
