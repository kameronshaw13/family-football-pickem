"use client";

const STYLES = `
.side-bet-card:has(.clear-offer-actions){display:grid;grid-template-columns:minmax(0,1fr) 64px;column-gap:8px;align-items:center}
.side-bet-card:has(.clear-offer-actions)>.side-bet-offer-row{grid-column:1;grid-row:1;min-width:0}
.side-bet-card:has(.clear-offer-actions)>.clear-offer-actions{grid-column:2;grid-row:1;margin-top:0;justify-content:flex-end}
.side-bet-card:has(.clear-offer-actions)>.clear-offer-actions .btn{width:60px;min-width:60px}
`;

export default function Batch1bSideBetStyles() {
  return <style>{STYLES}</style>;
}
