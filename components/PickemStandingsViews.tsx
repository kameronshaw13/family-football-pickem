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
  displayTeamName,
  abbreviatedTeamName,
  ResponsiveText,
  ResponsiveTeamName,
  cardGameStateText,
  isClosed,
  isFinalGame,
  LockedPickIndicator,
  logoForTeam,
  totalSideText,
  RecordText,
  TeamLogo,
} from "@/components/PickemPresentationShared";
import {
  PossessionIcon,
  hasPickScoreBug,
  PickScoreBug,
} from "@/components/PickemPickViews";

export function conferenceFilterSections(allLabel: string) {
  return [
    { options: [{ value: "ALL", label: allLabel }] },
    { label: "Power 4", options: POWER_CONFERENCES.map((conference) => ({ value: conference, label: conference })) },
    { label: "Group of 6", options: GROUP_CONFERENCES.map((conference) => ({ value: conference, label: conference })) },
    { options: [{ value: FBS_INDEPENDENTS_CONFERENCE, label: "INDEPENDENTS" }] }
  ];
}

export function ConferenceFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <MenuSelect
    ariaLabel="Filter college games by FBS conference"
    className="compact-select context-select"
    value={value}
    sections={conferenceFilterSections("ALL CONF.")}
    onChange={onChange}
  />;
}

export function BankBalanceHistoryRow({ player, weeks }: { player: { id: string; display_name: string; total: number }; weeks: BankHistoryWeek[] }) {
  const playerWeeks = weeks.map((week) => {
    const weeklyAmount = Object.prototype.hasOwnProperty.call(week.weeklyAmounts || {}, player.id)
      ? Number(week.weeklyAmounts[player.id] || 0)
      : null;
    const games = week.games
      .filter((game) => Object.prototype.hasOwnProperty.call(game.amounts || {}, player.id))
      .map((game) => ({
        ...game,
        playerAmount: Number(game.amounts[player.id] || 0),
        playerBetCount: Number(game.betCounts?.[player.id] || 0)
      }));
    const openingBalance = Object.prototype.hasOwnProperty.call(week.openingBalances || {}, player.id)
      ? Number(week.openingBalances[player.id] || 0)
      : null;
    const payoutAmount = Object.prototype.hasOwnProperty.call(week.payoutAmounts || {}, player.id)
      ? Number(week.payoutAmounts[player.id] || 0)
      : null;
    return { week: week.week, weeklyAmount, openingBalance, payoutAmount, games };
  }).filter((week) => week.openingBalance != null || week.weeklyAmount != null || week.payoutAmount != null || week.games.length > 0);

  return <details className="bank-balance-player">
    <summary>
      <span className="bank-balance-player-name">{player.display_name}</span>
      <strong className={player.total > 0 ? "money-pos" : player.total < 0 ? "money-neg" : "money-neutral"}><NumericText text={money(player.total)} /></strong>
      <ChevronDown size={16} />
    </summary>
    <div className="bank-balance-player-history">
      {!playerWeeks.length && <p className="muted bank-history-empty">No bank history yet.</p>}
      {playerWeeks.map((week) => {
        const weekTotal = Number(week.openingBalance || 0) + Number(week.weeklyAmount || 0) + week.games.reduce((sum, game) => sum + game.playerAmount, 0);
        return <Fragment key={week.week}>
        {week.payoutAmount != null && <div className="bank-history-week bank-history-payout">
          <div className="bank-history-payout-row">
            <strong className="bank-history-week-label">Weeks 1-7 Payout</strong>
            <span className={week.payoutAmount < 0 ? "money-pos" : week.payoutAmount > 0 ? "money-neg" : "money-neutral"}><NumericText text={`${week.payoutAmount < 0 ? "Received" : week.payoutAmount > 0 ? "Paid" : "Settled"} ${stakeMoney(week.payoutAmount)}`} /></span>
            <span aria-hidden="true" className="bank-history-payout-spacer" />
          </div>
        </div>}
        <details className="bank-history-week">
        <summary>
          <strong className="bank-history-week-label">{`Week ${week.week}`}</strong>
          <span className={weekTotal > 0 ? "money-pos" : weekTotal < 0 ? "money-neg" : "money-neutral"}><NumericText text={money(weekTotal)} /></span>
          <ChevronDown size={16} />
        </summary>
        <div className="bank-history-week-body">
          {week.openingBalance != null && Number(week.openingBalance) !== 0 && <div className="bank-history-line">
            <span>Deposit</span>
            <strong className={week.openingBalance > 0 ? "money-pos" : week.openingBalance < 0 ? "money-neg" : "money-neutral"}><NumericText text={money(week.openingBalance)} /></strong>
          </div>}
          {week.weeklyAmount != null && <div className="bank-history-line">
            <span>Weekly Pick’em</span>
            <strong className={week.weeklyAmount > 0 ? "money-pos" : week.weeklyAmount < 0 ? "money-neg" : "money-neutral"}><NumericText text={money(week.weeklyAmount)} /></strong>
          </div>}
          {week.games.map((game) => {
            const awayFull = teamDisplayName(game.league, game.awayTeam);
            const homeFull = teamDisplayName(game.league, game.homeTeam);
            const awayCompact = teamAbbreviatedName(game.league, game.awayTeam);
            const homeCompact = teamAbbreviatedName(game.league, game.homeTeam);
            const selection = game.selections?.[player.id] || game.winningSelections?.[0];
            const oddsValue = selection ? Number(selection.odds || 100) : 100;
            const oddsText = selection && Math.abs(oddsValue) !== 100 ? americanOddsText(oddsValue) : "";
            const marketText = selection
              ? selection.marketType === "moneyline"
                ? ["ML", oddsText].filter(Boolean).join(" ")
                : selection.marketType === "total"
                  ? [`${totalSideText(selection.totalSide)} ${Number(selection.totalPoints)}`, oddsText].filter(Boolean).join(" ")
                  : [spreadText(selection.spread), oddsText].filter(Boolean).join(" ")
              : "";
            const fullMatchup = selection?.team === game.awayTeam
              ? `${awayFull} ${marketText} at ${homeFull}`
              : selection?.team === game.homeTeam
                ? `${awayFull} at ${homeFull} ${marketText}`
                : `${awayFull} at ${homeFull}`;
            const compactMatchup = selection?.team === game.awayTeam
              ? `${awayCompact} ${marketText} at ${homeCompact}`
              : selection?.team === game.homeTeam
                ? `${awayCompact} at ${homeCompact} ${marketText}`
                : `${awayCompact} at ${homeCompact}`;
            return <div className="bank-history-line bank-history-game-line" key={game.historyKey || game.gameId}>
              <span className="bank-history-game-copy">
                <ResponsiveText full={fullMatchup} compact={compactMatchup} />
                {game.playerBetCount > 1 && <small><NumericText text={`${game.playerBetCount} bets`} /></small>}
              </span>
              <strong className={game.playerAmount > 0 ? "money-pos" : game.playerAmount < 0 ? "money-neg" : "money-neutral"}><NumericText text={money(game.playerAmount)} /></strong>
            </div>;
          })}
        </div>
      </details>
      </Fragment>;
      })}
    </div>
  </details>;
}

