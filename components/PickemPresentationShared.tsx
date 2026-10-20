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

export type Tab = "picks" | "card" | "standings" | "settings";
export type PicksView = "board" | "sideBets";
export type CardView = "mine" | "group";
export type StandingsView = "standings" | "bank";
export type BetView = "offers" | "new";
export type SideBetLeagueFilter = "CFB" | "NFL" | "CBB" | "NBA";
export type SideBetBoardMarket = "spreads" | "total";

export function defaultFootballLeague(): SideBetLeagueFilter {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short"
  }).format(new Date());
  return weekday === "Sun" || weekday === "Mon" ? "NFL" : "CFB";
}
export type SideBetLedgerScope = "all" | "mine";

export type GameStatusFilter = "OPEN" | "LOCKED" | "FINAL";
export type LeagueFilter = SideBetLeagueFilter | "DOGS";
export type DogValueFilter = "ALL" | "1" | "2" | "3";
export type GameOutcome = "win" | "loss" | "push";
export type Toast = { message: string; tone: "success" | "error" | "info" } | null;
export type NotificationDestination = "side_bets_received" | "side_bets_sent" | "my_card" | "league_cards" | "side_bet_ledger";
export type NotificationCounts = Record<NotificationDestination, number> & { total: number };
export type BadgeNavigator = Navigator & { setAppBadge?: (contents?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

export function stabilizeViewportAfterLayoutChange() {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      // Only correct an invalid scroll position after content shrinks.
      // The primary nav is pure fixed app chrome and must never be mutated
      // during scroll/visualViewport events; doing so makes iOS Safari/PWA
      // visibly lift the bar while the user scrolls.
      const doc = document.documentElement;
      const maxScroll = Math.max(0, doc.scrollHeight - window.innerHeight);
      // Do not force a scroll during async ledger or score changes. In mobile
      // Safari that can visibly shift position:fixed chrome as the page settles.
      // Keep normal user scrolling untouched; the nav remains CSS-fixed.
      void maxScroll;
    });
  });
}
export type LiveScoreUpdate = {
  id: string;
  final_home_score?: number | null;
  final_away_score?: number | null;
  live_home_score?: number | null;
  live_away_score?: number | null;
  live_status?: string | null;
  live_state?: string | null;
  live_completed?: boolean;
  live_possession_team?: string | null;
  live_situation?: string | null;
  live_red_zone?: boolean;
  live_down?: number | null;
  live_distance?: number | null;
  live_yards_to_goal?: number | null;
  live_home_timeouts?: number | null;
  live_away_timeouts?: number | null;
  live_home_win_probability?: number | null;
  live_away_win_probability?: number | null;
};
export type AppData = {
  currentUser: Profile;
  profiles: Profile[];
  games: Game[];
  picks: Pick[];
  standings: Standing[];
  weeklyStandingsByWeek: Record<string, Standing[]>;
  bankSettings: BankSettings;
  bankEntries: BankEntry[];
  bankHistory: BankHistoryWeek[];
  bankBalances?: Record<string, number>;
  bankAvailable?: Record<string, number>;
  bankReserved?: Record<string, number>;
  sideBets: SideBet[];
  sideBetLedger: SideBet[];
  sideBetSlotCounts: Record<string, number>;
  sideBetBankTotals: Record<string, number>;
  sideBetWeekTotals?: Record<string, number>;
  week: number;
  currentWeek?: number;
  weekRule: WeekRule;
  weekOpenTime: string | null;
  availableWeeks: number[];
  activeGroup?: { id: string; slug: string; name?: string };
  groupRules?: GroupRules;
  sideBetSettings?: { enabled: boolean; maxAmount: number | null; maxPerWeek: number | null; manualAmount: boolean };
  groupMoney?: { weeklyAmount: number; seasonAmount: number; weeklySubmitted: boolean; seasonSubmitted: boolean; canEdit: boolean; managerName: string | null };
};
export type AppDataCacheEntry = {
  cachedAt: number;
  payload: AppData;
};
export type SideBetSnapshot = {
  sideBets: SideBet[];
  sideBetSlotCounts?: Record<string, number>;
};

export const APP_DATA_CACHE_PREFIX = "pickem_app_data_v2";
export const APP_DATA_CACHE_MAX_AGE = 15 * 60 * 1000;
export const EMPTY_NOTIFICATION_COUNTS: NotificationCounts = { side_bets_received: 0, side_bets_sent: 0, my_card: 0, league_cards: 0, side_bet_ledger: 0, total: 0 };
export const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export const INITIAL_BOARD_LOGO_GAME_LIMIT = 8;
export const initialBoardLogoCache = new Set<string>();

export function preloadTeamLogo(url: string) {
  if (!url || initialBoardLogoCache.has(url) || typeof window === "undefined") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const image = new window.Image();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      initialBoardLogoCache.add(url);
      resolve();
    };
    const decodeAndFinish = () => {
      if (typeof image.decode !== "function") { finish(); return; }
      void image.decode().catch(() => undefined).finally(finish);
    };
    const timeout = window.setTimeout(finish, 1500);
    image.onload = decodeAndFinish;
    image.onerror = finish;
    image.decoding = "sync";
    image.fetchPriority = "high";
    image.src = url;
    if (image.complete) decodeAndFinish();
  });
}

