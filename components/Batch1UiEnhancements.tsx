"use client";

const BATCH1_STYLES = `
.rule-item summary{min-height:50px;padding-top:4px;padding-bottom:4px}
.rule-item[open] .rule-copy{padding-top:5px}
.notification-badge{min-width:17px;height:17px;padding:0 4px;font-size:8.5px;line-height:1}
.notification-badge>.numeric-token{display:grid;width:100%;height:100%;place-items:center;transform:none;line-height:1}
.notification-badge .numeric-fragment{display:block;line-height:1}
.nav-notification-badge{top:-6px;right:-9px;min-width:17px;height:17px;padding:0 4px;border:0;box-shadow:0 0 0 2px var(--graphite)}
.game-final-status{text-transform:none}
.game-card.final-outcome .team-row.outcome-loss .team-name,.game-card.final-outcome .team-row.outcome-loss .team-board-market,.game-card.final-outcome .team-row.outcome-loss .team-result-score{color:var(--header-muted);-webkit-text-fill-color:var(--header-muted)}
.game-card.final-outcome .team-row.outcome-loss .team-logo,.score-bug-team.outcome-loss .team-logo{opacity:1;filter:none}
.score-bug-team.outcome-loss .score-bug-score{color:var(--header-muted)}
`;

export default function Batch1UiEnhancements() {
  return <style>{BATCH1_STYLES}</style>;
}
