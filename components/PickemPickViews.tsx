"use client";

import { buildTestWeek } from "@/lib/demoWeekFixture";
import { pickCardSignature, completeSeasonStandings } from "@/lib/standingsDisplay";
import RuleItem from "@/components/RuleItem";
import Leaderboard from "@/components/Leaderboard";
import SectionTabs from "@/components/SectionTabs";
import { sideBetMatchesGameFilter, sortSideBetsByGameStatus, sortSideBetsGroupedByGame, type SideBetGameFilter } from "@/lib/sideBetSorting";
import { sideBetMarketText, sideBetOddsForTeam, sideBetOddsSuffix, sideBetTotalSideForTeam, sideBetLineText } from "@/lib/sideBetDisplay";
import { money, roundedMoney, stakeMoney, normalizeRiskInput } from "@/lib/moneyDisplay";
import { dogBonusText, dogLineText, confidencePointText } from "@/lib/pickDisplay";
import { basketballLockTime, basketballWeek, basketballWeekBounds, basketballSeasonEnd, isBasketballLeague } from "@/lib/basketballRules";
import BasketballGameDetails from "@/components/BasketballGameDetails";
import { formatOrdinalDate, formatUppercaseOrdinalDate } from "@/lib/displayDates";
import NextImage from "next/image";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, ChevronDown, ChevronUp, CircleCheckBig, CircleDollarSign, FlaskConical, LoaderCircle, Lock, Send, Settings as SettingsIcon, SquareCheck, Trash2, Trophy, X, Zap } from "lucide-react";
import type { BankEntry, BankSettings, Game, Pick, PickType, Profile, SideBet, SideBetMarketQuote, SideBetOfferPhase, SideBetTotalSide, Standing, WeekRule } from "@/lib/types";
import { MAX_CUSTOM_SIDE_BET_AMOUNT, MAX_SIDE_BET_AMOUNT, hasAvailableSideBetSlot } from "@/lib/sideBetLimits";
import { americanOddsText, fairAltSpreadOdds, fairAltTotalOdds, fairMoneylineFromSpread, fairSymmetricMoneyline, oppositeAmericanOdds, oppositeTotalSide, profitForRisk, sideBetCreatorProfit, sideBetNetForUser, sideBetProfitForUser, sideBetRiskForUser, type SideBetMarketType, validAmericanOdds } from "@/lib/sideBetMarkets";
import { gradeAgainstSpread, gradeUnderdogOutright, normalizeSpreadForSelectedTeam, spreadText, underdogWinValue } from "@/lib/spreads";
import { countRegularByLeague, getWeekRule } from "@/lib/weekRules";
import type { BankHistoryWeek } from "@/lib/bankHistory";
import { isSideBetRestricted } from "@/lib/sideBetAccess";
import { computeWeeklySettlement, computeWeeklyStandings } from "@/lib/weeklyBank";
import { cfbConferenceForLogo, FBS_INDEPENDENTS_CONFERENCE, GROUP_CONFERENCES, POWER_CONFERENCES } from "@/lib/cfbConferences";
import MenuSelect from "@/components/MenuSelect";
import NumericText from "@/components/NumericText";
import NotificationBadge from "@/components/NotificationBadge";
import MatchupPreview from "@/components/MatchupPreview";
import NflMatchupPreview from "@/components/NflMatchupPreview";
import GameTracker from "@/components/GameTracker";
import SettingsPanel from "@/components/SettingsPanel";
import GroupMoneyControls from "@/components/GroupMoneyControls";
import { moveConfidencePick, normalizeConfidenceCard } from "@/lib/confidencePoints";
import { ruleSections, type AppSlug, type GroupRules } from "@/lib/rulePresentation";
import { appLoginPath } from "@/lib/appIdentity";
import { sideBetBettorForTeam, sideBetLedgerPerspective, sideBetOfferIsPending, sideBetPerspective, sideBetResponseSummary, sideBetsForView } from "@/lib/sideBetPresentation";
import { orderCardPicks } from "@/lib/cardOrdering";
import { teamAbbreviatedName, teamDisplayName } from "@/lib/teamNames";
import { canRefreshSpread, getCurrentPickWeek } from "@/lib/lockRules";