export async function preloadInitialBoardLogos(payload: AppData) {
  if (typeof window === "undefined") return;
  const games = [...(payload.games || [])]
    .filter((game) => game.league === "CFB" && !isFinalGame(game))
    .sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime())
    .slice(0, INITIAL_BOARD_LOGO_GAME_LIMIT);
  const urls = Array.from(new Set(games.flatMap((game) => [game.away_logo_url, game.home_logo_url]).filter((url): url is string => Boolean(url))));
  await Promise.all(urls.map(preloadTeamLogo));
}

export const CENTRAL_WEEKDAY_SHORT_FORMATTER = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Chicago" });
export const CENTRAL_FULL_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Chicago" });
export const CENTRAL_OPEN_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
export const CENTRAL_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
export const CENTRAL_DAY_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Chicago" });
export const CENTRAL_DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "America/Chicago" });
export const CENTRAL_WEEKDAY_LONG_FORMATTER = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/Chicago" });

export function displayTeamName(game: Game, team: string) {
  return teamDisplayName(game.league, team);
}

export function abbreviatedTeamName(game: Game, team: string) {
  return teamAbbreviatedName(game.league, team);
}

export function matchupTextVariants(game: Game, options: { spreadTeam?: string; spread?: number | null; marketText?: string; suffix?: string; intermediateSuffix?: string; compactSuffix?: string } = {}) {
  const awayFull = displayTeamName(game, game.away_team);
  const homeFull = displayTeamName(game, game.home_team);
  const awayCompact = abbreviatedTeamName(game, game.away_team);
  const homeCompact = abbreviatedTeamName(game, game.home_team);
  const spreadTeam = options.spreadTeam;
  const fullSuffix = options.suffix || "";
  const compactSuffix = options.compactSuffix ?? fullSuffix;
  const intermediateSuffix = options.intermediateSuffix ?? compactSuffix;
  const preferredTeamToCompact = spreadTeam
    ? spreadTeam === game.away_team ? game.home_team : game.away_team
    : awayFull.length >= homeFull.length ? game.away_team : game.home_team;
  const preferredCanCompact = preferredTeamToCompact === game.away_team
    ? awayCompact !== awayFull
    : homeCompact !== homeFull;
  const alternateTeam = preferredTeamToCompact === game.away_team ? game.home_team : game.away_team;
  const alternateCanCompact = alternateTeam === game.away_team
    ? awayCompact !== awayFull
    : homeCompact !== homeFull;
  const firstTeamToCompact = preferredCanCompact || !alternateCanCompact ? preferredTeamToCompact : alternateTeam;
  const spread = options.spread ?? null;
  const marketText = options.marketText;
  const format = (away: string, home: string, suffix: string) => {
    const teamMarket = marketText ?? spreadText(spread);
    const awayMarket = spreadTeam === game.away_team ? ` ${teamMarket}` : "";
    const homeMarket = spreadTeam === game.home_team ? ` ${teamMarket}` : "";
    return `${away}${awayMarket} at ${home}${homeMarket}${suffix}`;
  };

  return {
    full: format(awayFull, homeFull, fullSuffix),
    intermediate: format(firstTeamToCompact === game.away_team ? awayCompact : awayFull, firstTeamToCompact === game.home_team ? homeCompact : homeFull, intermediateSuffix),
    compact: format(awayCompact, homeCompact, compactSuffix)
  };
}

