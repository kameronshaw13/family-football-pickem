"use client";

import { useEffect } from "react";

const STYLES = `
.card-panel .pick-section .pick-card .pick-copy,
.card-panel .group-card .visible-pick-copy,
.bank-game-result>div,
.side-bet-offer-copy{min-width:0!important;overflow:visible!important;clip-path:inset(-6px 0 -6px 0)}

.card-panel .pick-section .pick-card .pick-title,
.card-panel .group-card .visible-pick-copy>strong,
.bank-game-result .bank-game-pick-title,
.side-bet-offer-copy>strong{overflow:visible!important;line-height:1.25!important;padding-block:0!important;margin-block:0!important}

.card-panel .pick-section .pick-card .pick-title-team,
.card-panel .pick-section .pick-card .pick-title-team.app-pass-full-team,
.card-panel .pick-section .pick-card .pick-title-market,
.card-panel .group-card .visible-pick-copy>strong .pick-title-team,
.card-panel .group-card .visible-pick-copy>strong .pick-title-market,
.bank-game-result .bank-game-pick-title .pick-title-team,
.bank-game-result .bank-game-pick-title .pick-title-market,
.card-panel .pick-section .pick-card .pick-title-team.responsive-text,
.card-panel .pick-section .pick-card .pick-title-team.responsive-text .responsive-text-value,
.card-panel .group-card .visible-pick-copy>strong .pick-title-team.responsive-text,
.card-panel .group-card .visible-pick-copy>strong .pick-title-team.responsive-text .responsive-text-value,
.bank-game-result .bank-game-pick-title .pick-title-team.responsive-text,
.bank-game-result .bank-game-pick-title .pick-title-team.responsive-text .responsive-text-value,
.side-bet-offer-copy>strong .responsive-text,
.side-bet-offer-copy>strong .responsive-text-value{overflow:visible!important;line-height:inherit!important;padding-block:0!important;margin-block:0!important;text-overflow:clip!important}

.card-panel .pick-section .pick-card .pick-title .numeric-token,
.card-panel .pick-section .pick-card .pick-title .numeric-fragment,
.card-panel .pick-section .pick-card .pick-title .numeric-symbol,
.card-panel .group-card .visible-pick-copy>strong .numeric-token,
.card-panel .group-card .visible-pick-copy>strong .numeric-fragment,
.card-panel .group-card .visible-pick-copy>strong .numeric-symbol,
.bank-game-result .bank-game-pick-title .numeric-token,
.bank-game-result .bank-game-pick-title .numeric-fragment,
.bank-game-result .bank-game-pick-title .numeric-symbol{line-height:inherit!important;overflow:visible!important;padding-block:0!important;margin-block:0!important}

.card-panel .pick-section .pick-card .pick-meta,
.card-panel .group-card .visible-pick-copy>p,
.bank-game-result>div>p{overflow:visible!important;font-family:var(--font-display)!important;font-size:11px!important;font-weight:600!important;line-height:1.4!important;padding-block:0!important;margin-bottom:0!important}
.card-panel .pick-section .pick-card .pick-meta .responsive-text,
.card-panel .pick-section .pick-card .pick-meta .responsive-text-value,
.card-panel .group-card .visible-pick-copy>p .responsive-text,
.card-panel .group-card .visible-pick-copy>p .responsive-text-value,
.bank-game-result>div>p .responsive-text,
.bank-game-result>div>p .responsive-text-value{overflow:visible!important;line-height:inherit!important;padding-block:0!important;margin-block:0!important;text-overflow:clip!important}

.side-bet-offer-copy>p{overflow:visible!important;font-family:var(--font-display)!important;font-size:11px!important;font-weight:600!important;line-height:1.35!important;padding-block:0!important;margin-bottom:0!important}
.side-bet-offer-copy .side-bet-response-line,
.side-bet-offer-copy .side-bet-response-value{overflow:visible!important;padding-block:0!important;margin-block:0!important}

.confirmation-kickoff{font-family:var(--font-display)!important;font-size:12px!important;font-weight:700!important}

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
