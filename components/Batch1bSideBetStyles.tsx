"use client";

import { useEffect } from "react";

const STYLES = `
.side-bet-card.has-clear-offer-action{display:block!important;height:auto!important;min-height:111px!important;padding-bottom:10px!important}
.side-bet-card.has-clear-offer-action>.clear-offer-actions{display:flex!important;position:static!important;z-index:2;margin-top:8px!important;justify-content:flex-end!important;pointer-events:auto}
.side-bet-card.has-clear-offer-action>.clear-offer-actions .btn{position:relative;z-index:3;pointer-events:auto}
.manual-lock-review-backdrop{padding-bottom:calc(54px + env(safe-area-inset-bottom))!important}
.manual-lock-review .confirmation-matchup{margin-top:0!important;border-block:1px solid var(--line-strong)!important}
.manual-lock-review .confirmation-matchup>div.manual-lock-pick-cell{background:var(--panel)!important;box-shadow:none!important}
.manual-lock-review .confirmation-kickoff.manual-lock-meta{border-top:0!important;border-bottom:1px solid var(--line-strong)!important}
.manual-lock-review .manual-lock-note{color:var(--ink)!important;font-weight:600!important}
`;

export default function Batch1bSideBetStyles() {
  useEffect(() => {
    const apply = () => {
      document.querySelectorAll<HTMLElement>(".side-bet-card").forEach((card) => {
        card.classList.toggle("has-clear-offer-action", Boolean(card.querySelector(".clear-offer-actions")));
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return <style>{STYLES}</style>;
}