export function ResponsiveText({ full, intermediate, compact, className = "", wrapOnSmall = false }: { full: string; intermediate?: string; compact: string; className?: string; wrapOnSmall?: boolean }) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const fullMeasureRef = useRef<HTMLSpanElement>(null);
  const intermediateMeasureRef = useRef<HTMLSpanElement>(null);
  const [variant, setVariant] = useState<"full" | "intermediate" | "compact">("full");

  useBrowserLayoutEffect(() => {
    const host = hostRef.current;
    const fullMeasure = fullMeasureRef.current;
    const intermediateMeasure = intermediateMeasureRef.current;
    if (!host || !fullMeasure || full === compact) {
      setVariant("full");
      return;
    }

    let active = true;
    const update = () => {
      if (!active) return;
      if (wrapOnSmall && window.innerWidth <= 360) {
        setVariant("full");
        return;
      }
      const availableWidth = host.clientWidth + 0.5;
      if (fullMeasure.getBoundingClientRect().width <= availableWidth) {
        setVariant("full");
      } else if (intermediate && intermediateMeasure && intermediateMeasure.getBoundingClientRect().width <= availableWidth) {
        setVariant("intermediate");
      } else {
        setVariant("compact");
      }
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(host);
    void document.fonts?.ready.then(update);
    window.addEventListener("resize", update);
    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [compact, full, intermediate, wrapOnSmall]);

  const value = variant === "full" ? full : variant === "intermediate" && intermediate ? intermediate : compact;

  return <span ref={hostRef} className={`responsive-text ${className} ${wrapOnSmall ? "responsive-text-wrap-small" : ""}`.trim()} aria-label={full} title={variant === "full" ? undefined : full}>
    <span ref={fullMeasureRef} className="responsive-text-measure" aria-hidden="true">{full}</span>
    {intermediate && <span ref={intermediateMeasureRef} className="responsive-text-measure" aria-hidden="true">{intermediate}</span>}
    <span className="responsive-text-value"><NumericText text={value} /></span>
  </span>;
}

export type SideBetResponseText = ReturnType<typeof sideBetResponseSummary>;
export type SideBetResponseVariant = "full" | "names" | "team" | "noSubject" | "minimal";
export const SIDE_BET_RESPONSE_VARIANTS: SideBetResponseVariant[] = ["full", "names", "team", "noSubject", "minimal"];

export function SideBetResponseLine({ summary, teamFull, teamCompact, spread, date }: { summary: SideBetResponseText; teamFull: string; teamCompact: string; spread: string; date?: string }) {
  const hostRef = useRef<HTMLParagraphElement>(null);
  const measureRefs = useRef<Partial<Record<SideBetResponseVariant, HTMLSpanElement | null>>>({});
  const [variant, setVariant] = useState<SideBetResponseVariant>("full");

  const contentFor = (value: SideBetResponseVariant) => ({
    subject: value === "noSubject" || value === "minimal" ? "" : value === "full" ? summary.subjectFull : summary.subjectCompact,
    recipient: value === "minimal" ? "" : value === "full" ? summary.recipientFull : summary.recipientCompact || summary.recipientFull,
    team: value === "full" || value === "names" ? teamFull : teamCompact
  });

  useBrowserLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let active = true;
    const update = () => {
      if (!active) return;
      if (window.innerWidth <= 360) {
        setVariant("full");
        return;
      }
      const availableWidth = host.clientWidth + 0.5;
      const fittingVariant = SIDE_BET_RESPONSE_VARIANTS.find((value) => {
        const measure = measureRefs.current[value];
        return measure && measure.getBoundingClientRect().width <= availableWidth;
      });
      setVariant(fittingVariant || "minimal");
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(host);
    window.addEventListener("resize", update);
    document.fonts?.ready.then(update).catch(() => undefined);
    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [date, spread, summary, teamCompact, teamFull]);

  const renderContent = (value: SideBetResponseVariant) => {
    const content = contentFor(value);
    return <>
      {content.subject && <span>{content.subject}</span>}
      <span className={`side-bet-response ${summary.tone}`}>{summary.action}</span>
      {content.team && <span>{content.team}</span>}
      <NumericText text={spread} />
      {content.recipient && <span>{content.recipient}</span>}
      {date && <span><span className="ui-separator-dot" aria-hidden="true">·</span><NumericText text={date} /></span>}
    </>;
  };
  const fullLabel = [summary.subjectFull, summary.action, teamFull, spread, summary.recipientFull, date ? `· ${date}` : ""].filter(Boolean).join(" ");

  return <p ref={hostRef} className="side-bet-response-line" aria-label={fullLabel} title={variant === "full" ? undefined : fullLabel}>
    {SIDE_BET_RESPONSE_VARIANTS.map((value) => <span ref={(element) => { measureRefs.current[value] = element; }} className="side-bet-response-measure" aria-hidden="true" key={value}>{renderContent(value)}</span>)}
    <span className="side-bet-response-value">{renderContent(variant)}</span>
  </p>;
}

export function ResponsiveTeamName({ game, team, className = "" }: { game: Game; team: string; className?: string }) {
  return <ResponsiveText full={displayTeamName(game, team)} compact={abbreviatedTeamName(game, team)} className={className} />;
}

export function teamRank(game: Game, team: string) {
  if (game.league !== "CFB" && game.league !== "CBB") return null;
  const rank = Number(team === game.home_team ? game.home_rank : game.away_rank);
  return Number.isInteger(rank) && rank >= 1 && rank <= 25 ? rank : null;
}

export function BoardTeamName({ game, team }: { game: Game; team: string }) {
  const rank = teamRank(game, team);
  return <span className="board-ranked-team-name">
    {rank != null && <span className="board-team-rank" aria-label={`Ranked ${rank}`}>#{rank}</span>}
    <ResponsiveTeamName game={game} team={team} className="team-name" />
  </span>;
}

export function weekdayAbbreviation(iso: string) {
  return CENTRAL_WEEKDAY_SHORT_FORMATTER.format(new Date(iso)).slice(0, 3);
}
export function dt(iso: string) {
  return `${weekdayAbbreviation(iso)} ${timeText(iso)}`;
}
export function fullDateText(iso: string) {
  return formatOrdinalDate(CENTRAL_FULL_DATE_FORMATTER, new Date(iso));
}
export function openText(iso: string) {
  return formatOrdinalDate(CENTRAL_OPEN_DATE_FORMATTER, new Date(iso));
}
export function cardGameStateText(game: Game, locked: boolean) {
  if (game.final_away_score != null && game.final_home_score != null) {
    return `Final ${game.final_away_score}-${game.final_home_score}`;
  }
  if ((game.live_completed || game.live_state === "post") && game.live_away_score != null && game.live_home_score != null) {
    return `Final ${game.live_away_score}-${game.live_home_score}`;
  }
  if (locked) {
    if (new Date(game.commence_time) > new Date()) return dt(game.commence_time);
    if (game.live_state === "in" && game.live_away_score != null && game.live_home_score != null) {
      return `${game.live_away_score}-${game.live_home_score}`;
    }
    if (game.live_status) return liveGameStatus(game);
    return "Score updating";
  }
  return dt(game.commence_time);
}
export function timeText(iso: string) {
  return CENTRAL_TIME_FORMATTER.format(new Date(iso));
}
export function gameDayKey(iso: string) {
  return CENTRAL_DAY_KEY_FORMATTER.format(new Date(iso));
}
export function gameDayLabel(iso: string) {
  return formatUppercaseOrdinalDate(CENTRAL_DAY_LABEL_FORMATTER, new Date(iso));
}
export function gameDayShort(iso: string) {
  return CENTRAL_WEEKDAY_LONG_FORMATTER.format(new Date(iso)).toUpperCase();
}
export function spreadForTeam(game: Game, team: string) {
  return spreadText(normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread));
}
export function isClosed(game: Game) {
  return game.is_locked || new Date(game.lock_time) <= new Date();
}
export function isFinalGame(game: Game) {
  return (game.final_away_score != null && game.final_home_score != null) || Boolean(game.live_completed) || game.live_state === "post";
}
export function universalWeekendLockTime(games: Game[]) {
  const candidates = games.flatMap((game) => {
    const lock = new Date(game.lock_time).getTime();
    const kickoff = new Date(game.commence_time).getTime();
    if (!Number.isFinite(lock) || !Number.isFinite(kickoff) || lock >= kickoff - 60_000) return [];
    return [lock];
  });
  return candidates.length ? Math.min(...candidates) : null;
}
export function LockedPickIndicator({ hidden = false }: { hidden?: boolean }) {
  if (hidden) return null;
  return <span className="pick-lock-indicator" aria-label="Locked"><Lock size={14} aria-hidden="true" /></span>;
}
export function boardStatusForGame(game: Game, now: number, weekIsOpen: boolean): GameStatusFilter {
  if (isFinalGame(game)) return "FINAL";
  const locked = game.is_locked || new Date(game.lock_time).getTime() <= now || new Date(game.commence_time).getTime() <= now;
  return locked || !weekIsOpen ? "LOCKED" : "OPEN";
}
export function defaultBoardStatus(games: Game[], now: number, weekIsOpen: boolean): GameStatusFilter {
  const statuses: GameStatusFilter[] = ["OPEN", "LOCKED", "FINAL"];
  return statuses.find((status) => games.some((game) => boardStatusForGame(game, now, weekIsOpen) === status)) || "OPEN";
}
export function livePeriodStatus(game: Game) {
  const detail = game.live_status?.trim() || "";
  const quarter = detail.match(/\b(1st|2nd|3rd|4th)\b/i)?.[1];
  const clock = detail.match(/\b\d{1,2}:\d{2}\b/)?.[0];
  let status = detail || "Score updating";

  if (/\bhalftime\b/i.test(detail)) {
    status = "Halftime";
  } else if (/\bOT\b/i.test(detail)) {
    status = clock ? `OT · ${clock}` : "OT";
  } else if (quarter && clock) {
    status = `${quarter} ${game.league === "CBB" ? "Half" : "Qtr"} · ${clock}`;
  } else if (quarter) {
    status = `${quarter} ${game.league === "CBB" ? "Half" : "Qtr"}`;
  } else if (clock) {
    status = clock;
  }

  return status;
}
export function liveSituationStatus(game: Game) {
  return (game.live_situation?.trim() || "").replace(/\s+at\s+/i, " · ");
}

export function LivePeriodText({ game }: { game: Game }) {
  const status = livePeriodStatus(game);
  const parts = status.split(/\s*·\s*/, 2);
  if (parts.length < 2) return <NumericText text={status} />;
  return <><NumericText text={parts[0]} /><span className="live-header-dot ui-separator-dot">·</span><NumericText text={parts[1]} /></>;
}

export function LiveSituationText({ game }: { game: Game }) {
  const situation = game.live_situation?.trim() || "";
  const match = situation.match(/^(.*?)\s+at\s+(.+)$/i);
  if (!match) return <NumericText text={situation} />;
  return <><NumericText text={match[1]} /><span className="live-header-dot ui-separator-dot">·</span><span className={game.live_red_zone ? "red-zone-field" : ""}><NumericText text={match[2]} /></span></>;
}
export function liveGameStatus(game: Game) {
  const status = livePeriodStatus(game);
  const situation = liveSituationStatus(game);
  return situation && status !== "Halftime" ? `${status} · ${situation}` : status;
}

export function liveRemainingFraction(game: Game) {
  const detail = game.live_status?.trim() || "";
  if (/halftime/i.test(detail)) return 0.5;
  if (/\bOT\b/i.test(detail)) return 0.035;
  const quarterText = detail.match(/\b(1st|2nd|3rd|4th)\b/i)?.[1]?.toLowerCase();
  const quarter = quarterText ? { "1st": 1, "2nd": 2, "3rd": 3, "4th": 4 }[quarterText] : null;
  if (!quarter) return 0.5;
  const clock = detail.match(/\b(\d{1,2}):(\d{2})\b/);
  const secondsInQuarter = clock ? Number(clock[1]) * 60 + Number(clock[2]) : 0;
  const remainingSeconds = (4 - quarter) * 15 * 60 + secondsInQuarter;
  return Math.max(0, Math.min(1, remainingSeconds / (4 * 15 * 60)));
}

export function normalCdf(value: number) {
  const absolute = Math.abs(value);
  const t = 1 / (1 + 0.2316419 * absolute);
  const density = 0.3989423 * Math.exp(-absolute * absolute / 2);
  const probability = 1 - density * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return value >= 0 ? probability : 1 - probability;
}

export function livePeriodAndClock(game: Game) {
  const detail = game.live_status?.trim() || "";
  const quarterText = detail.match(/\b(1st|2nd|3rd|4th)\b/i)?.[1]?.toLowerCase();
  const quarter = quarterText ? { "1st": 1, "2nd": 2, "3rd": 3, "4th": 4 }[quarterText] : null;
  const clock = detail.match(/\b(\d{1,2}):(\d{2})\b/);
  return {
    quarter,
    clockSeconds: clock ? Number(clock[1]) * 60 + Number(clock[2]) : null
  };
}

export function liveModelStrategy(game: Game) {
  const { quarter, clockSeconds } = livePeriodAndClock(game);
  const homeScore = game.live_home_score;
  const awayScore = game.live_away_score;
  if (quarter !== 4 || clockSeconds == null || clockSeconds > 8 * 60 || homeScore == null || awayScore == null || !game.live_possession_team) {
    return { possessionScoringFactor: 1, remainingStrengthFactor: 1, volatilityFactor: 1, canDrainClock: false };
  }

  const possessionIsHome = game.live_possession_team === game.home_team;
  const possessionMargin = possessionIsHome ? homeScore - awayScore : awayScore - homeScore;
  const opponentTimeouts = possessionIsHome ? game.live_away_timeouts : game.live_home_timeouts;
  const down = game.live_down ?? 1;
  const clockIntervals = Math.max(0, 3 - down);
  const drainableIntervals = Math.max(0, clockIntervals - (opponentTimeouts ?? 3));
  const canDrainClock = possessionMargin > 0 && clockSeconds <= drainableIntervals * 38 + 5;
  if (canDrainClock) {
    return { possessionScoringFactor: 0.05, remainingStrengthFactor: 0.05, volatilityFactor: 0.28, canDrainClock: true };
  }

  const lateFactor = 1 - clockSeconds / (8 * 60);
  if (possessionMargin > 0) {
    const leadFactor = Math.min(1, possessionMargin / 16);
    const conservativeFactor = Math.min(0.58, 0.12 + lateFactor * leadFactor * 0.52);
    return {
      possessionScoringFactor: 1 - conservativeFactor,
      remainingStrengthFactor: 1 - conservativeFactor * 0.52,
      volatilityFactor: 1 - conservativeFactor * 0.38,
      canDrainClock: false
    };
  }

  if (possessionMargin < 0) {
    const urgency = lateFactor * Math.min(1, Math.abs(possessionMargin) / 14);
    return {
      possessionScoringFactor: 1,
      remainingStrengthFactor: 1,
      volatilityFactor: 1 + urgency * 0.12,
      canDrainClock: false
    };
  }

  return { possessionScoringFactor: 1, remainingStrengthFactor: 1, volatilityFactor: 1, canDrainClock: false };
}

export function expectedPossessionPoints(game: Game) {
  const yardsToGoal = game.live_yards_to_goal;
  if (yardsToGoal == null) return (game.live_red_zone ? 2.25 : 0.65) * liveModelStrategy(game).possessionScoringFactor;

  const clampedYardsToGoal = Math.max(1, Math.min(99, yardsToGoal));
  const fieldProgress = (100 - clampedYardsToGoal) / 100;
  let expectedPoints = 6.4 * fieldProgress * fieldProgress;
  const down = game.live_down;
  const distance = Math.max(0, game.live_distance ?? 10);
  const excessDistance = Math.max(0, distance - 3);

  if (down === 2) expectedPoints -= 0.08 + 0.025 * excessDistance;
  if (down === 3) expectedPoints -= 0.22 + 0.07 * excessDistance;
  if (down === 4) expectedPoints -= 0.45 + 0.09 * excessDistance;

  if ((down === 3 || down === 4) && clampedYardsToGoal <= 43) {
    const fieldGoalDistance = clampedYardsToGoal + 17;
    const fieldGoalMakeChance = 1 / (1 + Math.exp((fieldGoalDistance - 52) / 5.5));
    expectedPoints = Math.max(expectedPoints, 3 * fieldGoalMakeChance);
  }

  if (clampedYardsToGoal > 95) expectedPoints -= (clampedYardsToGoal - 95) * 0.12;

  const { quarter, clockSeconds } = livePeriodAndClock(game);
  if ((quarter === 2 || quarter === 4) && clockSeconds != null && clockSeconds < 60) {
    const secondsNeeded = clampedYardsToGoal <= 35
      ? 6
      : Math.min(45, 12 + (clampedYardsToGoal - 35) * 0.65);
    expectedPoints *= Math.max(0.05, Math.min(1, clockSeconds / secondsNeeded));
  }

  return Math.max(-0.75, Math.min(6.4, expectedPoints)) * liveModelStrategy(game).possessionScoringFactor;
}

export function liveProbabilityVolatility(game: Game, remaining: number) {
  const strategy = liveModelStrategy(game);
  const leagueBase = game.league === "CFB" ? 16.5 : 13.86;
  const minimum = strategy.canDrainClock ? 0.45 : game.league === "CFB" ? 1.8 : 1.5;
  return Math.max(minimum, leagueBase * Math.sqrt(remaining) * strategy.volatilityFactor);
}

export function estimatedCoverChance(game: Game, team: string, spread: number | null) {
  if (isBasketballLeague(game.league)) return null;
  if (spread == null || game.live_away_score == null || game.live_home_score == null || game.live_state !== "in") return null;
  const teamScore = team === game.home_team ? game.live_home_score : game.live_away_score;
  const opponentScore = team === game.home_team ? game.live_away_score : game.live_home_score;
  const remaining = liveRemainingFraction(game);
  const possessionDirection = game.live_possession_team === team ? 1 : game.live_possession_team ? -1 : 0;
  const possessionValue = possessionDirection * expectedPossessionPoints(game);
  const expectedFinalMargin = teamScore - opponentScore + remaining * -spread * liveModelStrategy(game).remainingStrengthFactor + possessionValue;
  const atsMean = expectedFinalMargin + spread;
  const remainingVolatility = liveProbabilityVolatility(game, remaining);
  return Math.max(1, Math.min(99, Math.round(normalCdf(atsMean / remainingVolatility) * 100)));
}

export function espnWinChance(game: Game, team: string) {
  const probability = team === game.home_team ? game.live_home_win_probability : game.live_away_win_probability;
  return probability == null ? null : Math.max(0, Math.min(100, Math.round(probability * 100)));
}

export function estimatedWinChance(game: Game, team: string) {
  if (isBasketballLeague(game.league)) return null;
  if (game.live_away_score == null || game.live_home_score == null || game.live_state !== "in") return null;
  const spread = normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread);
  if (spread == null) return null;
  const teamScore = team === game.home_team ? game.live_home_score : game.live_away_score;
  const opponentScore = team === game.home_team ? game.live_away_score : game.live_home_score;
  const remaining = liveRemainingFraction(game);
  const possessionDirection = game.live_possession_team === team ? 1 : game.live_possession_team ? -1 : 0;
  const expectedFinalMargin = teamScore - opponentScore +
    remaining * -spread * liveModelStrategy(game).remainingStrengthFactor +
    possessionDirection * expectedPossessionPoints(game);
  return Math.max(1, Math.min(99, Math.round(normalCdf(expectedFinalMargin / liveProbabilityVolatility(game, remaining)) * 100)));
}

