"use client";

import { useEffect } from "react";

const STYLES = `
.side-bet-card.has-clear-offer-action{display:block!important;height:auto!important;min-height:111px!important;padding-bottom:10px!important}
.side-bet-card.has-clear-offer-action>.clear-offer-actions{display:flex!important;position:static!important;z-index:1;margin-top:8px!important;justify-content:flex-end!important;pointer-events:auto}
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