import {
  type GameStatusFilter,
  type LeagueFilter,
  type GameOutcome,
  displayTeamName,
  abbreviatedTeamName,
  ResponsiveText,
  ResponsiveTeamName,
  BoardTeamName,
  cardGameStateText,
  timeText,
  spreadForTeam,
  isClosed,
  isFinalGame,
  LockedPickIndicator,
  liveSituationStatus,
  LivePeriodText,
  LiveSituationText,
  teamDogValue,
  logoForTeam,
  TeamLogo,
} from "@/components/PickemPresentationShared";

export function GameCard({ game, picks, statusFilter, leagueFilter, weekIsOpen, now, pointsMode, modelStars = 0, addPick, openPreview }: { game: Game; picks: Pick[]; statusFilter: GameStatusFilter; leagueFilter: LeagueFilter; weekIsOpen: boolean; now: number; pointsMode: boolean; modelStars?: number; addPick: (game: Game, team: string, pickType: PickType) => void; openPreview: (game: Game) => void }) {
  const closed = isClosed(game) || !weekIsOpen;
  const hasFinalScore = game.final_away_score != null && game.final_home_score != null;
  const hasLiveScore = game.live_state !== "pre" && game.live_away_score != null && game.live_home_score != null;
  const hasScore = hasFinalScore || hasLiveScore;
  const gameIsFinal = isFinalGame(game);
  const gameIsLive = !gameIsFinal && new Date(game.commence_time).getTime() <= now;
  const awayScore = hasFinalScore ? game.final_away_score : game.live_away_score;
  const homeScore = hasFinalScore ? game.final_home_score : game.live_home_score;
  const dogView = leagueFilter === "DOGS";
  const existing = picks.find((p) => p.game_id === game.id);
  const selectType: PickType = dogView ? "underdog" : "regular";
  const existingMatchesView = existing?.pick_type === selectType;
  const canChangeExisting = existing?.status === "draft" && existingMatchesView;
  const awayDogValue = teamDogValue(game, game.away_team);
  const homeDogValue = teamDogValue(game, game.home_team);
  const hasSpread = Boolean(game.current_spread_team && game.current_spread != null && Number.isFinite(Number(game.current_spread)));

  function sideLine(team: string) {
    if (dogView) return dogLineText(game, team, pointsMode);
    return spreadForTeam(game, team);
  }

  function resultSpread(team: string) {
    if (existingMatchesView && existing?.locked_spread != null) {
      return Number(team === existing.selected_team ? existing.locked_spread : -existing.locked_spread);
    }
    return normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread);
  }

  function resultLine(team: string) {
    const spread = resultSpread(team);
    if (!dogView) return spreadText(spread);
    const dogValue = underdogWinValue(spread);
    return dogValue > 0 ? `${spreadText(spread)} = ${dogBonusText(dogValue, pointsMode)}` : null;
  }

  function sideIsSelectable(team: string) {
    if (statusFilter !== "OPEN") return false;
    if (closed) return false;
    if (!game.current_spread_team || game.current_spread == null) return false;
    if (dogView) return teamDogValue(game, team) > 0;
    if (existingMatchesView && !canChangeExisting) return false;
    return true;
  }

  function choose(team: string) {
    if (!sideIsSelectable(team)) return;
    addPick(game, team, selectType);
  }

  const awaySelectable = sideIsSelectable(game.away_team);
  const homeSelectable = sideIsSelectable(game.home_team);
  const awayBlocked = false;
  const homeBlocked = false;
  const awayOpponentOnly = dogView && !hasScore && awayDogValue === 0;
  const homeOpponentOnly = dogView && !hasScore && homeDogValue === 0;

  function pickedResult(): GameOutcome | null {
    if (!existingMatchesView || !existing || !gameIsFinal || awayScore == null || homeScore == null) return null;
    if (gameIsFinal && existing.result !== "pending") return existing.result;
    if (existing.pick_type === "underdog") {
      return gradeUnderdogOutright(existing.selected_team, game.home_team, game.away_team, homeScore, awayScore);
    }
    const spread = existing.locked_spread ?? normalizeSpreadForSelectedTeam(existing.selected_team, game.current_spread_team, game.current_spread);
    return spread == null ? null : gradeAgainstSpread(existing.selected_team, game.home_team, game.away_team, homeScore, awayScore, spread);
  }

  function resultWithoutPick(team: string): GameOutcome | null {
    if (!gameIsFinal || awayScore == null || homeScore == null) return null;
    if (dogView) return gradeUnderdogOutright(team, game.home_team, game.away_team, homeScore, awayScore);
    const spread = normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread);
    return spread == null ? null : gradeAgainstSpread(team, game.home_team, game.away_team, homeScore, awayScore, spread);
  }

  const pickedScoreResult = pickedResult();
  function finalResultForTeam(team: string): GameOutcome | null {
    if (!gameIsFinal) return null;
    if (!existingMatchesView || !existing || !pickedScoreResult) return resultWithoutPick(team);
    if (pickedScoreResult === "push") return "push";
    if (team === existing.selected_team) return pickedScoreResult;
    return pickedScoreResult === "win" ? "loss" : "win";
  }

  function resultClasses(team: string) {
    const classes: string[] = [];
    const finalOutcome = finalResultForTeam(team);
    if (finalOutcome) classes.push(`outcome-${finalOutcome}`);
    if (existingMatchesView && existing?.selected_team === team && pickedScoreResult) {
      classes.push(`picked-${pickedScoreResult}`);
    }
    return classes.join(" ");
  }

  const showScoreValues = hasScore && (gameIsLive || gameIsFinal);
  const awayResultLine = showScoreValues ? resultLine(game.away_team) : null;
  const homeResultLine = showScoreValues ? resultLine(game.home_team) : null;
  const liveSituation = gameIsLive ? liveSituationStatus(game) : "";

  return <article className={`game-card matchup-card filter-${leagueFilter.toLowerCase()} status-${statusFilter.toLowerCase()} ${dogView ? "dog-view" : ""} ${closed ? "closed" : ""} ${!weekIsOpen && !gameIsLive && !gameIsFinal ? "locked-out" : ""} ${existingMatchesView ? "selected" : ""} ${gameIsFinal && hasScore ? "final-outcome" : ""} ${showScoreValues ? "score-values" : ""}`}>
    <div className={`game-head compact-game-head ${gameIsLive ? "live-tracker-head" : ""}`.trim()}>
      <div className="game-time-group">{gameIsFinal ? <span className="game-final-status">Final</span> : gameIsLive ? <span className="game-live-status"><LivePeriodText game={game} /></span> : <span className="game-time"><NumericText text={timeText(game.commence_time)} /></span>}</div>
      {gameIsLive && <button type="button" className="matchup-preview-trigger game-tracker-trigger" onClick={() => openPreview(game)}>GameTracker</button>}
      {gameIsLive && liveSituation && <div className="game-live-situation"><LiveSituationText game={game} /></div>}
      {!gameIsLive && <div className="matchup-preview-actions">{modelStars > 0 && game.league === "CFB" && !gameIsFinal && <span className="board-model-stars" aria-label={`${modelStars} model edge star${modelStars === 1 ? "" : "s"}`}>{"★".repeat(modelStars)}</span>}<button type="button" className="matchup-preview-trigger game-tracker-trigger" onClick={() => openPreview(game)}>{gameIsFinal ? "GameTracker" : "Matchup Preview"}</button></div>}
    </div>

    <div className="stacked-matchup" role="group" aria-label={`${displayTeamName(game, game.away_team)} at ${displayTeamName(game, game.home_team)}`}>
      <button
        type="button"
        className={`team-row away-row ${awaySelectable ? "selectable" : ""} ${existingMatchesView && existing?.selected_team === game.away_team ? "picked-side" : ""} ${awayOpponentOnly ? "opponent-only" : ""} ${awayBlocked ? "blocked-side" : ""} ${resultClasses(game.away_team)}`}
        disabled={!awaySelectable}
        onClick={() => choose(game.away_team)}
      >
        <TeamLogo url={logoForTeam(game, game.away_team)} name={game.away_team} />
        {showScoreValues ? <span className="team-name-line"><BoardTeamName game={game} team={game.away_team} />{awayResultLine && <span className="team-board-market"><NumericText text={awayResultLine} /></span>}</span> : <BoardTeamName game={game} team={game.away_team} />}
        {showScoreValues ? <span className="team-result-line"><PossessionIcon game={game} team={game.away_team} /><span className="team-result-score"><NumericText text={awayScore ?? "—"} /></span></span> : hasSpread && !awayOpponentOnly && <span className={`team-spread ${awayBlocked ? "unavailable" : ""}`}><span>{awayBlocked ? "Not eligible" : <NumericText text={sideLine(game.away_team)} />}</span></span>}
      </button>

      <button
        type="button"
        className={`team-row home-row ${homeSelectable ? "selectable" : ""} ${existingMatchesView && existing?.selected_team === game.home_team ? "picked-side" : ""} ${homeOpponentOnly ? "opponent-only" : ""} ${homeBlocked ? "blocked-side" : ""} ${resultClasses(game.home_team)}`}
        disabled={!homeSelectable}
        onClick={() => choose(game.home_team)}
      >
        <TeamLogo url={logoForTeam(game, game.home_team)} name={game.home_team} />
        {showScoreValues ? <span className="team-name-line"><BoardTeamName game={game} team={game.home_team} />{homeResultLine && <span className="team-board-market"><NumericText text={homeResultLine} /></span>}</span> : <BoardTeamName game={game} team={game.home_team} />}
        {showScoreValues ? <span className="team-result-line"><PossessionIcon game={game} team={game.home_team} /><span className="team-result-score"><NumericText text={homeScore ?? "—"} /></span></span> : hasSpread && !homeOpponentOnly && <span className={`team-spread ${homeBlocked ? "unavailable" : ""}`}><span>{homeBlocked ? "Not eligible" : <NumericText text={sideLine(game.home_team)} />}</span></span>}
      </button>
    </div>
  </article>;
}

