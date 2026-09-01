"use client";

import { useEffect } from "react";

const STYLES = `
.side-bet-card.has-clear-offer-action{display:block!important;height:auto!important;min-height:111px!important;padding-bottom:10px!important}
.side-bet-card.has-clear-offer-action>.clear-offer-actions{display:flex!important;position:static!important;z-index:2;margin-top:8px!important;justify-content:flex-end!important;pointer-events:auto}
.side-bet-card.has-clear-offer-action>.clear-offer-actions .btn{position:relative;z-index:3;pointer-events:auto}
.manual-lock-review .confirmation-heading{margin-bottom:0!important}
.manual-lock-review .confirmation-matchup{margin-top:4px!important}
.manual-lock-review .confirmation-matchup>div.manual-lock-pick-cell{height:44px!important;min-height:44px!important;padding:4px 10px!important}
.manual-lock-review .manual-lock-meta{display:flex;min-height:28px;align-items:center;justify-content:center;margin:0!important;padding:5px 8px;border-bottom:1px solid var(--line);color:var(--header-muted);background:var(--surface-muted);font-size:10px;font-weight:600;line-height:1.2;text-align:center}
.manual-lock-review .manual-lock-note{margin-top:8px!important}
.manual-lock-review .manual-lock-confirm-btn svg{left:calc(50% + 34px)!important}
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
