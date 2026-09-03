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

/* Persistent grey matchup/date metadata uses one exact treatment anywhere the
   pick/card result rows output it: My Card, League Cards, weekly results and side bets. */
.card-panel .pick-section .pick-card .pick-meta,
.card-panel .group-card .visible-pick-copy>p,
.bank-game-result>div>p,
.side-bet-offer-copy>p{font-family:var(--font-display)!important;font-size:12px!important;font-weight:600!important}

/* Keep League Card / Weekly Result spreads beside the team name rather than
   stretching them to the far edge. Give the title line enough vertical paint room
   for Roboto Slab numerals without changing row height. */
.card-panel .group-card .visible-pick-copy,
.bank-game-result>div{overflow:hidden!important}
.card-panel .group-card .visible-pick-copy>strong,
.bank-game-result .bank-game-pick-title{line-height:1.4!important}
.card-panel .group-card .visible-pick-copy>strong .pick-title-team,
.card-panel .group-card .visible-pick-copy>strong .pick-title-market,
.card-panel .group-card .visible-pick-copy>strong .numeric-token,
.card-panel .group-card .visible-pick-copy>strong .numeric-fragment,
.bank-game-result .bank-game-pick-title .pick-title-team,
.bank-game-result .bank-game-pick-title .pick-title-market,
.bank-game-result .bank-game-pick-title .numeric-token,
.bank-game-result .bank-game-pick-title .numeric-fragment{line-height:inherit!important}
.card-panel .group-card .visible-pick-copy>strong .numeric-token,
.card-panel .group-card .visible-pick-copy>strong .numeric-fragment,
.bank-game-result .bank-game-pick-title .numeric-token,
.bank-game-result .bank-game-pick-title .numeric-fragment{overflow:visible!important}

/* Lock Pick and Review & Accept popup matchup/date lines use the same treatment. */
.confirmation-kickoff{font-family:var(--font-display)!important;font-size:12px!important;font-weight:700!important}

/* Standings cells share the same row mechanics. Place now uses the exact same
   line-box/numeric-wrapper treatment as W/L/P; only its rank color differs. */
.standings-panel .leaderboard-row>.leaderboard-rank,
.standings-panel .leaderboard-row>.leaderboard-player,
.standings-panel .leaderboard-row>.leaderboard-stat,
.standings-panel .leaderboard-row>.leaderboard-pct,
.standings-panel .leaderboard-row>.leaderboard-points{height:100%!important;align-self:stretch!important;align-items:center!important;transform:none!important}
.standings-panel .leaderboard-row>.leaderboard-rank,
.standings-panel .leaderboard-row>.leaderboard-stat,
.standings-panel .leaderboard-row>.leaderboard-pct,
.standings-panel .leaderboard-row>.leaderboard-points{line-height:normal!important;overflow:visible!important}
.standings-panel .leaderboard-row>.leaderboard-rank{display:flex!important;justify-content:center!important}
.standings-panel .leaderboard-row>.leaderboard-rank .numeric-token,
.standings-panel .leaderboard-row>.leaderboard-rank .numeric-fragment,
.standings-panel .leaderboard-row>.leaderboard-stat .numeric-token,
.standings-panel .leaderboard-row>.leaderboard-stat .numeric-fragment,
.standings-panel .leaderboard-row>.leaderboard-pct .numeric-token,
.standings-panel .leaderboard-row>.leaderboard-pct .numeric-fragment,
.standings-panel .leaderboard-row>.leaderboard-points .numeric-token,
.standings-panel .leaderboard-row>.leaderboard-points .numeric-fragment{display:inline!important;line-height:inherit!important;overflow:visible!important;padding:0!important;transform:none!important}

/* Keep the restored runtime optical centering. Give the top-left kickoff time a
   genuinely taller line box plus paint room so the bottoms of Roboto Slab and
   numeric glyphs render fully on iOS without changing the game-head height. */
.game-card .game-head .game-time{display:inline-flex!important;align-items:center!important;line-height:1.4!important;padding-block:3px!important;margin-block:-3px!important;overflow:visible!important}
.game-card .game-head .game-time>.numeric-token,
.game-card .game-head .game-time .numeric-fragment,
.game-card .game-head .game-time .numeric-symbol{line-height:1.4!important;overflow:visible!important}
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