export function PossessionIcon({ game, team }: { game: Game; team: string }) {
  if (game.live_state !== "in" || game.live_possession_team !== team) return null;
  if (isBasketballLeague(game.league)) return <span className="possession-icon" role="img" aria-label="Possession">🏀</span>;
  return <span className="possession-icon" role="img" aria-label="Possession" title="Possession">
    <svg viewBox="0 0 24 14" aria-hidden="true" shapeRendering="geometricPrecision">
      <path d="M1.5 7C4.1 3 7.6 1.4 12 1.4S19.9 3 22.5 7c-2.6 4-6.1 5.6-10.5 5.6S4.1 11 1.5 7Z" fill="currentColor" stroke="#62371f" strokeWidth="1.05" />
      <path d="M8.5 7h7M10.5 5.85v2.3M12 5.85v2.3M13.5 5.85v2.3" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="1.3" />
    </svg>
  </span>;
}

export function CardProgress({ rule, counts, hasDog, dirty }: { rule: WeekRule; counts: { total: number; cfb: number; nfl: number; cbb?: number; nba?: number }; hasDog: boolean; dirty: boolean }) {
  const ok = counts.total === rule.regularTotal && counts.cfb >= rule.cfbMinimum && counts.nfl >= rule.nflMinimum && hasDog;
  const completeSlots = Math.min(counts.total + Number(hasDog), rule.regularTotal + 1);
  const progress = completeSlots / (rule.regularTotal + 1) * 100;
  const countText = counts.cbb != null
    ? `${counts.total}/${rule.regularTotal} spreads · ${counts.cbb} CBB · ${counts.nba} NBA · dog ${hasDog ? "set" : "open"}`
    : rule.phase === "opening" || rule.phase === "college"
    ? `${counts.cfb}/${rule.regularTotal} CFB spreads · dog ${hasDog ? "set" : "open"}`
    : `${counts.total}/${rule.regularTotal} spreads · ${counts.cfb} CFB · ${counts.nfl} NFL · dog ${hasDog ? "set" : "open"}`;
  return <div className={`card-progress ${ok ? "complete" : ""} ${dirty ? "dirty" : ""}`}>
    <div className="card-progress-copy">
      <div className="card-progress-heading">
        <strong>{ok ? "Card complete" : "Build your card"}</strong>
        <span className={`card-progress-state ${dirty ? "unsaved" : "saved"}`}>{!dirty && <CircleCheckBig size={14} />}{dirty ? "Saving…" : "Picks saved"}</span>
      </div>
      <span className="card-progress-count"><NumericText text={countText} /></span>
    </div>
    <div className="progress-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
  </div>;
}