export function BankWeekResults({ rows, picks, games, amounts, pointsMode, universalLockReached }: { rows: Array<Standing & { rank?: number }>; picks: Pick[]; games: Game[]; amounts: Record<string, number | null>; pointsMode: boolean; universalLockReached: boolean }) {
  return <div className="bank-week-results">
    <div className="bank-results-labels"><span>Player</span><span>Balance</span><span>{pointsMode ? "Points" : "Record"}</span><span aria-hidden="true" /></div>
    {rows.map((row) => {
    const playerPicks = picks
      .filter((pick) => pick.user_id === row.user_id)
      .sort((a, b) => {
        const typeOrder = Number(a.pick_type === "underdog") - Number(b.pick_type === "underdog");
        if (typeOrder !== 0) return typeOrder;
        const gameA = games.find((game) => game.id === a.game_id) || a.game;
        const gameB = games.find((game) => game.id === b.game_id) || b.game;
        return new Date(gameA?.commence_time || 0).getTime() - new Date(gameB?.commence_time || 0).getTime();
      });
    const amount = amounts[row.user_id];
    return <details className="bank-player-result" key={row.user_id}>
      <summary><strong className="bank-result-player">{row.display_name}</strong><span className={`bank-result-amount ${amount != null && amount > 0 ? "money-pos" : amount != null && amount < 0 ? "money-neg" : ""}`}>{amount == null ? "—" : <NumericText text={money(amount)} />}</span><span className="bank-result-record">{pointsMode ? <NumericText text={`${Number(row.points || 0)} pts`} /> : <RecordText wins={row.wins} losses={row.losses} pushes={row.pushes} />}</span><ChevronDown size={16} /></summary>
      {!playerPicks.length && <p className="muted">No visible picks yet.</p>}
      {playerPicks.map((pick) => {
        const game = games.find((item) => item.id === pick.game_id) || pick.game;
        const displayedSpread = pick.locked_spread != null ? Number(pick.locked_spread) : game ? normalizeSpreadForSelectedTeam(pick.selected_team, game.current_spread_team, game.current_spread) : null;
        const locked = pick.status === "locked" || Boolean(game && isClosed(game));
        const resultLabel = pick.result === "win" ? "W" : pick.result === "loss" ? "L" : pick.result === "push" ? "P" : "—";
        return <div className="bank-game-result" key={pick.id}>
          <TeamLogo url={game ? logoForTeam(game, pick.selected_team) : null} name={pick.selected_team} />
          <div><strong className="bank-game-pick-title">{game ? <ResponsiveTeamName game={game} team={pick.selected_team} className="pick-title-team" /> : <span className="pick-title-team">{pick.selected_team}</span>}<span className="pick-title-market"><NumericText text={spreadText(displayedSpread)} />{pick.pick_type === "underdog" && <><span className="dog-separator ui-separator-dot" aria-hidden="true">·</span><span className="dog-tag">Dog <NumericText text={dogBonusText(pick.underdog_win_value || "?", pointsMode)} /></span></>}{game && <PossessionIcon game={game} team={pick.selected_team} />}</span></strong>{game && <p><ResponsiveText full={`${displayTeamName(game, game.away_team)} at ${displayTeamName(game, game.home_team)}${hasPickScoreBug(game) ? isFinalGame(game) ? " · Final" : " · Live" : ` · ${cardGameStateText(game, true)}`}`} compact={`${abbreviatedTeamName(game, game.away_team)} at ${abbreviatedTeamName(game, game.home_team)}${hasPickScoreBug(game) ? isFinalGame(game) ? " · Final" : " · Live" : ` · ${cardGameStateText(game, true)}`}`} /></p>}</div>
          {game && hasPickScoreBug(game) ? <PickScoreBug game={game} pick={pick} spread={displayedSpread} /> : pick.result !== "pending" ? <span className={`test-result ${pick.result}`}>{resultLabel}</span> : locked ? <LockedPickIndicator hidden={universalLockReached} /> : null}
        </div>;
      })}
    </details>;
  })}</div>;
}