export function liveWinChance(game: Game, team: string) {
  return espnWinChance(game, team) ?? estimatedWinChance(game, team);
}

export function liveOutcome(game: Game, team: string, spread: number, outright = false): GameOutcome | null {
  const homeScore = game.live_home_score ?? game.final_home_score;
  const awayScore = game.live_away_score ?? game.final_away_score;
  if (homeScore == null || awayScore == null) return null;
  return outright
    ? gradeUnderdogOutright(team, game.home_team, game.away_team, homeScore, awayScore)
    : gradeAgainstSpread(team, game.home_team, game.away_team, homeScore, awayScore, spread);
}

export function scoreChanged(previous: Game, next: Game) {
  return previous.live_home_score !== next.live_home_score || previous.live_away_score !== next.live_away_score;
}

export function finalScoreText(game: Game) {
  const awayScore = game.final_away_score ?? game.live_away_score;
  const homeScore = game.final_home_score ?? game.live_home_score;
  return `${displayTeamName(game, game.away_team)} ${awayScore ?? "–"}, ${displayTeamName(game, game.home_team)} ${homeScore ?? "–"}`;
}

export function outcomeLabel(outcome: GameOutcome, outright: boolean) {
  if (outcome === "push") return "pushed";
  if (outright) return outcome === "win" ? "won outright" : "lost";
  return outcome === "win" ? "covered" : "did not cover";
}