export function hasPickScoreBug(game: Game | null | undefined) {
  if (!game || (game.live_state !== "in" && !isFinalGame(game))) return false;
  return (game.final_away_score != null && game.final_home_score != null) || (game.live_away_score != null && game.live_home_score != null);
}

export function PickScoreBug({ game, pick, spread }: { game: Game; pick: Pick; spread: number | null }) {
  const final = isFinalGame(game);
  const awayScore = game.final_away_score ?? game.live_away_score;
  const homeScore = game.final_home_score ?? game.live_home_score;
  if (awayScore == null || homeScore == null) return null;

  let outcome: GameOutcome | null = pick.result !== "pending" ? pick.result : null;
  if (final && outcome == null) {
    outcome = pick.pick_type === "underdog"
      ? gradeUnderdogOutright(pick.selected_team, game.home_team, game.away_team, homeScore, awayScore)
      : spread == null ? null : gradeAgainstSpread(pick.selected_team, game.home_team, game.away_team, homeScore, awayScore, spread);
  }

  const teamOutcomeClass = (team: string) => {
    if (!final || !outcome || outcome === "push") return "";
    const teamOutcome = team === pick.selected_team ? outcome : outcome === "win" ? "loss" : "win";
    return ` outcome-${teamOutcome}`;
  };
  const fieldPosition = !final ? game.live_situation?.match(/\s+at\s+(.+)$/i)?.[1]?.trim() || "" : "";
  const downAndDistance = !final ? game.live_situation?.match(/^(.*?)\s+at\s+/i)?.[1]?.trim() || "" : "";
  const detail = game.live_status?.trim() || "";
  const clock = detail.match(/\b\d{1,2}:\d{2}\b/)?.[0] || "";
  const quarter = detail.match(/\b(1st|2nd|3rd|4th)\b/i)?.[1] || "";
  const period = /\bhalftime\b/i.test(detail) ? "Halftime" : /\bOT\b/i.test(detail) ? "OT" : quarter || "Live";
  const periodAndClock = [period, clock].filter(Boolean).join(" · ");
  const resultLabel = outcome === "win" ? "W" : outcome === "loss" ? "L" : outcome === "push" ? "P" : "—";
  const status = final ? `Final${outcome ? `, ${outcome}` : ""}` : [periodAndClock, downAndDistance, fieldPosition].filter(Boolean).join(", ");
  return <span className={`pick-score-bug ${final ? "final" : "live"}`} role="img" aria-label={`${displayTeamName(game, game.away_team)} ${awayScore}, ${displayTeamName(game, game.home_team)} ${homeScore}, ${status}`}>
    <span className={`score-bug-team${teamOutcomeClass(game.away_team)}`}><TeamLogo url={logoForTeam(game, game.away_team)} name={game.away_team} /><span className="score-bug-score"><NumericText text={awayScore} /></span></span>
    <span className={`score-bug-team${teamOutcomeClass(game.home_team)}`}><TeamLogo url={logoForTeam(game, game.home_team)} name={game.home_team} /><span className="score-bug-score"><NumericText text={homeScore} /></span></span>
    <span className="score-bug-meta">{final ? <span className={`score-bug-result score-bug-result-${outcome || "pending"}`}>{resultLabel}</span> : <><span><NumericText text={periodAndClock} /></span><span><NumericText text={downAndDistance || "—"} /></span><span className={game.live_red_zone ? "red-zone-field" : ""}><NumericText text={fieldPosition || "—"} /></span></>}</span>
  </span>;
}

