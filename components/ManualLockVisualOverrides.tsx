"use client";

const STYLES = `
.manual-lock-review-backdrop{padding-bottom:calc(54px + env(safe-area-inset-bottom))!important}
.manual-lock-review .confirmation-matchup{margin-top:0!important;border-top:1px solid var(--line-strong)!important;border-bottom:0!important}
.manual-lock-review .confirmation-matchup>div.manual-lock-pick-cell{background:var(--panel)!important;box-shadow:none!important}
.manual-lock-review .confirmation-kickoff.manual-lock-meta{border-top:1px solid var(--line-strong)!important;border-bottom:1px solid var(--line-strong)!important}
.manual-lock-review .manual-lock-note{color:var(--ink)!important;font-weight:600!important}
`;

export default function ManualLockVisualOverrides() {
  return <style>{STYLES}</style>;
}
