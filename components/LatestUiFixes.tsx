"use client";

import { useEffect } from "react";

const STYLES = `
/* My Card is the last surface still showing vertical glyph clipping. Keep the same
   type sizes/row heights, but give the text's clip edge a little breathing room. */
.card-panel .pick-section .pick-card .pick-copy{overflow:visible!important}
.card-panel .pick-section .pick-card .pick-title{overflow:visible!important;line-height:1.4!important}
.card-panel .pick-section .pick-card .pick-title-team{overflow:clip!important;overflow-clip-margin:5px!important;line-height:1.4!important}
.card-panel .pick-section .pick-card .pick-title-market{overflow:visible!important;line-height:1.4!important}
.card-panel .pick-section .pick-card .pick-meta{overflow:clip!important;overflow-clip-margin:5px!important;line-height:1.45!important}
.card-panel .pick-section .pick-card .pick-meta .responsive-text,
.card-panel .pick-section .pick-card .pick-meta .responsive-text-value{overflow:clip!important;overflow-clip-margin:5px!important;line-height:1.45!important}

/* Optically center Place with the player name and W/L/P values. */
.standings-panel .leaderboard-row>.leaderboard-rank{transform:translateY(.5px)!important}
`;

function syncSentOfferBlue() {
  document.querySelectorAll<HTMLElement>(".side-bet-card.mode-sent .side-bet-response").forEach((element) => {
    if (element.textContent?.trim() !== "Offered") return;
    element.style.setProperty("color", "var(--blue-dark)", "important");
    element.style.setProperty("-webkit-text-fill-color", "var(--blue-dark)", "important");
  });
}

export default function LatestUiFixes() {
  useEffect(() => {
    let frame = 0;
    const apply = () => {
      frame = 0;
      syncSentOfferBlue();
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(apply);
    };

    apply();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", schedule);
    void document.fonts?.ready.then(schedule).catch(() => undefined);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <style>{STYLES}</style>;
}