export function PickList({ picks, games, title, pointsMode, universalLockReached, removePick, openPreview, headerContent }: { picks: Pick[]; games: Game[]; title: string; pointsMode: boolean; universalLockReached: boolean; removePick: (p: Pick) => void; openPreview: (game: Game) => void; headerContent?: React.ReactNode }) {
  return <div className="pick-section"><h3>{title}</h3>{headerContent}{!picks.length && <p className="muted card-empty-picks">None yet.</p>}{picks.map((pick) => {
    const game = games.find((g) => g.id === pick.game_id) || pick.game;
    const locked = pick.status === "locked" || Boolean(game && isClosed(game));
    const graded = pick.result !== "pending";
    const displayedSpread = pick.locked_spread != null ? Number(pick.locked_spread) : game ? normalizeSpreadForSelectedTeam(pick.selected_team, game.current_spread_team, game.current_spread) : null;
    const matchupText = game ? `${displayTeamName(game, game.away_team)} at ${displayTeamName(game, game.home_team)}` : "Game unavailable";
    const compactMatchupText = game ? `${abbreviatedTeamName(game, game.away_team)} at ${abbreviatedTeamName(game, game.home_team)}` : matchupText;
    const metaState = game ? hasPickScoreBug(game) ? isFinalGame(game) ? "Final" : "Live" : cardGameStateText(game, locked) : "";
    const metaText = [matchupText, metaState].filter(Boolean).join(" · ");
    const compactMetaText = [compactMatchupText, metaState].filter(Boolean).join(" · ");
    const resultLabel = pick.result === "win" ? "W" : pick.result === "loss" ? "L" : "P";
    return <div className="pick-card" data-game-id={pick.game_id} key={pick.id}>
      <div className="pick-top"><TeamLogo url={game ? logoForTeam(game, pick.selected_team) : null} name={pick.selected_team} /><div className="pick-copy"><p className="pick-title">{game ? <ResponsiveTeamName game={game} team={pick.selected_team} className="pick-title-team" /> : <span className="pick-title-team">{pick.selected_team}</span>}<span className="pick-title-market"><NumericText text={spreadText(displayedSpread)} />{pick.pick_type === "regular" && Number(pick.confidence_points || 0) > 0 && <span className="confidence-card-chip"><span className="ui-separator-dot" aria-hidden="true">·</span><NumericText text={confidencePointText(Number(pick.confidence_points))} /></span>}{pick.pick_type === "underdog" && <><span className="dog-separator ui-separator-dot" aria-hidden="true">·</span><span className="dog-tag">Dog <NumericText text={dogBonusText(pick.underdog_win_value || "?", pointsMode)} /></span></>}{game && <PossessionIcon game={game} team={pick.selected_team} />}</span></p>{metaText && <p className="pick-meta"><ResponsiveText full={metaText} compact={compactMetaText} wrapOnSmall /></p>}</div><div className="pick-row-actions">{game && hasPickScoreBug(game) ? <button type="button" className="pick-score-bug-button" aria-label={`Open GameTracker for ${displayTeamName(game, game.away_team)} at ${displayTeamName(game, game.home_team)}`} onClick={() => openPreview(game)}><PickScoreBug game={game} pick={pick} spread={displayedSpread} /></button> : graded ? <span className={`badge pick-result-${pick.result}`}>{resultLabel}</span> : locked ? <LockedPickIndicator hidden={universalLockReached} /> : null}{!locked && <button className="icon-btn" aria-label={`Remove ${pick.selected_team}`} onClick={() => removePick(pick)}><X size={16} /></button>}</div></div>
    </div>;
  })}</div>;
}

