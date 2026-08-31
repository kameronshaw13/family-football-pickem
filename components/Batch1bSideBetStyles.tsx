"use client";

const STYLES = `
.side-bet-card:has(.clear-offer-actions){display:block}
.side-bet-card:has(.clear-offer-actions)>.clear-offer-actions{display:flex;margin-top:8px;justify-content:flex-end}
.side-bet-card:has(.clear-offer-actions)>.clear-offer-actions .btn{min-width:96px;min-height:36px;padding:6px 10px}
`;

export default function Batch1bSideBetStyles() {
  return <style>{STYLES}</style>;
}
