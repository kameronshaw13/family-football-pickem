"use client";

const STYLES = `
.side-bet-card:has(.clear-offer-actions){display:block;min-height:111px}
.side-bet-card:has(.clear-offer-actions)>.clear-offer-actions{display:flex;margin-top:8px;justify-content:flex-end}
`;

export default function Batch1bSideBetStyles() {
  return <style>{STYLES}</style>;
}