export function VisiblePick({ pick, games, pointsMode, universalLockReached, openPreview }: { pick: Pick; games: Game[]; pointsMode: boolean; universalLockReached: boolean; openPreview: (game: Game) => void }) {
  const game = games.find((g) => g.id === pick.game_id) || pick.game;
  const locked = pick.status === "locked" || Boolean(game && isClosed(game));
  const graded = pick.result !== "pending";
  const displayedSpread = pick.locked_spread != null ? Number(pick.locked_spread) : game ? normalizeSpreadForSelectedTeam(pick.selected_team, game.current_spread_team, game.current_spread) : null;
  const resultLabel = pick.result === "win" ? "W" : pick.result === "loss" ? "L" : "P";
  const matchupText = game ? `${displayTeamName(game, game.away_team)} at ${displayTeamName(game, game.home_team)}` : "Game unavailable";
  const compactMatchupText = game ? `${abbreviatedTeamName(game, game.away_team)} at ${abbreviatedTeamName(game, game.home_team)}` : matchupText;
  const metaState = game ? hasPickScoreBug(game) ? isFinalGame(game) ? "Final" : "Live" : cardGameStateText(game, locked) : "";
  const metaText = [matchupText, metaState].filter(Boolean).join(" · ");
  const compactMetaText = [compactMatchupText, metaState].filter(Boolean).join(" · ");
  return <div className="visible-pick"><TeamLogo url={game ? logoForTeam(game, pick.selected_team) : null} name={pick.selected_team} /><div className="visible-pick-copy"><strong>{game ? <ResponsiveTeamName game={game} team={pick.selected_team} className="pick-title-team" /> : <span className="pick-title-team">{pick.selected_team}</span>}<span className="pick-title-market"><NumericText text={spreadText(displayedSpread)} />{pick.pick_type === "regular" && Number(pick.confidence_points || 0) > 0 && <span className="confidence-card-chip"><span className="ui-separator-dot" aria-hidden="true">·</span><NumericText text={confidencePointText(Number(pick.confidence_points))} /></span>}{pick.pick_type === "underdog" && <><span className="dog-separator ui-separator-dot" aria-hidden="true">·</span><span className="dog-tag">Dog <NumericText text={dogBonusText(pick.underdog_win_value || "?", pointsMode)} /></span></>}{game && <PossessionIcon game={game} team={pick.selected_team} />}</span></strong>{metaText && <p><ResponsiveText full={metaText} compact={compactMetaText} /></p>}</div><div className="visible-pick-actions">{game && hasPickScoreBug(game) ? <button type="button" className="pick-score-bug-button" aria-label={`Open GameTracker for ${displayTeamName(game, game.away_team)} at ${displayTeamName(game, game.home_team)}`} onClick={() => openPreview(game)}><PickScoreBug game={game} pick={pick} spread={displayedSpread} /></button> : graded ? <span className={`badge pick-result-${pick.result}`}>{resultLabel}</span> : locked ? <LockedPickIndicator hidden={universalLockReached} /> : null}</div></div>;
}