export function buildLiveAlert(current: AppData, nextGames: Game[]): NonNullable<Toast> | null {
  const nextById = new Map(nextGames.map((game) => [game.id, game]));
  const currentUserId = current.currentUser.id;
  const relevantPicks = current.picks.filter((pick) => pick.user_id === currentUserId && pick.week === current.week);
  const relevantBets = current.sideBets.filter((bet) => bet.status === "accepted" && (bet.creator_id === currentUserId || bet.accepted_by === currentUserId));

  for (const previous of current.games) {
    const next = nextById.get(previous.id);
    const situationChanged = previous.live_situation !== next?.live_situation ||
      previous.live_down !== next?.live_down ||
      previous.live_distance !== next?.live_distance ||
      previous.live_yards_to_goal !== next?.live_yards_to_goal;
    if (!next || (!scoreChanged(previous, next) && !situationChanged && previous.live_red_zone === next.live_red_zone && previous.live_possession_team === next.live_possession_team && isFinalGame(previous) === isFinalGame(next))) continue;

    const pick = relevantPicks.find((item) => item.game_id === next.id);
    const bet = relevantBets.find((item) => item.game_id === next.id);
    const team = pick?.selected_team || (bet?.creator_id === currentUserId ? bet.creator_team : bet?.offered_team);
    const spread = pick
      ? pick.locked_spread ?? normalizeSpreadForSelectedTeam(pick.selected_team, next.current_spread_team, next.current_spread)
      : bet
      ? Number(bet.creator_id === currentUserId ? bet.creator_spread : bet.offered_spread)
      : null;
    if (!team || spread == null) continue;

    const outright = pick?.pick_type === "underdog";
    const previousOutcome = liveOutcome(previous, team, spread, outright);
    const nextOutcome = liveOutcome(next, team, spread, outright);
    const label = displayTeamName(next, team);

    if (!isFinalGame(previous) && isFinalGame(next) && nextOutcome) {
      return {
        message: `${pick ? "Pick" : "Side bet"} final: ${finalScoreText(next)}. ${label} ${outcomeLabel(nextOutcome, outright)}.`,
        tone: nextOutcome === "win" ? "success" : nextOutcome === "loss" ? "error" : "info"
      };
    }

    if (scoreChanged(previous, next) && previousOutcome && nextOutcome && previousOutcome !== nextOutcome) {
      const movement = outright
        ? nextOutcome === "win" ? "moved into a winning position" : nextOutcome === "push" ? "is tied" : "fell behind"
        : nextOutcome === "win" ? "moved into covering" : nextOutcome === "push" ? "moved to a push" : "fell behind the spread";
      const nextChance = outright ? liveWinChance(next, team) : estimatedCoverChance(next, team, spread);
      return { message: `${label} ${movement}. ${outright ? "Win" : "Estimated cover"} chance: ${nextChance ?? "–"}%.`, tone: nextOutcome === "win" ? "success" : "info" };
    }

    const previousChance = outright ? liveWinChance(previous, team) : estimatedCoverChance(previous, team, spread);
    const nextChance = outright ? liveWinChance(next, team) : estimatedCoverChance(next, team, spread);
    if (previousChance != null && nextChance != null && Math.abs(nextChance - previousChance) >= 15) {
      return {
        message: `Big swing: ${label}'s ${outright ? "win" : "estimated cover"} chance ${nextChance > previousChance ? "rose" : "fell"} to ${nextChance}%.`,
        tone: nextChance > previousChance ? "success" : "info"
      };
    }
  }

  return null;
}
export function teamDogValue(game: Game, team: string) {
  return underdogWinValue(normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread));
}