export function ConfidenceOrder({ picks, regularTotal, saving, onMove }: { picks: Pick[]; regularTotal: number; saving: boolean; onMove: (index: number, direction: -1 | 1) => void }) {
  function targetIndex(index: number, direction: -1 | 1) {
    if (picks[index]?.status === "locked") return -1;
    let target = index + direction;
    while (target >= 0 && target < picks.length && picks[target]?.status === "locked") target += direction;
    return target >= 0 && target < picks.length ? target : -1;
  }

  return <section className="confidence-order-panel">
    <div className="confidence-order-head"><strong>Confidence Order</strong>{saving && <span>Saving…</span>}</div>
    <div className="confidence-order-list">
      {picks.map((pick, index) => {
        const pickLocked = pick.status === "locked";
        return <div className={`confidence-order-row${pickLocked ? " locked" : ""}`} data-confidence-game-id={pick.game_id} key={pick.game_id}>
          <span className="confidence-value"><NumericText text={confidencePointText(Number(pick.confidence_points || Math.max(1, regularTotal - index)))} /></span>
          <strong>{pick.selected_team}</strong>
          <span className="confidence-move">
            <button type="button" aria-label={`Move ${pick.selected_team} up`} disabled={saving || pickLocked || targetIndex(index, -1) < 0} onClick={() => onMove(index, -1)}><ChevronUp size={15} /></button>
            <button type="button" aria-label={`Move ${pick.selected_team} down`} disabled={saving || pickLocked || targetIndex(index, 1) < 0} onClick={() => onMove(index, 1)}><ChevronDown size={15} /></button>
          </span>
        </div>;
      })}
    </div>
  </section>;
}

