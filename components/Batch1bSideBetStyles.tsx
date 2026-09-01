"use client";

import { useEffect } from "react";

const STYLES = `
.side-bet-card.has-clear-offer-action{display:block!important;height:auto!important;min-height:111px!important;padding-bottom:10px!important}
.side-bet-card.has-clear-offer-action>.clear-offer-actions{display:flex!important;position:static!important;z-index:2;margin-top:8px!important;justify-content:flex-end!important;pointer-events:auto}
.side-bet-card.has-clear-offer-action>.clear-offer-actions .btn{position:relative;z-index:3;pointer-events:auto}
.card-panel .group-card>h3+.group-empty-picks{margin-top:0!important;border-top:0!important}
.card-panel .group-card>h3+.visible-pick:has(> .team-logo[src$="admin-no-submission.svg"]){margin-top:0!important;border-top:0!important}
.card-panel .group-card>h3+.visible-pick:has(> .team-logo[src$="admin-no-submission.svg"])::before{display:none!important}
.manual-pick-lock{height:30px!important;min-height:30px!important;min-width:62px!important;font-size:11px!important;line-height:1.2!important}
.manual-pick-lock svg{width:13px!important;height:13px!important}
.manual-lock-review .confirmation-matchup{margin-top:0!important;border-top:0!important;border-bottom:1px solid var(--line-strong)!important}
.manual-lock-review .confirmation-matchup>div.manual-lock-pick-cell{background:var(--panel)!important;box-shadow:none!important}
.manual-lock-review .manual-lock-pick-cell>.team-name,.manual-lock-review .manual-lock-pick-cell>.team-spread{line-height:1.3!important;padding-bottom:1px}
.manual-lock-review .confirmation-kickoff.manual-lock-meta{border-top:0!important;border-bottom:1px solid var(--line-strong)!important;color:var(--header-muted)!important;font-family:var(--font-display);font-size:10px!important;font-weight:700!important;letter-spacing:0;line-height:1.3!important}
.manual-lock-review .manual-lock-note{color:var(--ink)!important;font-weight:600!important;line-height:1.45!important}
.game-head .game-time,.game-head .game-final-status,.game-head .game-live-status{line-height:1.3!important;padding-bottom:1px}
.responsive-text-value{padding-bottom:1px;margin-bottom:-1px}
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