export function gameConferences(game: Game) {
  const awayConference = cfbConferenceForLogo(game.away_logo_url);
  const homeConference = cfbConferenceForLogo(game.home_logo_url);
  if (!awayConference) return homeConference ? [homeConference] : [];
  return homeConference && homeConference !== awayConference
    ? [awayConference, homeConference]
    : [awayConference];
}

export function appDataCacheKey(appSlug: AppSlug, week: number | null) {
  return `${APP_DATA_CACHE_PREFIX}:${appSlug}:${week == null ? "default" : week}`;
}

export function readCachedAppData(appSlug: AppSlug, week: number | null) {
  const key = appDataCacheKey(appSlug, week);
  try {
    const stored = window.sessionStorage.getItem(key);
    if (!stored) return null;
    const entry = JSON.parse(stored) as AppDataCacheEntry;
    const storedProfile = JSON.parse(window.localStorage.getItem("pickem_profile") || "null") as Profile | null;
    if (!entry?.payload?.currentUser || !storedProfile || entry.payload.currentUser.id !== storedProfile.id || Date.now() - entry.cachedAt > APP_DATA_CACHE_MAX_AGE) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return entry.payload;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

export function writeCachedAppData(appSlug: AppSlug, week: number | null, payload: AppData) {
  window.setTimeout(() => {
    try {
      window.sessionStorage.setItem(appDataCacheKey(appSlug, week), JSON.stringify({ cachedAt: Date.now(), payload } satisfies AppDataCacheEntry));
    } catch {
      // The app still works normally if private browsing or storage limits block this cache.
    }
  }, 0);
}

export function sideBetSyncSignature(bets: SideBet[] = []) {
  return bets.map((bet) => ({
    id: bet.id,
    status: bet.status,
    acceptedBy: bet.accepted_by,
    winnerId: bet.winner_id,
    result: bet.result,
    updatedAt: bet.updated_at,
    targets: (bet.targets || []).map((target) => `${target.recipient_id}:${target.response}:${target.responded_at || ""}`).sort()
  })).sort((a, b) => a.id.localeCompare(b.id)).map((bet) => JSON.stringify(bet)).join("|");
}

export function sideBetLedgerSignature(bets: SideBet[] = []) {
  return bets.map((bet) => `${bet.id}:${bet.status}:${bet.result}:${bet.winner_id || ""}:${bet.updated_at}`).sort().join("|");
}

export function logoForTeam(game: Game, team: string) {
  return team === game.home_team ? game.home_logo_url : game.away_logo_url;
}
export function sideBetAmountForUser(bet: SideBet, userId: string) {
  const riskValue = sideBetRiskForUser(bet, userId);
  const winValue = sideBetProfitForUser(bet, userId);
  const risk = stakeMoney(riskValue);
  const win = stakeMoney(winValue);
  const evenPayout = Math.abs(riskValue - winValue) < 0.005;
  if (bet.status !== "settled") {
    return { settled: false, text: evenPayout ? risk : "", risk, win, evenPayout, tone: "money-neutral" };
  }
  if (bet.result === "push") {
    return { settled: true, text: "$0", risk, win, evenPayout, tone: "money-neutral" };
  }
  const net = sideBetNetForUser(bet, userId);
  return {
    settled: true,
    text: money(net),
    risk,
    win,
    evenPayout,
    tone: net > 0 ? "money-pos" : net < 0 ? "money-neg" : "money-neutral"
  };
}

export function totalSideText(side: SideBetTotalSide | null | undefined) {
  return side === "under" ? "U" : "O";
}

export function sideBetTotalMatchupText(game: Game, marketText: string, compact = false) {
  const away = compact ? abbreviatedTeamName(game, game.away_team) : displayTeamName(game, game.away_team);
  const home = compact ? abbreviatedTeamName(game, game.home_team) : displayTeamName(game, game.home_team);
  return `${away} at ${home} ${marketText}`;
}

export function MatchupLogoPair({ game, className = "" }: { game: Game; className?: string }) {
  return <span className={`matchup-logo-pair ${className}`.trim()} aria-hidden="true">
    <TeamLogo url={logoForTeam(game, game.away_team)} name={game.away_team} />
    <TeamLogo url={logoForTeam(game, game.home_team)} name={game.home_team} />
  </span>;
}

export function sideBetAppMarketReference(bet: SideBet, team: string, quote?: SideBetMarketQuote | null) {
  const live = bet.offer_phase === "live";
  const expectedPhase: SideBetOfferPhase = live ? "live" : "pregame";
  const offerOdds = sideBetOddsForTeam(bet, team);
  if (!quote || quote.phase !== expectedPhase) return live ? { text: "Market: Unavailable" } : null;

  if (bet.market_type === "moneyline") {
    const market = quote.moneyline;
    if (!market || market.suspended) return live ? { text: "Market: Suspended" } : null;
    const away = team === bet.game?.away_team;
    const rawTeamOdds = away ? market.awayOdds : market.homeOdds;
    const rawOpponentOdds = away ? market.homeOdds : market.awayOdds;
    const marketOdds = fairSymmetricMoneyline(rawTeamOdds, rawOpponentOdds) ?? rawTeamOdds;
    const same = Number(marketOdds) === Number(offerOdds);
    if (!live && same) return null;
    return { text: `Market: ${bet.game ? displayTeamName(bet.game, team) : team} ML ${americanOddsText(marketOdds)}` };
  }

  if (bet.market_type === "total") {
    const market = quote.total;
    if (!market || market.suspended) return live ? { text: "Market: Suspended" } : null;
    const side = sideBetTotalSideForTeam(bet, team);
    const marketPoints = Number(market.points);
    const offerPoints = Number(bet.total_points);
    const sameLine = Math.abs(marketPoints - offerPoints) < 0.001;
    const sameOffer = sameLine && Number(offerOdds) === 100;
    if (!live && sameOffer) return null;

    const baseText = `Market: ${totalSideText(side)} ${marketPoints}`;
    if (sameLine) return { text: baseText };

    const fairOfferOdds = fairAltTotalOdds(marketPoints, offerPoints, side);
    return { text: `${baseText} · ${totalSideText(side)} ${offerPoints} ${americanOddsText(fairOfferOdds)}` };
  }

  const market = quote.spread;
  if (!market || market.suspended) return live ? { text: "Market: Suspended" } : null;
  const away = team === bet.game?.away_team;
  const marketSpread = Number(away ? market.awayPoint : market.homePoint);
  const offerSpread = Number(team === bet.creator_team ? bet.creator_spread : bet.offered_spread);
  const sameLine = Math.abs(marketSpread - offerSpread) < 0.001;
  const sameOffer = sameLine && Number(offerOdds) === 100;
  if (!live && sameOffer) return null;

  const baseText = `Market: ${spreadText(marketSpread)}`;
  if (sameLine) return { text: baseText };

  const teamMoneylineOdds = away ? quote.moneyline?.awayOdds : quote.moneyline?.homeOdds;
  const opponentMoneylineOdds = away ? quote.moneyline?.homeOdds : quote.moneyline?.awayOdds;
  const fairOfferOdds = fairAltSpreadOdds(marketSpread, offerSpread, {
    teamMoneylineOdds,
    opponentMoneylineOdds,
    league: bet.game?.league
  });
  return { text: `${baseText} · ${spreadText(offerSpread)} ${americanOddsText(fairOfferOdds)}` };
}
export function SideBetMarketReferenceText({ text }: { text: string }) {
  const separator = " · ";
  const separatorIndex = text.indexOf(separator);
  if (separatorIndex < 0) return <NumericText text={text} />;

  const first = text.slice(0, separatorIndex);
  const second = text.slice(separatorIndex + separator.length);
  return <span className="side-bet-market-inline">
    <span className="side-bet-market-leg"><NumericText text={first} /></span>
    <span className="ui-separator-dot side-bet-market-dot" aria-hidden="true">·</span>
    <span className="side-bet-market-leg"><NumericText text={second} /></span>
  </span>;
}

export function pctText(value: number) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

export function RecordText({ wins, losses, pushes }: { wins: number; losses: number; pushes: number }) {
  return <NumericText text={`${wins}-${losses}-${pushes}`} />;
}


export function TeamLogo({ url, name, className = "" }: { url?: string | null; name: string; className?: string }) {
  const classes = `team-logo ${className}`.trim();
  if (url) return <NextImage unoptimized src={url} alt="" className={classes} width={68} height={68} loading="eager" decoding="async" />;
  return <div className={`${classes} fallback`}>{name.slice(0, 1)}</div>;
}

