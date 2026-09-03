"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, ChevronDown, ChevronUp, CircleCheckBig, CircleDollarSign, FlaskConical, LoaderCircle, Send, Shield, SquareCheck, Trash2, Trophy, X, Zap } from "lucide-react";
import type { BankEntry, BankSettings, Game, Pick, PickType, Profile, SideBet, Standing, WeekRule } from "@/lib/types";
import { MAX_SIDE_BET_AMOUNT, hasAvailableSideBetSlot } from "@/lib/sideBetLimits";
import { gradeAgainstSpread, gradeUnderdogOutright, normalizeSpreadForSelectedTeam, spreadText, underdogWinValue } from "@/lib/spreads";
import { countRegularByLeague, getWeekRule } from "@/lib/weekRules";
import { computeWeeklySettlement, computeWeeklyStandings } from "@/lib/weeklyBank";
import { cfbConferenceForLogo, FBS_INDEPENDENTS_CONFERENCE, GROUP_CONFERENCES, POWER_CONFERENCES } from "@/lib/cfbConferences";
import MenuSelect from "@/components/MenuSelect";
import NumericText from "@/components/NumericText";
import NotificationBadge from "@/components/NotificationBadge";
import PushNotificationControls from "@/components/PushNotificationControls";
import GroupMoneyControls from "@/components/GroupMoneyControls";
import { moveConfidencePick, normalizeConfidenceCard } from "@/lib/confidencePoints";
import { ruleSections, type AppSlug, type GroupRules } from "@/lib/rulePresentation";
import { appLoginPath } from "@/lib/appIdentity";
import { sideBetBettorForTeam, sideBetLedgerPerspective, sideBetOfferIsPending, sideBetPerspective, sideBetResponseSummary, sideBetsForView } from "@/lib/sideBetPresentation";
import { orderCardPicks } from "@/lib/cardOrdering";
import { teamAbbreviatedName, teamDisplayName } from "@/lib/teamNames";

type Tab = "picks" | "card" | "standings" | "rules";
type PicksView = "board" | "sideBets";
type CardView = "mine" | "group";
type StandingsView = "standings" | "bank";
type BetView = "offers" | "new";
type SideBetLeagueFilter = "CFB" | "NFL";
type GameStatusFilter = "OPEN" | "LOCKED" | "FINAL";
type LeagueFilter = "CFB" | "NFL" | "DOGS";
type DogValueFilter = "ALL" | "1" | "2" | "3";
type GameOutcome = "win" | "loss" | "push";
type Toast = { message: string; tone: "success" | "error" | "info" } | null;
type NotificationDestination = "side_bets_received" | "side_bets_sent" | "my_card" | "league_cards" | "side_bet_ledger";
type NotificationCounts = Record<NotificationDestination, number> & { total: number };
type BadgeNavigator = Navigator & { setAppBadge?: (contents?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
type LiveScoreUpdate = {
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
type TestPickRow = {
  id: string;
  gameId: string;
  team: string;
  spread: number;
  matchup: string;
  finalScore: string;
  result: "win" | "loss" | "push" | "pending";
  dogValue?: number;
};

type AppData = {
  currentUser: Profile;
  profiles: Profile[];
  games: Game[];
  picks: Pick[];
  standings: Standing[];
  weeklyStandingsByWeek: Record<string, Standing[]>;
  bankSettings: BankSettings;
  bankEntries: BankEntry[];
  sideBets: SideBet[];
  sideBetSlotCounts: Record<string, number>;
  sideBetBankTotals: Record<string, number>;
  week: number;
  weekRule: WeekRule;
  weekOpenTime: string | null;
  availableWeeks: number[];
  activeGroup?: { id: string; slug: string; name?: string };
  groupRules?: GroupRules;
  sideBetSettings?: { enabled: boolean; maxAmount: number | null; maxPerWeek: number | null; manualAmount: boolean };
  groupMoney?: { weeklyAmount: number; seasonAmount: number; weeklySubmitted: boolean; seasonSubmitted: boolean; canEdit: boolean; managerName: string | null };
};
type AppDataCacheEntry = {
  cachedAt: number;
  payload: AppData;
};
type SideBetSnapshot = {
  sideBets: SideBet[];
  sideBetSlotCounts?: Record<string, number>;
};

const APP_DATA_CACHE_PREFIX = "pickem_app_data_v1";
const APP_DATA_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
const EMPTY_NOTIFICATION_COUNTS: NotificationCounts = { side_bets_received: 0, side_bets_sent: 0, my_card: 0, league_cards: 0, side_bet_ledger: 0, total: 0 };

const CENTRAL_WEEKDAY_SHORT_FORMATTER = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Chicago" });
const CENTRAL_FULL_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Chicago" });
const CENTRAL_OPEN_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
const CENTRAL_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
const CENTRAL_DAY_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Chicago" });
const CENTRAL_DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "America/Chicago" });
const CENTRAL_WEEKDAY_LONG_FORMATTER = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/Chicago" });

function displayTeamName(game: Game, team: string) {
  return teamDisplayName(game.league, team);
}

function abbreviatedTeamName(game: Game, team: string) {
  return teamAbbreviatedName(game.league, team);
}

function matchupTextVariants(game: Game, options: { spreadTeam?: string; spread?: number | null; suffix?: string } = {}) {
  const awayFull = displayTeamName(game, game.away_team);
  const homeFull = displayTeamName(game, game.home_team);
  const awayCompact = abbreviatedTeamName(game, game.away_team);
  const homeCompact = abbreviatedTeamName(game, game.home_team);
  const spreadTeam = options.spreadTeam;
  const suffix = options.suffix || "";
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
  const format = (away: string, home: string) => {
    const awayMarket = spreadTeam === game.away_team ? ` ${spreadText(spread)}` : "";
    const homeMarket = spreadTeam === game.home_team ? ` ${spreadText(spread)}` : "";
    return `${away}${awayMarket} at ${home}${homeMarket}${suffix}`;
  };

  return {
    full: format(awayFull, homeFull),
    intermediate: format(firstTeamToCompact === game.away_team ? awayCompact : awayFull, firstTeamToCompact === game.home_team ? homeCompact : homeFull),
    compact: format(awayCompact, homeCompact)
  };
}

function ResponsiveText({ full, intermediate, compact, className = "", accessibleText }: { full: string; intermediate?: string; compact: string; className?: string; accessibleText?: string }) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const fullMeasureRef = useRef<HTMLSpanElement>(null);
  const intermediateMeasureRef = useRef<HTMLSpanElement>(null);
  const [variant, setVariant] = useState<"full" | "intermediate" | "compact">("full");

  useEffect(() => {
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
  }, [compact, full, intermediate]);

  const value = variant === "full" ? full : variant === "intermediate" && intermediate ? intermediate : compact;

  const label = accessibleText || full;
  return <span ref={hostRef} className={`responsive-text ${className}`.trim()} aria-label={label} title={label === value ? undefined : label}>
    <span ref={fullMeasureRef} className="responsive-text-measure" aria-hidden="true">{full}</span>
    {intermediate && <span ref={intermediateMeasureRef} className="responsive-text-measure" aria-hidden="true">{intermediate}</span>}
    <span className="responsive-text-value"><NumericText text={value} /></span>
  </span>;
}

type SideBetResponseText = ReturnType<typeof sideBetResponseSummary>;
type SideBetResponseVariant = "full" | "names" | "team" | "minimal";
const SIDE_BET_RESPONSE_VARIANTS: SideBetResponseVariant[] = ["full", "names", "team", "minimal"];

function SideBetResponseLine({ summary, teamFull, teamCompact, spread, date }: { summary: SideBetResponseText; teamFull: string; teamCompact: string; spread: string; date?: string }) {
  const hostRef = useRef<HTMLParagraphElement>(null);
  const measureRefs = useRef<Partial<Record<SideBetResponseVariant, HTMLSpanElement | null>>>({});
  const [variant, setVariant] = useState<SideBetResponseVariant>("full");

  const contentFor = (value: SideBetResponseVariant) => ({
    subject: value === "full" ? summary.subjectFull : summary.subjectCompact,
    recipient: value === "full" ? summary.recipientFull : summary.recipientCompact || summary.recipientFull,
    team: value === "full" || value === "names" ? teamFull : value === "team" ? teamCompact : ""
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let active = true;
    const update = () => {
      if (!active) return;
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
      <span>{content.subject}</span>
      <span className={`side-bet-response ${summary.tone}`}>{summary.action}</span>
      {content.recipient && <span>{content.recipient}</span>}
      {content.team && <span>{content.team}</span>}
      <NumericText text={spread} />
      {date && <span>· <NumericText text={date} /></span>}
    </>;
  };
  const fullLabel = [summary.subjectFull, summary.action, summary.recipientFull, teamFull, spread, date ? `· ${date}` : ""].filter(Boolean).join(" ");

  return <p ref={hostRef} className="side-bet-response-line" aria-label={fullLabel} title={variant === "full" ? undefined : fullLabel}>
    {SIDE_BET_RESPONSE_VARIANTS.map((value) => <span ref={(element) => { measureRefs.current[value] = element; }} className="side-bet-response-measure" aria-hidden="true" key={value}>{renderContent(value)}</span>)}
    <span className="side-bet-response-value">{renderContent(variant)}</span>
  </p>;
}

function ResponsiveTeamName({ game, team, className = "" }: { game: Game; team: string; className?: string }) {
  return <ResponsiveText full={displayTeamName(game, team)} compact={abbreviatedTeamName(game, team)} className={className} />;
}

function AbbreviatedTeamName({ game, team, className = "" }: { game: Game; team: string; className?: string }) {
  const fullName = displayTeamName(game, team);
  return <span className={className} aria-label={fullName} title={fullName}>{abbreviatedTeamName(game, team)}</span>;
}

function dogBonusText(value: number | string, pointsMode: boolean) {
  if (!pointsMode) return `+${value}W`;
  return `+${value} ${Number(value) === 1 ? "Pt" : "Pts"}`;
}

function dogLineText(game: Game, team: string, pointsMode: boolean) {
  const spread = normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread);
  const value = underdogWinValue(spread);
  return `${spreadText(spread)} = ${dogBonusText(value, pointsMode)}`;
}

function confidencePointText(value: number) {
  return `${value} ${value === 1 ? "pt" : "pts"}`;
}

function weekdayAbbreviation(iso: string) {
  return CENTRAL_WEEKDAY_SHORT_FORMATTER.format(new Date(iso)).slice(0, 3);
}
function dt(iso: string) {
  return `${weekdayAbbreviation(iso)} ${timeText(iso)}`;
}
function fullDateText(iso: string) {
  return CENTRAL_FULL_DATE_FORMATTER.format(new Date(iso));
}
function openText(iso: string) {
  return CENTRAL_OPEN_DATE_FORMATTER.format(new Date(iso));
}
function cardGameStateText(game: Game, locked: boolean) {
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
function timeText(iso: string) {
  return CENTRAL_TIME_FORMATTER.format(new Date(iso));
}
function gameDayKey(iso: string) {
  return CENTRAL_DAY_KEY_FORMATTER.format(new Date(iso));
}
function gameDayLabel(iso: string) {
  return CENTRAL_DAY_LABEL_FORMATTER.format(new Date(iso)).toUpperCase();
}
function gameDayShort(iso: string) {
  return CENTRAL_WEEKDAY_LONG_FORMATTER.format(new Date(iso)).toUpperCase();
}
function spreadForTeam(game: Game, team: string) {
  return spreadText(normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread));
}
function isClosed(game: Game) {
  return game.is_locked || new Date(game.lock_time) <= new Date();
}
function isFinalGame(game: Game) {
  return (game.final_away_score != null && game.final_home_score != null) || Boolean(game.live_completed) || game.live_state === "post";
}
function boardStatusForGame(game: Game, now: number, weekIsOpen: boolean): GameStatusFilter {
  if (isFinalGame(game)) return "FINAL";
  const locked = game.is_locked || new Date(game.lock_time).getTime() <= now || new Date(game.commence_time).getTime() <= now;
  return locked || !weekIsOpen ? "LOCKED" : "OPEN";
}
function defaultBoardStatus(games: Game[], now: number, weekIsOpen: boolean): GameStatusFilter {
  const statuses: GameStatusFilter[] = ["OPEN", "LOCKED", "FINAL"];
  return statuses.find((status) => games.some((game) => boardStatusForGame(game, now, weekIsOpen) === status)) || "OPEN";
}
function livePeriodStatus(game: Game) {
  const detail = game.live_status?.trim() || "";
  const quarter = detail.match(/\b(1st|2nd|3rd|4th)\b/i)?.[1];
  const clock = detail.match(/\b\d{1,2}:\d{2}\b/)?.[0];
  let status = detail || "Score updating";

  if (/\bhalftime\b/i.test(detail)) {
    status = "Halftime";
  } else if (/\bOT\b/i.test(detail)) {
    status = clock ? `OT · ${clock}` : "OT";
  } else if (quarter && clock) {
    status = `${quarter} Qtr · ${clock}`;
  } else if (quarter) {
    status = `${quarter} Qtr`;
  } else if (clock) {
    status = clock;
  }

  return status;
}
function liveSituationStatus(game: Game) {
  return (game.live_situation?.trim() || "").replace(/\s+at\s+/i, " · ");
}

function LiveSituationText({ game }: { game: Game }) {
  const situation = game.live_situation?.trim() || "";
  const match = situation.match(/^(.*?)\s+at\s+(.+)$/i);
  if (!match) return <NumericText text={situation} />;
  return <><NumericText text={match[1]} /> · <span className={game.live_red_zone ? "red-zone-field" : ""}><NumericText text={match[2]} /></span></>;
}
function liveGameStatus(game: Game) {
  const status = livePeriodStatus(game);
  const situation = liveSituationStatus(game);
  return situation && status !== "Halftime" ? `${status} · ${situation}` : status;
}

function liveRemainingFraction(game: Game) {
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

function normalCdf(value: number) {
  const absolute = Math.abs(value);
  const t = 1 / (1 + 0.2316419 * absolute);
  const density = 0.3989423 * Math.exp(-absolute * absolute / 2);
  const probability = 1 - density * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return value >= 0 ? probability : 1 - probability;
}

function livePeriodAndClock(game: Game) {
  const detail = game.live_status?.trim() || "";
  const quarterText = detail.match(/\b(1st|2nd|3rd|4th)\b/i)?.[1]?.toLowerCase();
  const quarter = quarterText ? { "1st": 1, "2nd": 2, "3rd": 3, "4th": 4 }[quarterText] : null;
  const clock = detail.match(/\b(\d{1,2}):(\d{2})\b/);
  return {
    quarter,
    clockSeconds: clock ? Number(clock[1]) * 60 + Number(clock[2]) : null
  };
}

function liveModelStrategy(game: Game) {
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

function expectedPossessionPoints(game: Game) {
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

function liveProbabilityVolatility(game: Game, remaining: number) {
  const strategy = liveModelStrategy(game);
  const leagueBase = game.league === "CFB" ? 16.5 : 13.86;
  const minimum = strategy.canDrainClock ? 0.45 : game.league === "CFB" ? 1.8 : 1.5;
  return Math.max(minimum, leagueBase * Math.sqrt(remaining) * strategy.volatilityFactor);
}

function estimatedCoverChance(game: Game, team: string, spread: number | null) {
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

function espnWinChance(game: Game, team: string) {
  const probability = team === game.home_team ? game.live_home_win_probability : game.live_away_win_probability;
  return probability == null ? null : Math.max(0, Math.min(100, Math.round(probability * 100)));
}

function estimatedWinChance(game: Game, team: string) {
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

function liveWinChance(game: Game, team: string) {
  return espnWinChance(game, team) ?? estimatedWinChance(game, team);
}

function liveOutcome(game: Game, team: string, spread: number, outright = false): GameOutcome | null {
  const homeScore = game.live_home_score ?? game.final_home_score;
  const awayScore = game.live_away_score ?? game.final_away_score;
  if (homeScore == null || awayScore == null) return null;
  return outright
    ? gradeUnderdogOutright(team, game.home_team, game.away_team, homeScore, awayScore)
    : gradeAgainstSpread(team, game.home_team, game.away_team, homeScore, awayScore, spread);
}

function scoreChanged(previous: Game, next: Game) {
  return previous.live_home_score !== next.live_home_score || previous.live_away_score !== next.live_away_score;
}

function finalScoreText(game: Game) {
  const awayScore = game.final_away_score ?? game.live_away_score;
  const homeScore = game.final_home_score ?? game.live_home_score;
  return `${displayTeamName(game, game.away_team)} ${awayScore ?? "–"}, ${displayTeamName(game, game.home_team)} ${homeScore ?? "–"}`;
}

function outcomeLabel(outcome: GameOutcome, outright: boolean) {
  if (outcome === "push") return "pushed";
  if (outright) return outcome === "win" ? "won outright" : "lost";
  return outcome === "win" ? "covered" : "did not cover";
}

function buildLiveAlert(current: AppData, nextGames: Game[]): NonNullable<Toast> | null {
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
function teamDogValue(game: Game, team: string) {
  return underdogWinValue(normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread));
}

function gameConferences(game: Game) {
  const awayConference = cfbConferenceForLogo(game.away_logo_url);
  const homeConference = cfbConferenceForLogo(game.home_logo_url);
  if (!awayConference) return homeConference ? [homeConference] : [];
  return homeConference && homeConference !== awayConference
    ? [awayConference, homeConference]
    : [awayConference];
}

function appDataCacheKey(appSlug: AppSlug, week: number | null) {
  return `${APP_DATA_CACHE_PREFIX}:${appSlug}:${week == null ? "default" : week}`;
}

function readCachedAppData(appSlug: AppSlug, week: number | null) {
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

function writeCachedAppData(appSlug: AppSlug, week: number | null, payload: AppData) {
  window.setTimeout(() => {
    try {
      window.sessionStorage.setItem(appDataCacheKey(appSlug, week), JSON.stringify({ cachedAt: Date.now(), payload } satisfies AppDataCacheEntry));
    } catch {
      // The app still works normally if private browsing or storage limits block this cache.
    }
  }, 0);
}

function sideBetSyncSignature(bets: SideBet[] = []) {
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

function sideBetLedgerSignature(bets: SideBet[] = []) {
  return bets.map((bet) => `${bet.id}:${bet.status}:${bet.result}:${bet.winner_id || ""}:${bet.updated_at}`).sort().join("|");
}

function logoForTeam(game: Game, team: string) {
  return team === game.home_team ? game.home_logo_url : game.away_logo_url;
}
function money(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  return `${sign}$${absolute.toFixed(Number.isInteger(absolute) ? 0 : 2)}`;
}
function stakeMoney(value: number) {
  return `$${Math.abs(Number(value)).toFixed(Number.isInteger(Number(value)) ? 0 : 2)}`;
}
function sideBetAmountForUser(bet: SideBet, userId: string) {
  const stake = Number(bet.amount);
  if (bet.status !== "settled") return { text: stakeMoney(stake), tone: "money-neutral" };
  if (bet.result === "push") return { text: "$0", tone: "money-neutral" };

  const involved = bet.creator_id === userId || bet.accepted_by === userId;
  if (!involved) return { text: stakeMoney(stake), tone: "money-neutral" };

  const won = bet.winner_id === userId ||
    (!bet.winner_id && bet.result === "creator_win" && bet.creator_id === userId) ||
    (!bet.winner_id && bet.result === "acceptor_win" && bet.accepted_by === userId);
  return {
    text: money(won ? stake : -stake),
    tone: won ? "money-pos" : "money-neg"
  };
}
function pctText(value: number) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function RecordText({ wins, losses, pushes }: { wins: number; losses: number; pushes: number }) {
  return <NumericText text={`${wins}-${losses}-${pushes}`} />;
}

function pickCardSignature(card: Pick[]) {
  return card
    .map((pick) => `${pick.game_id}:${pick.selected_team}:${pick.pick_type}`)
    .sort()
    .join("|");
}

function completeSeasonStandings(profiles: Profile[], rows: Standing[]) {
  const byUser = new Map(rows.map((row) => [row.user_id, row]));
  const complete = profiles.map((profile) => byUser.get(profile.id) || {
    user_id: profile.id,
    display_name: profile.display_name,
    wins: 0,
    losses: 0,
    pushes: 0,
    win_pct: 0
  });

  return complete.sort((a, b) =>
    (Number(b.win_pct) - Number(a.win_pct)) ||
    (Number(b.wins) - Number(a.wins)) ||
    (Number(a.losses) - Number(b.losses)) ||
    a.display_name.localeCompare(b.display_name)
  );
}

function buildTestWeek(profiles: Profile[], currentUserId: string) {
  const previewNow = Date.now();
  const previewTime = (minutesFromNow: number) => new Date(previewNow + minutesFromNow * 60_000).toISOString();
  const games: Game[] = [
    {
      id: "test-virginia-nc-state", week: 3, league: "CFB", commence_time: previewTime(240),
      away_team: "Virginia Cavaliers", home_team: "NC State Wolfpack",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/258.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/152.png",
      current_spread_team: "NC State Wolfpack", current_spread: -10.5, current_bookmaker: "Test line",
      lock_time: previewTime(-120), is_locked: true, final_away_score: null, final_home_score: null,
      live_away_score: null, live_home_score: null, live_status: null, live_state: "pre", live_completed: false
    },
    {
      id: "test-raiders-broncos", week: 3, league: "NFL", commence_time: previewTime(360),
      away_team: "Las Vegas Raiders", home_team: "Denver Broncos",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/13.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/7.png",
      current_spread_team: "Denver Broncos", current_spread: -7.5, current_bookmaker: "Test line",
      lock_time: previewTime(-120), is_locked: true, final_away_score: null, final_home_score: null,
      live_away_score: null, live_home_score: null, live_status: null, live_state: "pre", live_completed: false
    },
    {
      id: "test-sjsu-fresno", week: 3, league: "CFB", commence_time: previewTime(-50),
      away_team: "San Jose State Spartans", home_team: "Fresno State Bulldogs",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/23.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/278.png",
      current_spread_team: "Fresno State Bulldogs", current_spread: -10.5, current_bookmaker: "Test line",
      lock_time: previewTime(-180), is_locked: true, final_away_score: null, final_home_score: null,
      live_away_score: 13, live_home_score: 34, live_status: "4th 4:12", live_state: "in", live_completed: false,
      live_possession_team: "Fresno State Bulldogs", live_situation: "2nd & 5 at SJSU 22",
      live_down: 2, live_distance: 5, live_yards_to_goal: 22, live_away_timeouts: 2, live_home_timeouts: 3
    },
    {
      id: "test-giants-eagles", week: 3, league: "NFL", commence_time: previewTime(-80),
      away_team: "New York Giants", home_team: "Philadelphia Eagles",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/19.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/21.png",
      current_spread_team: "Philadelphia Eagles", current_spread: -8.5, current_bookmaker: "Test line",
      lock_time: previewTime(-180), is_locked: true, final_away_score: null, final_home_score: null,
      live_away_score: 13, live_home_score: 24, live_status: "4th 9:16", live_state: "in", live_completed: false,
      live_possession_team: "New York Giants", live_situation: "3rd & 7 at NYG 42",
      live_down: 3, live_distance: 7, live_yards_to_goal: 58, live_away_timeouts: 3, live_home_timeouts: 2
    },
    {
      id: "test-iowa-rutgers", week: 3, league: "CFB", commence_time: "2026-09-12T00:00:00.000Z",
      away_team: "Rutgers Scarlet Knights", home_team: "Iowa Hawkeyes",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/164.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/2294.png",
      current_spread_team: "Iowa Hawkeyes", current_spread: -7.5, current_bookmaker: "Test line",
      lock_time: "2026-09-11T00:00:00.000Z", is_locked: true, final_away_score: 17, final_home_score: 27
    },
    {
      id: "test-unc-tcu", week: 3, league: "CFB", commence_time: "2026-09-12T16:00:00.000Z",
      away_team: "North Carolina Tar Heels", home_team: "TCU Horned Frogs",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/153.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/2628.png",
      current_spread_team: "TCU Horned Frogs", current_spread: -6.5, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 24, final_home_score: 27
    },
    {
      id: "test-cowboys-chiefs", week: 3, league: "NFL", commence_time: "2026-09-13T17:00:00.000Z",
      away_team: "Dallas Cowboys", home_team: "Kansas City Chiefs",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/6.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/12.png",
      current_spread_team: "Kansas City Chiefs", current_spread: -3, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 24, final_home_score: 29
    },
    {
      id: "test-texas-ohio-state", week: 3, league: "CFB", commence_time: "2026-09-13T19:30:00.000Z",
      away_team: "Texas Longhorns", home_team: "Ohio State Buckeyes",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/251.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/194.png",
      current_spread_team: "Ohio State Buckeyes", current_spread: -10.5, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 17, final_home_score: 31
    },
    {
      id: "test-seahawks-patriots", week: 3, league: "NFL", commence_time: "2026-09-14T00:20:00.000Z",
      away_team: "Seattle Seahawks", home_team: "New England Patriots",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/26.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/17.png",
      current_spread_team: "New England Patriots", current_spread: -2.5, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 20, final_home_score: 23
    },
    {
      id: "test-stanford-usc", week: 3, league: "CFB", commence_time: "2026-09-13T03:00:00.000Z",
      away_team: "Stanford Cardinal", home_team: "USC Trojans",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/24.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/30.png",
      current_spread_team: "USC Trojans", current_spread: -10.5, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 24, final_home_score: 21
    },
    {
      id: "test-hawaii-oregon", week: 3, league: "CFB", commence_time: "2026-09-13T22:00:00.000Z",
      away_team: "Hawaii Rainbow Warriors", home_team: "Oregon Ducks",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/62.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png",
      current_spread_team: "Oregon Ducks", current_spread: -20.5, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 14, final_home_score: 38
    },
    {
      id: "test-ucla-oregon", week: 3, league: "CFB", commence_time: "2026-09-14T02:00:00.000Z",
      away_team: "UCLA Bruins", home_team: "Oregon Ducks",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/26.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png",
      current_spread_team: "Oregon Ducks", current_spread: -7, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 21, final_home_score: 28
    }
  ];

  const cards: TestPickRow[][] = [
    [
      { id: "iowa", gameId: "test-iowa-rutgers", team: "Iowa Hawkeyes", spread: -7.5, matchup: "Rutgers at Iowa", finalScore: "17-27", result: "win" },
      { id: "unc", gameId: "test-unc-tcu", team: "North Carolina Tar Heels", spread: 6.5, matchup: "North Carolina at TCU", finalScore: "24-27", result: "win" },
      { id: "chiefs", gameId: "test-cowboys-chiefs", team: "Kansas City Chiefs", spread: -3, matchup: "Cowboys at Chiefs", finalScore: "24-29", result: "win" },
      { id: "ohio-state", gameId: "test-texas-ohio-state", team: "Ohio State Buckeyes", spread: -10.5, matchup: "Texas at Ohio State", finalScore: "17-31", result: "win" },
      { id: "patriots", gameId: "test-seahawks-patriots", team: "New England Patriots", spread: -2.5, matchup: "Seahawks at Patriots", finalScore: "20-23", result: "win" },
      { id: "stanford-dog", gameId: "test-stanford-usc", team: "Stanford Cardinal", spread: 10.5, matchup: "Stanford at USC", finalScore: "24-21", result: "win", dogValue: 2 }
    ],
    [
      { id: "iowa", gameId: "test-iowa-rutgers", team: "Iowa Hawkeyes", spread: -7.5, matchup: "Rutgers at Iowa", finalScore: "17-27", result: "win" },
      { id: "unc", gameId: "test-unc-tcu", team: "North Carolina Tar Heels", spread: 6.5, matchup: "North Carolina at TCU", finalScore: "24-27", result: "win" },
      { id: "chiefs", gameId: "test-cowboys-chiefs", team: "Kansas City Chiefs", spread: -3, matchup: "Cowboys at Chiefs", finalScore: "24-29", result: "win" },
      { id: "ohio-state", gameId: "test-texas-ohio-state", team: "Ohio State Buckeyes", spread: -10.5, matchup: "Texas at Ohio State", finalScore: "17-31", result: "win" },
      { id: "patriots", gameId: "test-seahawks-patriots", team: "New England Patriots", spread: -2.5, matchup: "Seahawks at Patriots", finalScore: "20-23", result: "win" },
      { id: "hawaii-dog", gameId: "test-hawaii-oregon", team: "Hawaii Rainbow Warriors", spread: 20.5, matchup: "Hawaii at Oregon", finalScore: "14-38", result: "loss", dogValue: 3 }
    ],
    [
      { id: "iowa", gameId: "test-iowa-rutgers", team: "Iowa Hawkeyes", spread: -7.5, matchup: "Rutgers at Iowa", finalScore: "17-27", result: "win" },
      { id: "tcu", gameId: "test-unc-tcu", team: "TCU Horned Frogs", spread: -6.5, matchup: "North Carolina at TCU", finalScore: "24-27", result: "loss" },
      { id: "cowboys", gameId: "test-cowboys-chiefs", team: "Dallas Cowboys", spread: 3, matchup: "Cowboys at Chiefs", finalScore: "24-29", result: "loss" },
      { id: "ohio-state", gameId: "test-texas-ohio-state", team: "Ohio State Buckeyes", spread: -10.5, matchup: "Texas at Ohio State", finalScore: "17-31", result: "win" },
      { id: "ucla", gameId: "test-ucla-oregon", team: "UCLA Bruins", spread: 7, matchup: "UCLA at Oregon", finalScore: "21-28", result: "push" },
      { id: "hawaii-dog", gameId: "test-hawaii-oregon", team: "Hawaii Rainbow Warriors", spread: 20.5, matchup: "Hawaii at Oregon", finalScore: "14-38", result: "loss", dogValue: 3 }
    ]
  ];

  const playerCards = profiles.slice(0, 3).map((profile, profileIndex) => {
    const baseRows = cards[profileIndex] || [];
    const rows = profile.id === currentUserId ? [
      { id: "fresno-live-possession", gameId: "test-sjsu-fresno", team: "Fresno State Bulldogs", spread: -10.5, matchup: "San Jose State at Fresno State", finalScore: "", result: "pending" as const },
      { id: "eagles-live-defense", gameId: "test-giants-eagles", team: "Philadelphia Eagles", spread: -8.5, matchup: "New York Giants at Philadelphia", finalScore: "", result: "pending" as const },
      ...baseRows.slice(2)
    ] : baseRows;
    const picks = rows.map((row, pickIndex): Pick => ({
      id: `test-${profile.id}-${pickIndex}`,
      user_id: profile.id,
      game_id: row.gameId,
      week: 3,
      selected_team: row.team,
      pick_type: row.dogValue ? "underdog" : "regular",
      status: "locked",
      locked_spread: row.spread,
      locked_spread_team: row.team,
      locked_at: "2026-09-11T00:00:00.000Z",
      underdog_win_value: row.dogValue || null,
      result: row.result,
      game: games.find((game) => game.id === row.gameId)
    }));
    return { profile, rows, picks };
  });

  const picks = playerCards.flatMap((card) => card.picks);
  const standings = computeWeeklyStandings(profiles, picks);
  const settlement = computeWeeklySettlement(standings, true);
  const bankEntries: BankEntry[] = standings.map((row) => ({
    id: `test-entry-${row.user_id}`,
    week: 3,
    user_id: row.user_id,
    amount: settlement.amounts.get(row.user_id) || 0,
    note: settlement.notes.get(row.user_id) || "Test week settlement",
    profile: { display_name: row.display_name }
  }));

  const sideBets: SideBet[] = profiles.length >= 2 ? [{
    id: "test-side-bet-settled",
    creator_id: profiles[0].id,
    game_id: "test-cowboys-chiefs",
    week: 3,
    creator_team: "Dallas Cowboys",
    offered_team: "Kansas City Chiefs",
    creator_spread: 6,
    offered_spread: -6,
    amount: 25,
    status: "settled",
    accepted_by: profiles[1].id,
    accepted_at: "2026-09-11T18:00:00.000Z",
    winner_id: profiles[0].id,
    result: "creator_win",
    created_at: "2026-09-11T17:30:00.000Z",
    updated_at: "2026-09-13T21:00:00.000Z",
    game: games.find((game) => game.id === "test-cowboys-chiefs"),
    creator: { id: profiles[0].id, display_name: profiles[0].display_name },
    accepted_by_profile: { id: profiles[1].id, display_name: profiles[1].display_name },
    targets: [{
      side_bet_id: "test-side-bet-settled",
      recipient_id: profiles[1].id,
      response: "accepted",
      responded_at: "2026-09-11T18:00:00.000Z",
      recipient: { id: profiles[1].id, display_name: profiles[1].display_name }
    }]
  }] : [];
  const sideBetBankTotals = Object.fromEntries(profiles.map((profile) => [profile.id, 0]));
  if (profiles.length >= 2) {
    sideBetBankTotals[profiles[0].id] = 25;
    sideBetBankTotals[profiles[1].id] = -25;
  }

  return { games, playerCards, picks, standings, settlement, bankEntries, sideBets, sideBetBankTotals };
}

export default function PickemApp({ appSlug = "shaw-family" }: { appSlug?: AppSlug }) {
  const loginPath = appLoginPath(appSlug);
  const [tab, setTab] = useState<Tab>("picks");
  const [picksView, setPicksView] = useState<PicksView>("board");
  const [cardView, setCardView] = useState<CardView>("mine");
  const [standingsView, setStandingsView] = useState<StandingsView>("standings");
  const [betView, setBetView] = useState<BetView>("offers");
  const [statusFilter, setStatusFilter] = useState<GameStatusFilter>("OPEN");
  const [leagueFilter, setLeagueFilter] = useState<LeagueFilter>("CFB");
  const [conferenceFilter, setConferenceFilter] = useState("ALL");
  const [dogValueFilter, setDogValueFilter] = useState<DogValueFilter>("ALL");
  const [statusFilterTouched, setStatusFilterTouched] = useState(false);
  const [data, setData] = useState<AppData | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionValidated, setSessionValidated] = useState(false);
  const [message, setMessage] = useState("");
  const [savingPicks, setSavingPicks] = useState(false);
  const [sideBetLedger, setSideBetLedger] = useState<SideBet[]>([]);
  const [sideBetLedgerReady, setSideBetLedgerReady] = useState(false);
  const [stagedPicks, setStagedPicks] = useState<Pick[] | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [betGameId, setBetGameId] = useState("");
  const [betCreatorTeam, setBetCreatorTeam] = useState("");
  const [betAmount, setBetAmount] = useState("20");
  const [betRecipients, setBetRecipients] = useState<string[]>([]);
  const [betLeagueFilter, setBetLeagueFilter] = useState<SideBetLeagueFilter>("CFB");
  const [betConferenceFilter, setBetConferenceFilter] = useState("ALL");
  const [toast, setToast] = useState<Toast>(null);
  const [testWeekActive, setTestWeekActive] = useState(false);
  const [notificationCounts, setNotificationCounts] = useState<NotificationCounts>(EMPTY_NOTIFICATION_COUNTS);
  const autosaveBlockedSignatureRef = useRef<string | null>(null);
  const dataRef = useRef<AppData | null>(null);
  const sideBetRequestSequenceRef = useRef(0);
  const sideBetAppliedRequestRef = useRef(0);
  const sideBetRefreshInFlightRef = useRef(false);
  const sideBetMutationInFlightRef = useRef(false);
  const sideBetLedgerRefreshInFlightRef = useRef(false);
  const hasActiveGames = Boolean(data?.games.some((game) => {
    const start = new Date(game.commence_time).getTime();
    return game.final_home_score == null &&
      game.final_away_score == null &&
      !game.live_completed &&
      start <= clock &&
      start >= clock - 12 * 60 * 60 * 1000;
  }));

  const updateNotificationCounts = useCallback((next: Record<string, number>) => {
    setNotificationCounts({
      side_bets_received: Number(next.side_bets_received || 0),
      side_bets_sent: Number(next.side_bets_sent || 0),
      my_card: Number(next.my_card || 0),
      league_cards: Number(next.league_cards || 0),
      side_bet_ledger: Number(next.side_bet_ledger || 0),
      total: Number(next.total || 0)
    });
  }, []);

  const refreshNotificationCounts = useCallback(async () => {
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) return;
    try {
      const response = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}`, "x-pickem-group": appSlug }, cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      updateNotificationCounts(payload.counts || {});
    } catch {
      // Preserve the last known counts through brief network interruptions.
    }
  }, [appSlug, updateNotificationCounts]);

  const applySideBetSnapshot = useCallback((payload: SideBetSnapshot, requestId: number) => {
    if (requestId < sideBetRequestSequenceRef.current || requestId < sideBetAppliedRequestRef.current) return;
    sideBetAppliedRequestRef.current = requestId;
    setData((current) => {
      if (!current) return current;
      const nextSideBets = payload.sideBets.map((bet) => ({
        ...bet,
        game: current.games.find((game) => game.id === bet.game_id) || bet.game
      }));
      const nextSlotCounts = payload.sideBetSlotCounts || current.sideBetSlotCounts;
      if (sideBetSyncSignature(current.sideBets) === sideBetSyncSignature(nextSideBets) &&
          JSON.stringify(current.sideBetSlotCounts) === JSON.stringify(nextSlotCounts)) return current;
      const nextData = { ...current, sideBets: nextSideBets, sideBetSlotCounts: nextSlotCounts };
      dataRef.current = nextData;
      writeCachedAppData(appSlug, nextData.week, nextData);
      return nextData;
    });
  }, [appSlug]);

  const refreshSideBets = useCallback(async () => {
    if (sideBetRefreshInFlightRef.current || sideBetMutationInFlightRef.current || document.visibilityState === "hidden") return;
    const current = dataRef.current;
    const token = window.localStorage.getItem("pickem_session_token");
    if (!current || !token) return;

    const requestId = ++sideBetRequestSequenceRef.current;
    sideBetRefreshInFlightRef.current = true;
    try {
      const response = await fetch(`/api/side-bets?week=${current.week}`, {
        headers: { Authorization: `Bearer ${token}`, "x-pickem-group": appSlug },
        cache: "no-store"
      });
      if (!response.ok) return;
      const payload = await response.json() as SideBetSnapshot;
      const nextSideBets = payload.sideBets || [];
      const sideBetsChanged = sideBetSyncSignature(current.sideBets) !== sideBetSyncSignature(nextSideBets);
      const slotCountsChanged = JSON.stringify(current.sideBetSlotCounts || {}) !== JSON.stringify(payload.sideBetSlotCounts || {});
      if (sideBetsChanged || slotCountsChanged) {
        applySideBetSnapshot({ ...payload, sideBets: nextSideBets }, requestId);
      }
      if (sideBetsChanged) void refreshNotificationCounts();
    } catch {
      // Keep the current offers visible and retry on the next foreground refresh.
    } finally {
      sideBetRefreshInFlightRef.current = false;
    }
  }, [appSlug, applySideBetSnapshot, refreshNotificationCounts]);

  const refreshSideBetLedger = useCallback(async () => {
    if (sideBetLedgerRefreshInFlightRef.current || document.visibilityState === "hidden") return;
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) return;
    sideBetLedgerRefreshInFlightRef.current = true;
    try {
      const response = await fetch("/api/side-bet-ledger", {
        headers: { Authorization: `Bearer ${token}`, "x-pickem-group": appSlug },
        cache: "no-store"
      });
      if (!response.ok) return;
      const payload = await response.json() as { sideBetLedger?: SideBet[] };
      const nextLedger = payload.sideBetLedger || [];
      setSideBetLedger((current) => sideBetLedgerSignature(current) === sideBetLedgerSignature(nextLedger) ? current : nextLedger);
      setSideBetLedgerReady(true);
    } catch {
      // Preserve the last authoritative ledger while the network recovers.
    } finally {
      sideBetLedgerRefreshInFlightRef.current = false;
    }
  }, [appSlug]);

  const markNotificationsSeen = useCallback(async (destination: NotificationDestination) => {
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) return;
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-pickem-group": appSlug },
        body: JSON.stringify({ action: "read", destination })
      });
      if (!response.ok) return;
      const payload = await response.json();
      updateNotificationCounts(payload.counts || {});
    } catch {
      // A later focus or polling refresh will retry the read state.
    }
  }, [appSlug, updateNotificationCounts]);

  const openNotificationDestination = useCallback((url: string) => {
    const destination = new URL(url, window.location.origin).searchParams.get("notification") as NotificationDestination | null;
    if (!destination) return;
    if (destination === "side_bets_received" || destination === "side_bets_sent") {
      setTab("picks");
      setPicksView("sideBets");
      setBetView("offers");
    } else if (destination === "my_card" || destination === "league_cards") {
      setTab("card");
      setCardView(destination === "my_card" ? "mine" : "group");
    } else if (destination === "side_bet_ledger") {
      setTab("standings");
      setStandingsView("bank");
    }
    const current = new URL(window.location.href);
    current.searchParams.delete("notification");
    window.history.replaceState({}, "", `${current.pathname}${current.search}${current.hash}`);
  }, []);

  async function load(nextWeek = week) {
    const isInitialLoad = data === null;
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) {
      window.location.href = loginPath;
      return;
    }
    const cachedPayload = isInitialLoad ? readCachedAppData(appSlug, nextWeek) : null;
    if (cachedPayload) {
      const cachedAt = Date.now();
      const cachedWeekIsOpen = !cachedPayload.weekOpenTime || new Date(cachedPayload.weekOpenTime).getTime() <= cachedAt;
      dataRef.current = cachedPayload;
      setData(cachedPayload);
      setWeek(cachedPayload.week);
      setStatusFilter(defaultBoardStatus(cachedPayload.games || [], cachedAt, cachedWeekIsOpen));
      setStatusFilterTouched(false);
      setLoading(false);
      setRefreshing(true);
    } else if (isInitialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setMessage("");

    try {
      const url = new URL("/api/app-data", window.location.origin);
      if (nextWeek != null) url.searchParams.set("week", String(nextWeek));
      let response: Response | null = null;
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}`, "x-pickem-group": appSlug }, cache: "no-store" });
          break;
        } catch (error) {
          lastError = error;
          if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
      if (!response) throw lastError || new Error("Could not load app data.");
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          window.sessionStorage.removeItem(appDataCacheKey(appSlug, nextWeek));
          window.localStorage.removeItem("pickem_session_token");
          window.localStorage.removeItem("pickem_profile");
          window.location.replace(loginPath);
          return;
        }
        setMessage(payload.error || "Could not load app data.");
        return;
      }
      if (isInitialLoad) setSessionValidated(true);
      const loadedAt = Date.now();
      const loadedWeekIsOpen = !payload.weekOpenTime || new Date(payload.weekOpenTime).getTime() <= loadedAt;
      dataRef.current = payload;
      setData(payload);
      setWeek(payload.week);
      if (!cachedPayload) {
        setStatusFilter(defaultBoardStatus(payload.games || [], loadedAt, loadedWeekIsOpen));
        setStatusFilterTouched(false);
      }
      writeCachedAppData(appSlug, nextWeek, payload);
    } catch {
      if (!cachedPayload) setMessage("Could not load app data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(null); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => {
    if (!data?.currentUser.id) return;
    setSideBetLedger([]);
    setSideBetLedgerReady(false);
  }, [data?.activeGroup?.id, data?.currentUser.id]);
  useEffect(() => {
    if (!data || testWeekActive) return;
    const offersVisible = tab === "picks" && picksView === "sideBets";
    const ledgerVisible = tab === "standings" && standingsView === "bank";
    if (!offersVisible && !ledgerVisible) return;

    const refreshVisibleSideBets = () => {
      if (document.visibilityState !== "visible") return;
      if (offersVisible) void refreshSideBets();
      if (ledgerVisible) void refreshSideBetLedger();
    };

    refreshVisibleSideBets();
    const timer = window.setInterval(refreshVisibleSideBets, 10000);
    window.addEventListener("focus", refreshVisibleSideBets);
    window.addEventListener("online", refreshVisibleSideBets);
    document.addEventListener("visibilitychange", refreshVisibleSideBets);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshVisibleSideBets);
      window.removeEventListener("online", refreshVisibleSideBets);
      document.removeEventListener("visibilitychange", refreshVisibleSideBets);
    };
  }, [data?.week, picksView, refreshSideBetLedger, refreshSideBets, standingsView, tab, testWeekActive]);
  useEffect(() => {
    if (!sessionValidated) return;
    void refreshNotificationCounts();
    openNotificationDestination(window.location.href);
    const refresh = () => { if (document.visibilityState === "visible") void refreshNotificationCounts(); };
    const receiveClick = (event: MessageEvent<{ type?: string; url?: string }>) => {
      if (event.data?.type === "notification-click" && event.data.url) openNotificationDestination(event.data.url);
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    navigator.serviceWorker?.addEventListener("message", receiveClick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      navigator.serviceWorker?.removeEventListener("message", receiveClick);
    };
  }, [openNotificationDestination, refreshNotificationCounts, sessionValidated]);
  useEffect(() => {
    const badgeNavigator = navigator as BadgeNavigator;
    if (notificationCounts.total > 0) void badgeNavigator.setAppBadge?.(notificationCounts.total);
    else void badgeNavigator.clearAppBadge?.();
  }, [notificationCounts.total]);
  useEffect(() => {
    if (!data || testWeekActive) return;
    let destination: NotificationDestination | null = null;
    if (tab === "picks" && picksView === "sideBets" && betView === "offers") destination = "side_bets_sent";
    else if (tab === "card" && cardView === "mine") destination = "my_card";
    else if (tab === "card" && cardView === "group") destination = "league_cards";
    else if (tab === "standings" && standingsView === "bank") destination = "side_bet_ledger";
    if (destination && notificationCounts[destination] > 0) void markNotificationsSeen(destination);
  }, [betView, cardView, data, markNotificationsSeen, notificationCounts.league_cards, notificationCounts.my_card, notificationCounts.side_bet_ledger, notificationCounts.side_bets_sent, picksView, standingsView, tab, testWeekActive]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!data || statusFilterTouched) return;
    const weekIsOpenNow = !data.weekOpenTime || new Date(data.weekOpenTime).getTime() <= clock;
    const hasCurrentStatus = data.games.some((game) => boardStatusForGame(game, clock, weekIsOpenNow) === statusFilter);
    if (!hasCurrentStatus) setStatusFilter(defaultBoardStatus(data.games, clock, weekIsOpenNow));
  }, [clock, data, statusFilter, statusFilterTouched]);
  useEffect(() => {
    if (week == null || !hasActiveGames) return;
    let cancelled = false;

    async function refreshLiveScores() {
      if (document.visibilityState === "hidden") return;
      const token = window.localStorage.getItem("pickem_session_token");
      if (!token) return;
      try {
        const response = await fetch(`/api/live-scores?week=${week}`, {
          headers: { Authorization: `Bearer ${token}`, "x-pickem-group": appSlug },
          cache: "no-store"
        });
        if (!response.ok) return;
        const payload = await response.json() as { games?: LiveScoreUpdate[]; resultsUpdated?: boolean };
        if (cancelled || !payload.games?.length) return;
        const scoresById = new Map(payload.games.map((game) => [game.id, game]));
        const current = dataRef.current;
        if (!current) return;
        const nextGames = current.games.map((game) => {
          const score = scoresById.get(game.id);
          return score ? { ...game, ...score } : game;
        });
        const alert = buildLiveAlert(current, nextGames);
        const nextData = { ...current, games: nextGames };
        dataRef.current = nextData;
        setData(nextData);
        if (alert) setToast(alert);
        if (payload.resultsUpdated) void load(week);
      } catch {
        // Keep the last known score visible through brief network interruptions.
      }
    }

    void refreshLiveScores();
    const timer = window.setInterval(refreshLiveScores, 20_000);
    const refreshOnResume = () => void refreshLiveScores();
    window.addEventListener("focus", refreshOnResume);
    window.addEventListener("online", refreshOnResume);
    document.addEventListener("visibilitychange", refreshOnResume);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnResume);
      window.removeEventListener("online", refreshOnResume);
      document.removeEventListener("visibilitychange", refreshOnResume);
    };
  }, [appSlug, hasActiveGames, week]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!data || !stagedPicks || savingPicks || testWeekActive) return;
    const signature = pickCardSignature(stagedPicks);
    if (autosaveBlockedSignatureRef.current === signature) return;
    const timer = window.setTimeout(() => void savePicks(stagedPicks, true), 450);
    return () => window.clearTimeout(timer);
    // savePicks intentionally runs only after staged card changes settle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.week, savingPicks, stagedPicks, testWeekActive]);
  useEffect(() => {
    if (appSlug !== "other-family" || !data || stagedPicks || savingPicks || testWeekActive) return;
    const currentCard = data.picks.filter((pick) => pick.user_id === data.currentUser.id && Number(pick.week) === Number(data.week));
    const normalizedCard = normalizeConfidenceCard(currentCard, data.weekRule.regularTotal);
    const confidenceChanged = normalizedCard.some((pick, index) => pick.confidence_points !== currentCard[index]?.confidence_points);
    if (confidenceChanged) setStagedPicks(normalizedCard);
  }, [appSlug, data, savingPicks, stagedPicks, testWeekActive]);

  function notify(message: string, tone: NonNullable<Toast>["tone"] = "info") {
    setToast({ message, tone });
  }

  async function savePicks(card: Pick[], autosave = false) {
    const submittedSignature = pickCardSignature(card);
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) {
      window.location.href = loginPath;
      return false;
    }
    setSavingPicks(true);
    try {
      const response = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-pickem-group": appSlug },
        body: JSON.stringify({ action: "saveCard", week: data?.week, picks: card.map((pick) => ({ gameId: pick.game_id, selectedTeam: pick.selected_team, pickType: pick.pick_type, confidencePoints: pick.confidence_points ?? null })) })
      });
      const payload = await response.json();
      if (!response.ok) {
        if (autosave) autosaveBlockedSignatureRef.current = submittedSignature;
        notify(payload.error || "Picks could not be saved.", "error");
        return false;
      }
      const savedPicks = (payload.picks || []).map((pick: Pick) => ({
        ...pick,
        game: data?.games.find((game) => game.id === pick.game_id) || pick.game
      }));
      const savedSignature = pickCardSignature(savedPicks);
      setData((current) => {
        if (!current) return current;
        const currentSavedPicks = (payload.picks || []).map((pick: Pick) => ({
          ...pick,
          game: current.games.find((game) => game.id === pick.game_id) || pick.game
        }));
        const nextData = {
          ...current,
          picks: [
            ...current.picks.filter((pick) => !(pick.user_id === current.currentUser.id && pick.week === current.week)),
            ...currentSavedPicks
          ]
        };
        dataRef.current = nextData;
        return nextData;
      });
      autosaveBlockedSignatureRef.current = null;
      setStagedPicks((current) => current && pickCardSignature(current) === savedSignature ? null : current);
      if (!autosave) notify("Picks saved. They remain editable until each game locks.", "success");
      return true;
    } catch {
      if (autosave) autosaveBlockedSignatureRef.current = submittedSignature;
      notify("Picks could not be saved.", "error");
      return false;
    } finally {
      setSavingPicks(false);
    }
  }

  async function postSideBet(body: any) {
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) {
      window.location.href = loginPath;
      return false;
    }
    if (sideBetMutationInFlightRef.current) return false;
    sideBetMutationInFlightRef.current = true;
    const requestId = ++sideBetRequestSequenceRef.current;
    try {
      const response = await fetch("/api/side-bets", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-pickem-group": appSlug }, body: JSON.stringify({ ...body, viewWeek: data?.week }) });
      const payload = await response.json();
      if (!response.ok) {
        notify(payload.error || "Side bet action failed.", "error");
        return false;
      }
      if (Array.isArray(payload.sideBets)) {
        applySideBetSnapshot({ sideBets: payload.sideBets, sideBetSlotCounts: payload.sideBetSlotCounts }, requestId);
      } else {
        await load(week);
      }
      if (body.action === "accept") void refreshSideBetLedger();
      void refreshNotificationCounts();
      return true;
    } catch {
      notify("Side bet action failed.", "error");
      return false;
    } finally {
      sideBetMutationInFlightRef.current = false;
    }
  }

  if (loading) return <LoadingShell appSlug={appSlug} />;
  if (!data) return <div className="app-shell"><main className="container"><div className="error-card">{message || "Could not load app."}</div></main></div>;

  const { currentUser, games, picks, profiles, standings, availableWeeks, bankEntries } = data;
  const pointsMode = appSlug === "other-family";
  const leagueCardProfiles = [
    profiles.find((profile) => profile.id === currentUser.id) || currentUser,
    ...profiles.filter((profile) => profile.id !== currentUser.id)
  ];
  const liveSideBets = data.sideBets || [];
  const testWeek = testWeekActive && profiles.length === 3 ? buildTestWeek(profiles, currentUser.id) : null;
  const previewActive = Boolean(testWeekActive && testWeek);
  const sideBets = previewActive ? testWeek!.sideBets : liveSideBets;
  const viewedSideBetLedger = (previewActive ? testWeek!.sideBets : sideBetLedger)
    .filter((bet) => bet.status === "accepted" || bet.status === "settled")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const viewedSideBetBankTotals = previewActive ? testWeek!.sideBetBankTotals : data.sideBetBankTotals;
  const viewedGames = previewActive ? testWeek!.games : games;
  const viewedPicks = previewActive ? testWeek!.picks : picks;
  const viewedWeek = previewActive ? 3 : data.week;
  const viewedBankEntries = previewActive ? testWeek!.bankEntries : bankEntries;
  const rule = previewActive ? getWeekRule(3) : data.weekRule || getWeekRule(data.week);
  const boardActive = tab === "picks" && picksView === "board";
  const sideBetsActive = tab === "picks" && picksView === "sideBets";
  const standingsActive = tab === "standings" && standingsView === "standings";
  const bankActive = tab === "standings" && standingsView === "bank";
  const myPicks = viewedPicks.filter((p) => p.user_id === currentUser.id && p.week === viewedWeek);
  const cardPicks = previewActive ? myPicks : stagedPicks ?? myPicks;
  const cardIsLocked = tab === "card" && cardView === "mine" && cardPicks.length > 0 && cardPicks.every((pick) => {
    const game = viewedGames.find((item) => item.id === pick.game_id) || pick.game;
    return pick.status === "locked" || Boolean(game && isClosed(game));
  });
  const myRegular = orderCardPicks(cardPicks.filter((p) => p.pick_type === "regular"), viewedGames, pointsMode);
  const myUnderdog = cardPicks.find((p) => p.pick_type === "underdog");
  const regularCounts = countRegularByLeague(cardPicks, viewedGames);
  const seasonStandings = standingsActive ? (previewActive ? testWeek!.standings : completeSeasonStandings(profiles, standings)) : [];
  const weeklyStandings = !standingsActive
    ? []
    : previewActive
    ? testWeek!.standings
    : data.weeklyStandingsByWeek?.[String(data.week)] || computeWeeklyStandings(profiles, picks);
  const bankResultWeek = previewActive ? 3 : data.week;
  const bankResultGames = previewActive ? testWeek!.games : games;
  const bankResultPicks = previewActive ? testWeek!.picks : picks;
  const bankWeekStandings = !bankActive
    ? []
    : previewActive
    ? testWeek!.standings
    : data.weeklyStandingsByWeek?.[String(bankResultWeek)] || computeWeeklyStandings(profiles, bankResultPicks);
  const bankWeekAmounts = bankActive ? Object.fromEntries(profiles.map((profile) => {
    const entries = viewedBankEntries.filter((entry) => entry.week === bankResultWeek && entry.user_id === profile.id);
    return [profile.id, entries.length ? entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0) : null];
  })) : {};
  const weekIsOpen = !previewActive && (!data.weekOpenTime || new Date(data.weekOpenTime) <= new Date());
  const incomingOffers = sideBets.filter((bet) => bet.creator_id !== currentUser.id && bet.targets?.some((target) => target.recipient_id === currentUser.id));
  const pendingOfferCount = incomingOffers.filter((bet) => bet.status === "open" && bet.targets?.some((target) => target.recipient_id === currentUser.id && target.response === "pending")).length;
  const receivedNotificationCount = previewActive ? 1 : Math.max(pendingOfferCount, notificationCounts.side_bets_received);
  const sentNotificationCount = previewActive ? 1 : notificationCounts.side_bets_sent;
  const myCardNotificationCount = previewActive ? 1 : notificationCounts.my_card;
  const leagueCardsNotificationCount = previewActive ? 1 : notificationCounts.league_cards;
  const bankNotificationCount = previewActive ? 1 : notificationCounts.side_bet_ledger;
  const picksNotificationCount = receivedNotificationCount + sentNotificationCount;
  const cardNotificationCount = myCardNotificationCount + leagueCardsNotificationCount;
  const navNotificationCounts: Partial<Record<Tab, number>> = {
    picks: picksNotificationCount,
    card: cardNotificationCount,
    standings: bankNotificationCount
  };
  const bankTotals = bankActive ? profiles.map((profile) => ({
    id: profile.id,
    display_name: profile.display_name,
    total: viewedBankEntries.filter((entry) => entry.user_id === profile.id).reduce((sum, entry) => sum + Number(entry.amount || 0), 0) + Number(viewedSideBetBankTotals?.[profile.id] || 0)
  })).sort((a, b) => b.total - a.total) : [];
  const openBetGames = sideBetsActive ? games.filter((game) => new Date(game.commence_time) > new Date() && game.current_spread != null && game.current_spread_team) : [];
  const filteredBetGames = openBetGames.filter((game) => game.league === betLeagueFilter && (betLeagueFilter === "NFL" || betConferenceFilter === "ALL" || gameConferences(game).includes(betConferenceFilter)));
  const selectedBetGame = filteredBetGames.find((game) => game.id === betGameId);
  const selectedCreatorTeam = selectedBetGame && [selectedBetGame.away_team, selectedBetGame.home_team].includes(betCreatorTeam) ? betCreatorTeam : "";
  const displayedRules = tab === "rules" ? ruleSections(appSlug, data.groupRules || {}) : [];

  function stageCard(nextCard: Pick[]) {
    const normalizedCard = pointsMode ? normalizeConfidenceCard(nextCard, rule.regularTotal) : nextCard;
    const matchesSaved = normalizedCard.length === myPicks.length && normalizedCard.every((nextPick) => {
      const savedPick = myPicks.find((pick) => pick.game_id === nextPick.game_id);
      return savedPick?.selected_team === nextPick.selected_team &&
        savedPick.pick_type === nextPick.pick_type &&
        (!pointsMode || Number(savedPick.confidence_points || 0) === Number(nextPick.confidence_points || 0));
    });
    autosaveBlockedSignatureRef.current = null;
    setStagedPicks(matchesSaved ? null : normalizedCard);
  }

  const filteredGames = boardActive ? viewedGames.filter((g) => {
    if (boardStatusForGame(g, clock, weekIsOpen) !== statusFilter) return false;
    if (leagueFilter === "CFB") {
      return g.league === "CFB" && (conferenceFilter === "ALL" || gameConferences(g).includes(conferenceFilter));
    }
    if (leagueFilter === "NFL") return g.league === "NFL";
    const dogValue = Math.max(...[g.away_team, g.home_team].map((team) => teamDogValue(g, team)));
    return dogValue > 0 && (dogValueFilter === "ALL" || dogValue === Number(dogValueFilter));
  }).sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()) : [];
  const gameGroups = filteredGames.reduce<Array<{ key: string; label: string; shortDay: string; games: Game[] }>>((groups, game) => {
    const key = gameDayKey(game.commence_time);
    const existingGroup = groups[groups.length - 1];
    if (existingGroup?.key === key) existingGroup.games.push(game);
    else groups.push({ key, label: gameDayLabel(game.commence_time), shortDay: gameDayShort(game.commence_time), games: [game] });
    return groups;
  }, []);
  function addPick(game: Game, team: string, pickType: PickType) {
    if (!game.current_spread_team || game.current_spread == null) {
      notify("This game cannot be picked until a spread is available.", "error");
      return;
    }
    const existing = cardPicks.find((pick) => pick.game_id === game.id);
    if (existing?.status === "locked") {
      if (existing.pick_type !== pickType) {
        notify(existing.pick_type === "underdog"
          ? "This game is already your dog and cannot also be a spread pick."
          : "This game is already a spread pick and cannot also be your dog.", "error");
      }
      return;
    }
    if (existing?.selected_team === team && existing.pick_type === pickType) {
      stageCard(cardPicks.filter((pick) => pick.game_id !== game.id));
      return;
    }
    if (existing && existing.pick_type !== pickType) {
      notify(existing.pick_type === "underdog"
        ? "This game is already your dog and cannot also be a spread pick."
        : "This game is already a spread pick and cannot also be your dog.", "error");
      return;
    }

    const selectedSpread = normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread);
    const nextPick: Pick = existing ? {
      ...existing,
      selected_team: team,
      underdog_win_value: pickType === "underdog" ? underdogWinValue(selectedSpread) : null,
      game
    } : {
      id: `unsaved-${game.id}`,
      user_id: currentUser.id,
      game_id: game.id,
      week: game.week,
      selected_team: team,
      pick_type: pickType,
      status: "draft",
      locked_spread: null,
      locked_spread_team: null,
      locked_at: null,
      underdog_win_value: pickType === "underdog" ? underdogWinValue(selectedSpread) : null,
      result: "pending",
      game
    };
    const nextCard = existing ? cardPicks.map((pick) => pick.game_id === game.id ? nextPick : pick) : [...cardPicks, nextPick];
    const nextRegular = nextCard.filter((pick) => pick.pick_type === "regular");
    const nextDogs = nextCard.filter((pick) => pick.pick_type === "underdog");
    const counts = countRegularByLeague(nextCard, games);
    if (nextRegular.length > rule.regularTotal) return notify(`This week allows ${rule.regularTotal} regular picks.`, "error");
    if (nextDogs.length > rule.underdogTotal) return notify("Only one underdog pick is allowed.", "error");
    if (counts.cfb > rule.regularTotal - rule.nflMinimum) return notify(`This week requires ${rule.nflMinimum} NFL regular pick${rule.nflMinimum === 1 ? "" : "s"}.`, "error");
    if (counts.nfl > rule.regularTotal - rule.cfbMinimum) return notify(`This week requires ${rule.cfbMinimum} CFB regular pick${rule.cfbMinimum === 1 ? "" : "s"}.`, "error");
    stageCard(nextCard);
  }

  function removePick(pick: Pick) {
    if (pick.status === "locked") return;
    const game = viewedGames.find((item) => item.id === pick.game_id) || pick.game;
    if (game && isClosed(game)) {
      notify("This pick has reached its lock time and is final.", "error");
      return;
    }
    stageCard(cardPicks.filter((item) => item.game_id !== pick.game_id));
  }

  function toggleBetRecipient(profileId: string) {
    setBetRecipients((current) => current.includes(profileId) ? current.filter((id) => id !== profileId) : [...current, profileId]);
  }

  async function createSideBet(): Promise<boolean> {
    if (!weekIsOpen) {
      notify("Side bet offers open Tuesday at 8:00 AM.", "error");
      return false;
    }
    if (!selectedBetGame || !selectedCreatorTeam || !betRecipients.length) return false;
    if (Number(betAmount) > MAX_SIDE_BET_AMOUNT) {
      notify(`Side bets are capped at $${MAX_SIDE_BET_AMOUNT}.`, "error");
      return false;
    }
    const maxPerWeek = data?.sideBetSettings?.maxPerWeek;
    if (maxPerWeek != null && (data?.sideBetSlotCounts?.[currentUser.id] || 0) >= maxPerWeek) {
      notify(`You already have ${maxPerWeek} accepted or pending side bets this week.`, "error");
      return false;
    }
    const fullRecipient = maxPerWeek == null ? undefined : profiles.find((profile) => betRecipients.includes(profile.id) && (data?.sideBetSlotCounts?.[profile.id] || 0) >= maxPerWeek);
    if (fullRecipient) {
      notify(`${fullRecipient.display_name} has reached the weekly side bet limit.`, "error");
      return false;
    }
    const ok = await postSideBet({ action: "create", gameId: selectedBetGame.id, creatorTeam: selectedCreatorTeam, amount: Number(betAmount), recipientIds: betRecipients });
    if (ok) {
      setBetGameId("");
      setBetCreatorTeam("");
      setBetRecipients([]);
      setBetAmount("20");
      setBetView("offers");
      notify("Side bet offer sent.", "success");
    }
    return ok;
  }

  const primaryNav: Array<{ id: Tab; label: string; icon: typeof Trophy }> = [
    { id: "picks", label: "Picks", icon: Zap },
    { id: "card", label: "My Card", icon: SquareCheck },
    { id: "standings", label: "Standings", icon: Trophy },
    { id: "rules", label: "Rules", icon: Shield }
  ];

  return <div className="app-shell">
    <header className="scoreboard-header">
      <div className="scoreboard-main">
        <div className="brand-lockup">
          <img className="header-wordmark" src={pointsMode || appSlug === "friends" ? "/football-pickem-wordmark.png" : "/header-wordmark.png"} alt={pointsMode || appSlug === "friends" ? "Football Pick'em" : "Shaw Family Pick'em"} width={800} height={pointsMode || appSlug === "friends" ? 100 : 96} decoding="async" fetchPriority="high" />
        </div>
        <div className="header-actions">
          <span className="header-refresh-indicator" role="status" aria-label={refreshing ? "Updating week" : undefined}>{refreshing && <LoaderCircle size={17} />}</span>
          {previewActive ? <div className="test-week-chip">Test Week</div> : availableWeeks.length > 0 && <div className="header-slate"><MenuSelect
            ariaLabel="Select week"
            className="week-select-wrap header-menu-select"
            value={String(data.week)}
            disabled={refreshing}
            sections={[{ options: availableWeeks.map((w) => ({ value: String(w), label: w === 0 ? "Week 0" : `Week ${w}` })) }]}
            onChange={(nextWeek) => { setStagedPicks(null); void load(Number(nextWeek)); }}
          /></div>}
        </div>
      </div>
    </header>

    <nav className="primary-nav" aria-label="Main navigation">
      <div className="primary-nav-inner">
        {primaryNav.map((item) => <button key={item.id} aria-current={tab === item.id ? "page" : undefined} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span className={`nav-icon nav-icon-${item.id}`}><item.icon size={19} /><NotificationBadge count={navNotificationCounts[item.id] || 0} className="nav-notification-badge" /></span><span>{item.label}</span></button>)}
      </div>
    </nav>

    <main className="container">
      {message && <div className="error-card"><NumericText text={message} /></div>}
      {previewActive && <div className="test-mode-banner"><span><FlaskConical size={16} /><span><strong>Board state preview</strong><small>No real picks or bank balances are changed</small></span></span><button type="button" onClick={() => { setTestWeekActive(false); setStatusFilter(defaultBoardStatus(data.games, clock, !data.weekOpenTime || new Date(data.weekOpenTime).getTime() <= clock)); setStatusFilterTouched(false); }}><X size={16} /> Exit</button></div>}

      {tab === "picks" && <section className="panel picks-panel">
        {!previewActive && !weekIsOpen && data.weekOpenTime && <div className="notice-card">This week opens on <NumericText text={openText(data.weekOpenTime)} />.</div>}
        <SectionTabs items={[{ id: "board", label: "Pick Board" }, { id: "sideBets", label: "Side Bets", badge: picksNotificationCount }]} value={picksView} onChange={(value) => setPicksView(value as PicksView)} />
        {picksView === "board" && <>
          <div className="view-select-row board-filter-row">
            <MenuSelect ariaLabel="Choose game status" className="compact-select status-select" value={statusFilter} sections={[{ options: (["OPEN", "LOCKED", "FINAL"] as GameStatusFilter[]).map((option) => ({ value: option, label: option })) }]} onChange={(value) => { setStatusFilter(value as GameStatusFilter); setStatusFilterTouched(true); }} />
            <MenuSelect ariaLabel="Choose league" className="compact-select league-select" value={leagueFilter} sections={[{ options: (["CFB", "NFL", "DOGS"] as LeagueFilter[]).map((option) => ({ value: option, label: option })) }]} onChange={(value) => setLeagueFilter(value as LeagueFilter)} />
            {leagueFilter === "CFB" && <ConferenceFilter value={conferenceFilter} onChange={setConferenceFilter} />}
            {leagueFilter === "DOGS" && <MenuSelect ariaLabel="Filter dogs by win value" className="compact-select context-select" value={dogValueFilter} sections={[{ options: [{ value: "ALL", label: "ALL DOGS" }, ...(["1", "2", "3"] as const).map((value) => ({ value, label: dogBonusText(value, pointsMode) }))] }]} onChange={(value) => setDogValueFilter(value as DogValueFilter)} />}
          </div>
          {filteredGames.length === 0 && <div className="empty-state board-empty-state">No {statusFilter.toLowerCase()} {leagueFilter === "DOGS" ? "dog" : leagueFilter} games.</div>}
          <div className="game-days">
            {gameGroups.map((group) => <div className={`game-day-group ${statusFilter === "FINAL" ? "past-day-group" : ""}`} key={group.key}>
              <div className="game-day-marker"><b>{group.shortDay}</b><strong>{group.label}</strong></div>
              <div className="game-list">{group.games.map((game) => <GameCard key={game.id} game={game} picks={cardPicks} statusFilter={statusFilter} leagueFilter={leagueFilter} weekIsOpen={weekIsOpen} now={clock} pointsMode={pointsMode} addPick={addPick} />)}</div>
            </div>)}
          </div>
        </>}
        {picksView === "sideBets" && <SideBetCenter
          view={betView}
          setView={setBetView}
          currentUser={currentUser}
          profiles={profiles}
          sideBets={sideBets}
          slotCounts={data.sideBetSlotCounts || {}}
          maxPerWeek={data.sideBetSettings?.maxPerWeek ?? null}
          weekIsOpen={weekIsOpen}
          openGames={openBetGames}
          gameLeague={betLeagueFilter}
          gameConference={betConferenceFilter}
          selectedGame={selectedBetGame}
          selectedCreatorTeam={selectedCreatorTeam}
          amount={betAmount}
          recipients={betRecipients}
          offerNotificationCount={receivedNotificationCount + sentNotificationCount}
          setGame={(gameId) => { setBetGameId(gameId); setBetCreatorTeam(""); }}
          setGameLeague={(nextLeague) => { setBetLeagueFilter(nextLeague); setBetConferenceFilter("ALL"); setBetGameId(""); setBetCreatorTeam(""); }}
          setGameConference={(nextConference) => { setBetConferenceFilter(nextConference); setBetGameId(""); setBetCreatorTeam(""); }}
          setCreatorTeam={setBetCreatorTeam}
          setAmount={setBetAmount}
          toggleRecipient={toggleBetRecipient}
          createBet={createSideBet}
          respond={(action, sideBetId) => postSideBet({ action, sideBetId })}
        />}
      </section>}

      {tab === "card" && <section className="panel card-panel">
        <SectionTabs items={[{ id: "mine", label: "My Card", badge: myCardNotificationCount }, { id: "group", label: "League Cards", badge: leagueCardsNotificationCount }]} value={cardView} onChange={(value) => setCardView(value as CardView)} />
        {cardView === "mine" && <>
          {!cardIsLocked && <CardProgress rule={rule} counts={regularCounts} hasDog={Boolean(myUnderdog)} dirty={stagedPicks !== null} />}
          <PickList
            picks={myUnderdog ? [...myRegular, myUnderdog] : myRegular}
            games={viewedGames}
            title="Picks"
            pointsMode={pointsMode}
            removePick={removePick}
            headerContent={pointsMode && myRegular.length > 0 ? <ConfidenceOrder
              picks={myRegular}
              regularTotal={rule.regularTotal}
              saving={savingPicks}
              onMove={(index, direction) => {
                const moved = moveConfidencePick(myRegular, index, direction, rule.regularTotal);
                if (moved === myRegular) return;
                const pointsByGame = new Map(moved.map((pick) => [pick.game_id, pick.confidence_points]));
                stageCard(cardPicks.map((pick) => pointsByGame.has(pick.game_id)
                  ? { ...pick, confidence_points: pointsByGame.get(pick.game_id) }
                  : pick));
              }}
            /> : null}
          />
        </>}
        {cardView === "group" && <div className="group-list">
          {leagueCardProfiles.map((profile) => {
            const playerPicks = orderCardPicks(viewedPicks.filter((pick) => pick.user_id === profile.id), viewedGames, pointsMode);
            return <div key={profile.id} className="group-card">
              <h3>{profile.display_name}</h3>
              {playerPicks.length === 0 && <p className="muted group-empty-picks">No picks submitted.</p>}
              {playerPicks.map((pick) => <VisiblePick key={pick.id} pick={pick} games={viewedGames} pointsMode={pointsMode} />)}
            </div>;
          })}
        </div>}
      </section>}

      {tab === "standings" && <section className="panel standings-panel">
        <SectionTabs items={[{ id: "standings", label: "Standings" }, { id: "bank", label: "Bank", badge: bankNotificationCount }]} value={standingsView} onChange={(value) => setStandingsView(value as StandingsView)} />
        {standingsView === "standings" && <>
          <div className="scoreboard-heading"><h2>Season Standings</h2></div>
          <Leaderboard rows={seasonStandings} pointsMode={pointsMode} />
          <div className="subsection weekly-standings">
            <div className="standings-heading-row"><h2>Weekly Standings</h2>{previewActive ? <span className="test-standings-label">Test Week</span> : null}</div>
            <Leaderboard rows={weeklyStandings} pointsMode={pointsMode} />
          </div>
        </>}
        {standingsView === "bank" && <>
          <div className="scoreboard-heading"><h2>Bank Balances</h2></div>
          {data.activeGroup?.slug === "other-family" && data.groupMoney && <GroupMoneyControls
            week={Number(data.week)}
            weeklyAmount={Number(data.groupMoney.weeklyAmount || 0)}
            seasonAmount={Number(data.groupMoney.seasonAmount || 0)}
            weeklySubmitted={Boolean(data.groupMoney.weeklySubmitted)}
            seasonSubmitted={Boolean(data.groupMoney.seasonSubmitted)}
            canEdit={Boolean(data.groupMoney.canEdit)}
            onSaved={(weeklyAmount, seasonAmount, weeklySubmitted, seasonSubmitted) => {
              setData((current) => {
                if (!current?.groupMoney) return current;
                const nextData = {
                  ...current,
                  groupMoney: { ...current.groupMoney, weeklyAmount, seasonAmount, weeklySubmitted, seasonSubmitted }
                };
                dataRef.current = nextData;
                writeCachedAppData(appSlug, nextData.week, nextData);
                return nextData;
              });
            }}
            onError={(error) => notify(error, "error")}
          />}
          <div className="bank-summary-grid">
            <div className="bank-summary-head"><span>Player</span><span>Balance</span></div>
            {bankTotals.map((row) => <div key={row.id} className="money-card"><span>{row.display_name}</span><strong className={row.total > 0 ? "money-pos" : row.total < 0 ? "money-neg" : ""}><NumericText text={money(row.total)} /></strong></div>)}
          </div>
          <div className="subsection bank-section bank-week-section">
            <div className="standings-heading-row">
              <h2>{previewActive ? "Test Weekly Results" : "Weekly Results"}</h2>
              {previewActive ? <span className="test-standings-label">Week 3</span> : null}
            </div>
            <BankWeekResults rows={bankWeekStandings} picks={bankResultPicks} games={bankResultGames} amounts={bankWeekAmounts} pointsMode={pointsMode} />
          </div>
          <div className="subsection bank-section bank-week-section"><div className="standings-heading-row"><h2 className="heading-with-badge">Side Bet Ledger <NotificationBadge count={bankNotificationCount} /></h2></div><div className="ledger-list">{!previewActive && !sideBetLedgerReady && <p className="muted">Loading side bet ledger…</p>}{(previewActive || sideBetLedgerReady) && viewedSideBetLedger.length === 0 && <p className="muted ledger-empty-state">No side bets in the ledger yet.</p>}{(previewActive || sideBetLedgerReady) && viewedSideBetLedger.map((bet) => <SideBetLedgerRow key={bet.id} bet={bet} currentUser={currentUser} />)}</div></div>
        </>}
      </section>}

      {tab === "rules" && <section className="panel rules-panel">
        <div className="section-title"><div><h2>League Rules</h2></div></div>
        <PushNotificationControls appSlug={appSlug} onCountsChanged={updateNotificationCounts} />
        <div className="rules-list">
          {displayedRules.map((section) => <RuleItem title={section.title} key={section.title}><ul>{section.items.map((item) => <li key={item}><NumericText text={item} /></li>)}</ul></RuleItem>)}
        </div>
      </section>}
    </main>
    {!previewActive && stagedPicks !== null && autosaveBlockedSignatureRef.current !== pickCardSignature(stagedPicks) && !toast && <div className="autosave-toast" role="status" aria-live="polite"><LoaderCircle size={18} /><span>Saving…</span></div>}
    {toast && <div className={`toast ${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"} aria-live="polite">{toast.tone === "success" && <CircleCheckBig className="toast-status-icon" size={18} />}<span><NumericText text={toast.message} /></span><button className="toast-close" type="button" aria-label="Dismiss message" onClick={() => setToast(null)}><X size={16} /></button></div>}
  </div>;
}

function SectionTabs({ items, value, onChange }: { items: Array<{ id: string; label: string; badge?: number }>; value: string; onChange: (value: string) => void }) {
  return <div className="section-tabs">{items.map((item) => <button key={item.id} className={value === item.id ? "active" : ""} onClick={() => onChange(item.id)}><span className="section-tab-label"><NumericText text={item.label} /><NotificationBadge count={item.badge || 0} /></span></button>)}</div>;
}

function conferenceFilterSections(allLabel: string) {
  return [
    { options: [{ value: "ALL", label: allLabel }] },
    { label: "Power 4", options: POWER_CONFERENCES.map((conference) => ({ value: conference, label: conference })) },
    { label: "Group of 6", options: GROUP_CONFERENCES.map((conference) => ({ value: conference, label: conference })) },
    { options: [{ value: FBS_INDEPENDENTS_CONFERENCE, label: "INDEPENDENTS" }] }
  ];
}

function ConferenceFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <MenuSelect
    ariaLabel="Filter college games by FBS conference"
    className="compact-select context-select"
    value={value}
    sections={conferenceFilterSections("ALL CONF.")}
    onChange={onChange}
  />;
}

function RankNumber({ rank, className }: { rank: number; className: string }) {
  const labels: Record<number, string> = { 1: "First place", 2: "Second place", 3: "Third place" };
  return <span className={`${className} rank-${rank}`} aria-label={labels[rank]}><NumericText text={rank} /></span>;
}

function BankWeekResults({ rows, picks, games, amounts, pointsMode }: { rows: Array<Standing & { rank?: number }>; picks: Pick[]; games: Game[]; amounts: Record<string, number | null>; pointsMode: boolean }) {
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
        const locked = pick.status === "locked" || Boolean(game && isClosed(game));
        const displayedSpread = pick.locked_spread != null ? Number(pick.locked_spread) : game ? normalizeSpreadForSelectedTeam(pick.selected_team, game.current_spread_team, game.current_spread) : null;
        const resultLabel = pick.result === "win" ? "W" : pick.result === "loss" ? "L" : pick.result === "push" ? "P" : "—";
        return <div className="bank-game-result" key={pick.id}>
          <TeamLogo url={game ? logoForTeam(game, pick.selected_team) : null} name={pick.selected_team} />
          <div><strong className="bank-game-pick-title">{game ? <ResponsiveTeamName game={game} team={pick.selected_team} className="pick-title-team" /> : <span className="pick-title-team">{pick.selected_team}</span>}<span className="pick-title-market"><NumericText text={spreadText(displayedSpread)} />{pick.pick_type === "underdog" && <><span className="dog-separator" aria-hidden="true">·</span><span className="dog-tag">Dog <NumericText text={dogBonusText(pick.underdog_win_value || "?", pointsMode)} /></span></>}{game && <PossessionIcon game={game} team={pick.selected_team} />}</span></strong>{game && <p><ResponsiveText full={`${displayTeamName(game, game.away_team)} at ${displayTeamName(game, game.home_team)}${hasPickScoreBug(game) ? isFinalGame(game) ? " · Final" : " · Live" : ` · ${cardGameStateText(game, true)}`}`} compact={`${abbreviatedTeamName(game, game.away_team)} at ${abbreviatedTeamName(game, game.home_team)}${hasPickScoreBug(game) ? isFinalGame(game) ? " · Final" : " · Live" : ` · ${cardGameStateText(game, true)}`}`} /></p>}</div>
          {game && hasPickScoreBug(game) ? <PickScoreBug game={game} pick={pick} spread={displayedSpread} /> : pick.result !== "pending" ? <span className={`test-result ${pick.result}`}>{resultLabel}</span> : locked ? <span className="badge pick-status-locked" aria-label="Locked">—</span> : null}
        </div>;
      })}
    </details>;
  })}</div>;
}

function Leaderboard({ rows, pointsMode }: { rows: Array<Standing & { rank?: number }>; pointsMode: boolean }) {
  function rankFor(index: number) {
    if (rows[index].rank) return rows[index].rank;
    const firstMatch = rows.findIndex((row) => row.win_pct === rows[index].win_pct && row.wins === rows[index].wins);
    return firstMatch + 1;
  }

  return <div className={`leaderboard${pointsMode ? " points-mode" : ""}`}>
    <div className="leaderboard-labels">{pointsMode ? <><span>Place</span><span>Player</span><span>Points</span></> : <><span>Place</span><span>Player</span><span>W</span><span>L</span><span>P</span><span>Win %</span></>}</div>
    {rows.map((row, index) => {
      const rank = rankFor(index);
      const hasResults = row.wins + row.losses + row.pushes > 0;
      const pctTone = !hasResults || row.win_pct === 0.5 ? "" : row.win_pct > 0.5 ? "pct-positive" : "pct-negative";
      return <div className="leaderboard-row" key={row.user_id}>
        <RankNumber rank={rank} className="leaderboard-rank" />
        <div className="leaderboard-player"><strong>{row.display_name}</strong></div>
        {pointsMode ? <strong className="leaderboard-points"><NumericText text={Number(row.points || 0)} /></strong> : <>
          <span className="leaderboard-stat"><NumericText text={row.wins} /></span>
          <span className="leaderboard-stat"><NumericText text={row.losses} /></span>
          <span className="leaderboard-stat"><NumericText text={row.pushes} /></span>
          <strong className={`leaderboard-pct ${pctTone}`}><NumericText text={pctText(row.win_pct)} /></strong>
        </>}
      </div>;
    })}
  </div>;
}

function RuleItem({ title, children }: { title: string; children: React.ReactNode }) {
  return <details className="rule-item">
    <summary><strong>{title}</strong><ChevronDown className="rule-chevron" size={17} /></summary>
    <div className="rule-copy">{children}</div>
  </details>;
}

function ConfidenceOrder({ picks, regularTotal, saving, onMove }: { picks: Pick[]; regularTotal: number; saving: boolean; onMove: (index: number, direction: -1 | 1) => void }) {
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

function LoadingShell({ appSlug }: { appSlug: AppSlug }) {
  const loadingNav = [
    { label: "Picks", icon: Zap },
    { label: "My Card", icon: SquareCheck },
    { label: "Standings", icon: Trophy },
    { label: "Rules", icon: Shield }
  ];

  return <div className="app-shell loading-shell">
    <header className="scoreboard-header">
      <div className="scoreboard-main">
        <div className="brand-lockup"><img className="header-wordmark" src={appSlug === "shaw-family" ? "/header-wordmark.png" : "/football-pickem-wordmark.png"} alt={appSlug === "shaw-family" ? "Shaw Family Pick'em" : "Football Pick'em"} width={800} height={appSlug === "shaw-family" ? 96 : 100} decoding="async" fetchPriority="high" /></div>
      </div>
    </header>
    <nav className="primary-nav" aria-label="Main navigation">
      <div className="primary-nav-inner">
        {loadingNav.map((item, index) => <button type="button" key={item.label} className={index === 0 ? "active" : ""} disabled><span className="nav-icon"><item.icon size={19} /></span><span>{item.label}</span></button>)}
      </div>
    </nav>
    <main className="initial-loading" role="status" aria-label="Loading app"><LoaderCircle size={30} /></main>
  </div>;
}

function SideBetCenter({ view, setView, currentUser, profiles, sideBets, slotCounts, maxPerWeek, weekIsOpen, openGames, gameLeague, gameConference, selectedGame, selectedCreatorTeam, amount, recipients, offerNotificationCount, setGame, setGameLeague, setGameConference, setCreatorTeam, setAmount, toggleRecipient, createBet, respond }: {
  view: BetView;
  setView: (value: BetView) => void;
  currentUser: Profile;
  profiles: Profile[];
  sideBets: SideBet[];
  slotCounts: Record<string, number>;
  maxPerWeek: number | null;
  weekIsOpen: boolean;
  openGames: Game[];
  gameLeague: SideBetLeagueFilter;
  gameConference: string;
  selectedGame?: Game;
  selectedCreatorTeam: string;
  amount: string;
  recipients: string[];
  offerNotificationCount: number;
  setGame: (value: string) => void;
  setGameLeague: (value: SideBetLeagueFilter) => void;
  setGameConference: (value: string) => void;
  setCreatorTeam: (value: string) => void;
  setAmount: (value: string) => void;
  toggleRecipient: (value: string) => void;
  createBet: () => Promise<boolean>;
  respond: (action: "accept" | "decline" | "cancel" | "clear", sideBetId: string) => Promise<boolean>;
}) {
  const [confirmingBetId, setConfirmingBetId] = useState<string | null>(null);
  const [pendingMutation, setPendingMutation] = useState<{ action: "create" | "accept" | "decline" | "cancel" | "clear"; sideBetId: string | null } | null>(null);
  const [optimisticActions, setOptimisticActions] = useState<Record<string, "accept" | "decline" | "cancel" | "clear">>({});
  const [slipExpanded, setSlipExpanded] = useState(false);
  const [slipClosing, setSlipClosing] = useState(false);
  const slipSheetRef = useRef<HTMLElement>(null);
  const slipSwipeStartY = useRef<number | null>(null);
  const slipCloseTimer = useRef<number | null>(null);
  const slipClosingRef = useRef(false);
  const saving = pendingMutation !== null;
  const savingBetId = pendingMutation?.sideBetId ?? null;
  const presentedSideBets: SideBet[] = sideBets.flatMap((bet): SideBet[] => {
    const action = optimisticActions[bet.id];
    if (!action) return [bet];
    if (action === "clear") return [];
    const nowIso = new Date().toISOString();
    if (action === "accept") {
      return [{
        ...bet,
        status: "accepted",
        accepted_by: currentUser.id,
        accepted_at: nowIso,
        updated_at: nowIso,
        accepted_by_profile: { id: currentUser.id, display_name: currentUser.display_name },
        targets: bet.targets?.map((target) => target.recipient_id === currentUser.id
          ? { ...target, response: "accepted", responded_at: nowIso }
          : target.response === "pending" ? { ...target, response: "closed", responded_at: nowIso } : target)
      }];
    }
    if (action === "decline") {
      const nextTargets = bet.targets?.map((target) => target.recipient_id === currentUser.id
        ? { ...target, response: "declined", responded_at: nowIso }
        : target);
      const stillPending = Boolean(nextTargets?.some((target) => target.response === "pending"));
      return [{ ...bet, status: stillPending ? bet.status : "declined", updated_at: nowIso, targets: nextTargets }];
    }
    return [{
      ...bet,
      status: "cancelled",
      updated_at: nowIso,
      targets: bet.targets?.map((target) => target.response === "pending" ? { ...target, response: "closed", responded_at: nowIso } : target)
    }];
  });
  const received = sideBetsForView(presentedSideBets, currentUser.id, "received");
  const sent = sideBetsForView(presentedSideBets, currentUser.id, "sent");
  const offers = [...received, ...sent];
  const otherPlayers = profiles.filter((profile) => profile.id !== currentUser.id);
  const offeredTeam = selectedGame ? (selectedCreatorTeam === selectedGame.home_team ? selectedGame.away_team : selectedGame.home_team) : "";
  const creatorSpread = selectedGame && selectedCreatorTeam ? normalizeSpreadForSelectedTeam(selectedCreatorTeam, selectedGame.current_spread_team, selectedGame.current_spread) : null;
  const selectedMatchup = selectedGame ? matchupTextVariants(selectedGame) : null;
  const confirmingBet = received.find((bet) => bet.id === confirmingBetId);
  const slotCount = slotCounts[currentUser.id] || 0;
  const weeklyLimit = maxPerWeek == null ? Infinity : maxPerWeek;
  const limitReached = Number.isFinite(weeklyLimit) && slotCount >= weeklyLimit;
  const filteredOpenGames = openGames
    .filter((game) => game.league === gameLeague && (gameLeague === "NFL" || gameConference === "ALL" || gameConferences(game).includes(gameConference)))
    .sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
  const sideBetGameGroups = filteredOpenGames.reduce<Array<{ key: string; label: string; shortDay: string; games: Game[] }>>((groups, game) => {
    const key = gameDayKey(game.commence_time);
    const existingGroup = groups[groups.length - 1];
    if (existingGroup?.key === key) existingGroup.games.push(game);
    else groups.push({ key, label: gameDayLabel(game.commence_time), shortDay: gameDayShort(game.commence_time), games: [game] });
    return groups;
  }, []);
  const hasSlip = Boolean(selectedGame && selectedCreatorTeam);

  useEffect(() => {
    setOptimisticActions((current) => {
      let changed = false;
      const next = { ...current };
      for (const [sideBetId, action] of Object.entries(current)) {
        const bet = sideBets.find((item) => item.id === sideBetId);
        const target = bet?.targets?.find((item) => item.recipient_id === currentUser.id);
        const confirmed = !bet ||
          (action === "accept" && bet.status === "accepted" && bet.accepted_by === currentUser.id) ||
          (action === "decline" && (target?.response === "declined" || bet.status === "declined")) ||
          (action === "cancel" && bet.status === "cancelled") ||
          (action === "clear" && !bet);
        if (confirmed) {
          delete next[sideBetId];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [currentUser.id, sideBets]);

  const collapseSlip = useCallback(() => {
    if (!slipExpanded || slipClosingRef.current) return;
    slipClosingRef.current = true;
    setSlipClosing(true);
    slipCloseTimer.current = window.setTimeout(() => {
      slipCloseTimer.current = null;
      slipClosingRef.current = false;
      setSlipClosing(false);
      setSlipExpanded(false);
    }, 180);
  }, [slipExpanded]);

  useEffect(() => {
    if (view !== "new" || !selectedGame || !selectedCreatorTeam) setSlipExpanded(false);
  }, [view, selectedGame, selectedCreatorTeam]);

  useEffect(() => () => {
    if (slipCloseTimer.current != null) window.clearTimeout(slipCloseTimer.current);
  }, []);

  useEffect(() => {
    if (slipExpanded) return;
    if (slipCloseTimer.current != null) window.clearTimeout(slipCloseTimer.current);
    slipCloseTimer.current = null;
    slipClosingRef.current = false;
    setSlipClosing(false);
  }, [slipExpanded]);

  useEffect(() => {
    if (!slipExpanded) return;
    function collapseOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && slipSheetRef.current?.contains(target)) return;
      collapseSlip();
    }
    document.addEventListener("pointerdown", collapseOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", collapseOnOutsidePointer, true);
  }, [collapseSlip, slipExpanded]);

  function selectSide(game: Game, team: string) {
    if (selectedGame?.id === game.id && selectedCreatorTeam === team) {
      clearSlip();
      return;
    }
    setGame(game.id);
    setCreatorTeam(team);
    if (slipExpanded) collapseSlip();
    else setSlipExpanded(false);
  }

  function clearSlip() {
    setSlipExpanded(false);
    setGame("");
    setCreatorTeam("");
  }

  function beginSlipSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    slipSwipeStartY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function continueSlipSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    if (slipSwipeStartY.current == null) return;
    if (event.clientY - slipSwipeStartY.current >= 44) {
      slipSwipeStartY.current = null;
      collapseSlip();
    }
  }

  function endSlipSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    slipSwipeStartY.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  async function sendOffer() {
    if (pendingMutation) return;
    setPendingMutation({ action: "create", sideBetId: null });
    try {
      const sentOffer = await createBet();
      if (sentOffer) setSlipExpanded(false);
    } finally {
      setPendingMutation(null);
    }
  }

  async function runResponse(action: "accept" | "decline" | "cancel" | "clear", sideBetId: string) {
    if (pendingMutation) return false;
    setPendingMutation({ action, sideBetId });
    setOptimisticActions((current) => ({ ...current, [sideBetId]: action }));
    try {
      const ok = await respond(action, sideBetId);
      if (!ok) {
        setOptimisticActions((current) => {
          const next = { ...current };
          delete next[sideBetId];
          return next;
        });
      }
      return ok;
    } finally {
      setPendingMutation(null);
    }
  }

  async function acceptConfirmedBet() {
    if (!confirmingBetId) return;
    const sideBetId = confirmingBetId;
    setConfirmingBetId(null);
    const accepted = await runResponse("accept", sideBetId);
    if (!accepted) setConfirmingBetId(sideBetId);
  }

  return <div className={`side-bet-center ${view === "new" && hasSlip ? "has-bet-slip" : ""}`.trim()}>
    <div className={`view-select-row side-bet-filter-row ${view === "new" ? "make-offer" : ""}`.trim()}>
      <MenuSelect ariaLabel="Choose side bet view" className="compact-select" value={view} sections={[{ options: [{ value: "offers", label: "Offers", badge: offerNotificationCount }, { value: "new", label: "Make Offer" }] }]} onChange={(value) => { setSlipExpanded(false); setView(value as BetView); }} />
      {view === "new" && <MenuSelect
        ariaLabel="Filter side bet games by league"
        className="compact-select"
        value={gameLeague}
        sections={[{ options: [{ value: "CFB", label: "CFB" }, { value: "NFL", label: "NFL" }] }]}
        onChange={(value) => { setSlipExpanded(false); setGameLeague(value as SideBetLeagueFilter); }}
      />}
      {view === "new" && gameLeague === "CFB" && <MenuSelect
        ariaLabel="Filter side bet games by conference"
        className="compact-select context-select"
        value={gameConference}
        sections={conferenceFilterSections("ALL CONF.")}
        onChange={(value) => { setSlipExpanded(false); setGameConference(value); }}
      />}
    </div>

    {view === "new" && <div className="side-bet-sportsbook-board">
      {limitReached && <div className="empty-state side-bet-empty-state"><NumericText text={`Your ${weeklyLimit} side bet slots are accepted or pending this week.`} /></div>}
      {!limitReached && openGames.length === 0 && <div className="empty-state side-bet-empty-state">No games with a spread are available before kickoff.</div>}
      {!limitReached && openGames.length > 0 && filteredOpenGames.length === 0 && <div className="empty-state side-bet-empty-state">No available games.</div>}
      {!limitReached && filteredOpenGames.length > 0 && <div className="game-days side-bet-game-days">{sideBetGameGroups.map((group) => <section key={group.key} className="game-day-section">
        <div className="game-day-marker"><b>{group.shortDay}</b><strong>{group.label}</strong></div>
        <div className="game-list">{group.games.map((game) => <SideBetGameCard
          key={game.id}
          game={game}
          selectedTeam={selectedGame?.id === game.id ? selectedCreatorTeam : ""}
          disabled={!weekIsOpen}
          onSelect={selectSide}
        />)}</div>
      </section>)}</div>}
    </div>}

    {view === "new" && selectedGame && selectedCreatorTeam && !slipExpanded && <button className="side-bet-slip-bar" type="button" aria-expanded="false" onClick={() => setSlipExpanded(true)}>
      <TeamLogo url={logoForTeam(selectedGame, selectedCreatorTeam)} name={selectedCreatorTeam} />
      <span className="side-bet-slip-copy"><ResponsiveTeamName game={selectedGame} team={selectedCreatorTeam} className="team-name" /><span className="team-spread"><NumericText text={spreadText(creatorSpread)} /></span></span>
      <span className="side-bet-slip-open"><ChevronUp size={17} /></span>
    </button>}

    {view === "new" && selectedGame && selectedCreatorTeam && slipExpanded && <section ref={slipSheetRef} className={`side-bet-slip-sheet ${slipClosing ? "closing" : ""}`.trim()} role="dialog" aria-labelledby="side-bet-slip-title">
        <div className="side-bet-slip-sheet-head" onPointerDown={beginSlipSwipe} onPointerMove={continueSlipSwipe} onPointerUp={endSlipSwipe} onPointerCancel={endSlipSwipe}>
          <div className="side-bet-slip-title"><h2 id="side-bet-slip-title">{selectedMatchup && <ResponsiveText full={selectedMatchup.full} intermediate={selectedMatchup.intermediate} compact={selectedMatchup.compact} />}</h2><p><NumericText text={`${fullDateText(selectedGame.commence_time)} · ${timeText(selectedGame.commence_time)}`} /></p></div>
          <button type="button" className="slip-icon-btn side-bet-header-collapse" aria-label="Collapse bet slip" onPointerDown={(event) => event.stopPropagation()} onClick={collapseSlip}><ChevronDown size={18} /></button>
        </div>

        <div className="team-row side-bet-slip-selection">
          <TeamLogo url={logoForTeam(selectedGame, selectedCreatorTeam)} name={selectedCreatorTeam} />
          <span className="side-bet-slip-team-choice"><ResponsiveTeamName game={selectedGame} team={selectedCreatorTeam} className="team-name" /><span className="team-spread"><NumericText text={spreadText(creatorSpread)} /></span></span>
          <button type="button" className="slip-icon-btn side-bet-selection-clear" aria-label="Clear selected team" onClick={clearSlip}><X size={18} /></button>
        </div>

        <section className="side-bet-slip-section">
          <div className="side-bet-slip-section-head"><span>Amount</span></div>
          <div className="side-bet-amount-grid">{["20", "15", "10", "5"].map((value) => <button type="button" key={value} className={amount === value ? "active" : ""} aria-pressed={amount === value} onClick={() => setAmount(value)}><NumericText text={`$${value}`} /></button>)}</div>
        </section>

        <section className="side-bet-slip-section">
          <div className="side-bet-slip-section-head"><span>Send to</span></div>
          <fieldset aria-label="Send side bet to"><div className="side-bet-recipient-grid">{otherPlayers.map((profile) => {
            const recipientFull = Number.isFinite(weeklyLimit) && (slotCounts[profile.id] || 0) >= weeklyLimit;
            return <label key={profile.id} className={`${recipients.includes(profile.id) ? "checked" : ""} ${recipientFull ? "disabled" : ""}`.trim()}><input type="checkbox" disabled={recipientFull} checked={recipients.includes(profile.id)} onChange={() => toggleRecipient(profile.id)} /><span>{profile.display_name}</span><small>{recipientFull ? "Unavailable" : recipients.includes(profile.id) ? "Selected" : "Available"}</small></label>;
          })}</div></fieldset>
        </section>

        <div className="side-bet-slip-summary">
          <div><span>You keep</span><strong><ResponsiveText full={`${displayTeamName(selectedGame, selectedCreatorTeam)} ${spreadText(creatorSpread)}`} compact={`${abbreviatedTeamName(selectedGame, selectedCreatorTeam)} ${spreadText(creatorSpread)}`} /></strong></div>
          <div><span>They get</span><strong><ResponsiveText full={`${displayTeamName(selectedGame, offeredTeam)} ${spreadText(creatorSpread == null ? null : -creatorSpread)}`} compact={`${abbreviatedTeamName(selectedGame, offeredTeam)} ${spreadText(creatorSpread == null ? null : -creatorSpread)}`} /></strong></div>
        </div>
        <button className="btn accent side-bet-slip-submit" type="button" disabled={!weekIsOpen || saving || Number(amount) <= 0 || Number(amount) > MAX_SIDE_BET_AMOUNT || !recipients.length} onClick={() => void sendOffer()}><Send size={15} /> {saving ? "Sending…" : "Send offer"}</button>
      </section>}

    {view === "offers" && <SideBetList bets={offers} currentUser={currentUser} empty="No side bet offers yet." saving={saving} savingBetId={savingBetId} canAccept={(bet) => weekIsOpen && hasAvailableSideBetSlot(presentedSideBets, currentUser.id, bet.week, weeklyLimit, bet.id)} acceptDisabledText={!weekIsOpen ? "Opens Tue 8:00 AM" : "Limit reached"} requestAccept={setConfirmingBetId} respond={runResponse} />}

    {confirmingBet && <div className="confirmation-backdrop" onClick={() => { if (!saving) setConfirmingBetId(null); }}>
      <section className="confirmation-sheet" role="dialog" aria-modal="true" aria-labelledby="accept-bet-title" onClick={(event) => event.stopPropagation()}>
        <div className="confirmation-icon"><CircleDollarSign size={22} /></div>
        <div className="confirmation-heading"><span>Review side bet</span><h2 id="accept-bet-title">Accept <NumericText text={stakeMoney(Number(confirmingBet.amount))} /> bet?</h2></div>
        <div className="confirmation-matchup">
          <div><span>You take</span><strong>{confirmingBet.game ? <ResponsiveText full={`${displayTeamName(confirmingBet.game, confirmingBet.offered_team)} ${spreadText(Number(confirmingBet.offered_spread))}`} compact={`${abbreviatedTeamName(confirmingBet.game, confirmingBet.offered_team)} ${spreadText(Number(confirmingBet.offered_spread))}`} /> : <>{confirmingBet.offered_team} <NumericText text={spreadText(Number(confirmingBet.offered_spread))} /></>}</strong><TeamLogo className="side-bet-review-logo" url={confirmingBet.game ? logoForTeam(confirmingBet.game, confirmingBet.offered_team) : null} name={confirmingBet.offered_team} /></div>
          <div><span>{confirmingBet.creator?.display_name || "Opponent"} keeps</span><strong>{confirmingBet.game ? <ResponsiveText full={`${displayTeamName(confirmingBet.game, confirmingBet.creator_team)} ${spreadText(Number(confirmingBet.creator_spread))}`} compact={`${abbreviatedTeamName(confirmingBet.game, confirmingBet.creator_team)} ${spreadText(Number(confirmingBet.creator_spread))}`} /> : <>{confirmingBet.creator_team} <NumericText text={spreadText(Number(confirmingBet.creator_spread))} /></>}</strong><TeamLogo className="side-bet-review-logo" url={confirmingBet.game ? logoForTeam(confirmingBet.game, confirmingBet.creator_team) : null} name={confirmingBet.creator_team} /></div>
        </div>
        {confirmingBet.game && <p className="confirmation-kickoff"><NumericText text={dt(confirmingBet.game.commence_time)} /></p>}
        <div className="confirmation-actions"><button className="btn secondary" disabled={saving} onClick={() => setConfirmingBetId(null)}>Cancel</button><button className="btn accept" disabled={saving} onClick={acceptConfirmedBet}><Check size={16} /> {saving ? "Accepting…" : "Accept bet"}</button></div>
      </section>
    </div>}
  </div>;
}

function SideBetGameCard({ game, selectedTeam, disabled, onSelect }: { game: Game; selectedTeam: string; disabled: boolean; onSelect: (game: Game, team: string) => void }) {
  return <article className={`game-card matchup-card side-bet-game-card ${disabled ? "closed" : ""} ${selectedTeam ? "selected" : ""}`.trim()}>
    <div className="game-head compact-game-head"><div className="game-time-group"><span className="game-time"><NumericText text={timeText(game.commence_time)} /></span></div></div>
    <div className="stacked-matchup" role="group" aria-label={`${displayTeamName(game, game.away_team)} at ${displayTeamName(game, game.home_team)}`}>
      {[game.away_team, game.home_team].map((team) => <button
        type="button"
        key={team}
        className={`team-row ${team === game.away_team ? "away-row" : "home-row"} ${disabled ? "" : "selectable"} ${selectedTeam === team ? "picked-side" : ""}`.trim()}
        disabled={disabled}
        aria-pressed={selectedTeam === team}
        onClick={() => onSelect(game, team)}
      >
        <TeamLogo url={logoForTeam(game, team)} name={team} />
        <ResponsiveTeamName game={game} team={team} className="team-name" />
        <span className="team-spread"><NumericText text={spreadForTeam(game, team)} /></span>
      </button>)}
    </div>
  </article>;
}

function SideBetList({ bets, currentUser, empty, saving, savingBetId, canAccept, acceptDisabledText, requestAccept, respond }: { bets: SideBet[]; currentUser: Profile; empty: string; saving: boolean; savingBetId: string | null; canAccept: (bet: SideBet) => boolean; acceptDisabledText: string; requestAccept: (sideBetId: string) => void; respond: (action: "accept" | "decline" | "cancel" | "clear", sideBetId: string) => Promise<boolean> }) {
  const modeFor = (bet: SideBet) => bet.creator_id === currentUser.id ? "sent" as const : "received" as const;
  const pending = bets
    .filter((bet) => sideBetOfferIsPending(bet, currentUser.id, modeFor(bet)))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const history = bets
    .filter((bet) => !sideBetOfferIsPending(bet, currentUser.id, modeFor(bet)))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const card = (bet: SideBet) => <SideBetCard key={bet.id} bet={bet} mode={modeFor(bet)} currentUser={currentUser} saving={saving} working={savingBetId === bet.id} canAccept={canAccept(bet)} acceptDisabledText={acceptDisabledText} requestAccept={requestAccept} respond={respond} />;

  if (!bets.length) return <div className="side-bet-list"><div className="empty-state">{empty}</div></div>;
  return <div className="side-bet-list grouped">
    <section className="side-bet-list-section" aria-labelledby="pending-offers-title">
      <h3 id="pending-offers-title">Pending Offers</h3>
      <div className="side-bet-list-section-body">{pending.length ? pending.map(card) : <p className="muted side-bet-list-empty">No pending offers.</p>}</div>
    </section>
    <section className="side-bet-list-section" aria-labelledby="offer-history-title">
      <h3 id="offer-history-title">Offer History</h3>
      <div className="side-bet-list-section-body">{history.length ? history.map(card) : <p className="muted side-bet-list-empty">No offer history yet.</p>}</div>
    </section>
  </div>;
}

function SideBetCard({ bet, mode, currentUser, saving, working, canAccept, acceptDisabledText, requestAccept, respond }: { bet: SideBet; mode: "received" | "sent"; currentUser: Profile; saving: boolean; working: boolean; canAccept: boolean; acceptDisabledText: string; requestAccept: (sideBetId: string) => void; respond: (action: "accept" | "decline" | "cancel" | "clear", sideBetId: string) => Promise<boolean> }) {
  const game = bet.game;
  const target = bet.targets?.find((row) => row.recipient_id === currentUser.id);
  const offerOpen = bet.status === "open" && (mode === "sent" || target?.response === "pending") && Boolean(game && new Date(game.commence_time) > new Date());
  const perspective = sideBetPerspective(bet, mode);
  const perspectiveTeam = perspective.team;
  const perspectiveSpread = perspective.spread;
  const offeredSideName = game ? displayTeamName(game, bet.offered_team) : bet.offered_team;
  const offeredSideCompact = game ? abbreviatedTeamName(game, bet.offered_team) : bet.offered_team;
  const matchup = game
    ? matchupTextVariants(game, { spreadTeam: perspectiveTeam, spread: perspectiveSpread })
    : { full: `${perspectiveTeam} ${spreadText(perspectiveSpread)}`, intermediate: undefined, compact: `${perspectiveTeam} ${spreadText(perspectiveSpread)}` };
  const responseSummary = sideBetResponseSummary(bet, currentUser.id, mode);
  const responseSpread = spreadText(Number(bet.offered_spread));
  const amountDisplay = sideBetAmountForUser(bet, currentUser.id);
  const canClearOffer = mode === "received"
    ? target?.response === "declined" || bet.status === "cancelled"
    : ["declined", "cancelled"].includes(bet.status);

  return <article className={`side-bet-card mode-${mode} ${offerOpen ? "open" : ""} ${saving && !working ? "background-busy" : ""}`}>
    <div className="side-bet-offer-row">
      <TeamLogo url={game ? logoForTeam(game, perspectiveTeam) : null} name={perspectiveTeam} />
      <div className="side-bet-offer-copy"><strong><ResponsiveText full={matchup.full} intermediate={matchup.intermediate} compact={matchup.compact} /></strong><SideBetResponseLine summary={responseSummary} teamFull={offeredSideName} teamCompact={offeredSideCompact} spread={responseSpread} date={game ? dt(game.commence_time) : undefined} /></div>
      <strong className={`side-bet-offer-amount ${amountDisplay.tone}`}><NumericText text={amountDisplay.text} /></strong>
    </div>
    {mode === "received" && offerOpen && <div className="actions"><button className={`btn accept ${working ? "working" : ""}`} disabled={saving || !canAccept} onClick={() => requestAccept(bet.id)}><Check size={15} /> {canAccept ? "Review & accept" : <NumericText text={acceptDisabledText} />}</button><button className={`btn secondary ${working ? "working" : ""}`} disabled={saving} onClick={() => respond("decline", bet.id)}><X size={15} /> Decline</button></div>}
    {mode === "sent" && bet.status === "open" && <div className="actions"><button className={`btn secondary ${working ? "working" : ""}`} disabled={saving} onClick={() => respond("cancel", bet.id)}><X size={15} /> Cancel offer</button></div>}
    {canClearOffer && <div className="actions clear-offer-actions"><button className={`btn secondary ${working ? "working" : ""}`} disabled={saving} onClick={() => respond("clear", bet.id)}><Trash2 size={14} /> Clear</button></div>}
  </article>;
}

function SideBetLedgerRow({ bet, currentUser }: { bet: SideBet; currentUser: Profile }) {
  const game = bet.game;
  const creator = sideBetBettorForTeam(bet, bet.creator_team);
  const acceptor = sideBetBettorForTeam(bet, bet.offered_team);
  const displayPerson = (person: { id: string; name: string }) => person.id === currentUser.id ? "You" : person.name;
  const perspective = sideBetLedgerPerspective(bet, currentUser.id);
  const displayTeam = perspective.team;
  const displaySpread = perspective.spread;
  const awayTeam = game?.away_team || bet.offered_team;
  const homeTeam = game?.home_team || bet.creator_team;
  const spread = spreadText(displaySpread);
  const matchup = game
    ? matchupTextVariants(game, { spreadTeam: displayTeam, spread: displaySpread })
    : { full: `${displayTeam} ${spread} vs ${displayTeam === bet.creator_team ? bet.offered_team : bet.creator_team}`, intermediate: undefined, compact: `${displayTeam} ${spread} vs ${displayTeam === bet.creator_team ? bet.offered_team : bet.creator_team}` };
  const winner = bet.winner_id === creator.id ? creator : bet.winner_id === acceptor.id ? acceptor : null;
  const status = bet.status === "accepted" ? "" : bet.result === "push" ? "Push" : winner ? `${displayPerson(winner)} Won` : "Settled";
  const bettors = `${displayPerson(sideBetBettorForTeam(bet, awayTeam))} vs ${displayPerson(sideBetBettorForTeam(bet, homeTeam))}`;
  const amountDisplay = perspective.involvesUser ? sideBetAmountForUser(bet, currentUser.id) : { text: stakeMoney(Number(bet.amount)), tone: "money-neutral" };
  return <div className={`ledger-row side-bet-ledger-row ${bet.status === "accepted" ? "accepted" : ""}`}>
    <TeamLogo url={game ? logoForTeam(game, displayTeam) : null} name={displayTeam} />
    <div className="side-bet-ledger-copy"><strong className="side-bet-ledger-title"><ResponsiveText full={matchup.full} intermediate={matchup.intermediate} compact={matchup.compact} className="side-bet-ledger-matchup" /></strong><p>{bettors}{status ? <> · {status}</> : null}</p></div>
    <strong className={`side-bet-ledger-amount ${amountDisplay.tone}`}><NumericText text={amountDisplay.text} /></strong>
  </div>;
}

function GameCard({ game, picks, statusFilter, leagueFilter, weekIsOpen, now, pointsMode, addPick }: { game: Game; picks: Pick[]; statusFilter: GameStatusFilter; leagueFilter: LeagueFilter; weekIsOpen: boolean; now: number; pointsMode: boolean; addPick: (game: Game, team: string, pickType: PickType) => void }) {
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
    <div className="game-head compact-game-head">
      <div className="game-time-group">{gameIsFinal ? <span className="game-final-status">Final</span> : gameIsLive ? <span className="game-live-status"><NumericText text={livePeriodStatus(game)} /></span> : <span className="game-time"><NumericText text={timeText(game.commence_time)} /></span>}</div>
      {statusFilter !== "OPEN" && gameIsLive && liveSituation && <div className="game-live-situation"><LiveSituationText game={game} /></div>}
    </div>

    <div className="stacked-matchup" role="group" aria-label={`${displayTeamName(game, game.away_team)} at ${displayTeamName(game, game.home_team)}`}>
      <button
        type="button"
        className={`team-row away-row ${awaySelectable ? "selectable" : ""} ${existingMatchesView && existing?.selected_team === game.away_team ? "picked-side" : ""} ${awayOpponentOnly ? "opponent-only" : ""} ${awayBlocked ? "blocked-side" : ""} ${resultClasses(game.away_team)}`}
        disabled={!awaySelectable}
        onClick={() => choose(game.away_team)}
      >
        <TeamLogo url={logoForTeam(game, game.away_team)} name={game.away_team} />
        {showScoreValues ? <span className="team-name-line"><ResponsiveTeamName game={game} team={game.away_team} className="team-name" />{awayResultLine && <span className="team-board-market"><NumericText text={awayResultLine} /></span>}</span> : <ResponsiveTeamName game={game} team={game.away_team} className="team-name" />}
        {showScoreValues ? <span className="team-result-line"><PossessionIcon game={game} team={game.away_team} /><span className="team-result-score"><NumericText text={awayScore ?? "—"} /></span></span> : !awayOpponentOnly && <span className={`team-spread ${awayBlocked ? "unavailable" : ""}`}><span>{awayBlocked ? "Not eligible" : <NumericText text={sideLine(game.away_team)} />}</span></span>}
      </button>

      <button
        type="button"
        className={`team-row home-row ${homeSelectable ? "selectable" : ""} ${existingMatchesView && existing?.selected_team === game.home_team ? "picked-side" : ""} ${homeOpponentOnly ? "opponent-only" : ""} ${homeBlocked ? "blocked-side" : ""} ${resultClasses(game.home_team)}`}
        disabled={!homeSelectable}
        onClick={() => choose(game.home_team)}
      >
        <TeamLogo url={logoForTeam(game, game.home_team)} name={game.home_team} />
        {showScoreValues ? <span className="team-name-line"><ResponsiveTeamName game={game} team={game.home_team} className="team-name" />{homeResultLine && <span className="team-board-market"><NumericText text={homeResultLine} /></span>}</span> : <ResponsiveTeamName game={game} team={game.home_team} className="team-name" />}
        {showScoreValues ? <span className="team-result-line"><PossessionIcon game={game} team={game.home_team} /><span className="team-result-score"><NumericText text={homeScore ?? "—"} /></span></span> : !homeOpponentOnly && <span className={`team-spread ${homeBlocked ? "unavailable" : ""}`}><span>{homeBlocked ? "Not eligible" : <NumericText text={sideLine(game.home_team)} />}</span></span>}
      </button>
    </div>
  </article>;
}

function TeamLogo({ url, name, className = "" }: { url?: string | null; name: string; className?: string }) {
  const classes = `team-logo ${className}`.trim();
  if (url) return <img src={url} alt="" className={classes} width={34} height={34} loading="lazy" decoding="async" />;
  return <div className={`${classes} fallback`}>{name.slice(0, 1)}</div>;
}

function PossessionIcon({ game, team }: { game: Game; team: string }) {
  if (game.live_state !== "in" || game.live_possession_team !== team) return null;
  return <span className="possession-icon" role="img" aria-label="Possession" title="Possession">
    <svg viewBox="0 0 24 14" aria-hidden="true" shapeRendering="geometricPrecision">
      <path d="M1.5 7C4.1 3 7.6 1.4 12 1.4S19.9 3 22.5 7c-2.6 4-6.1 5.6-10.5 5.6S4.1 11 1.5 7Z" fill="currentColor" stroke="#62371f" strokeWidth="1.05" />
      <path d="M8.5 7h7M10.5 5.85v2.3M12 5.85v2.3M13.5 5.85v2.3" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="1.3" />
    </svg>
  </span>;
}

function CardProgress({ rule, counts, hasDog, dirty }: { rule: WeekRule; counts: { total: number; cfb: number; nfl: number }; hasDog: boolean; dirty: boolean }) {
  const ok = counts.total === rule.regularTotal && counts.cfb >= rule.cfbMinimum && counts.nfl >= rule.nflMinimum && hasDog;
  const completeSlots = Math.min(counts.total + Number(hasDog), rule.regularTotal + 1);
  const progress = completeSlots / (rule.regularTotal + 1) * 100;
  const countText = rule.phase === "opening" || rule.phase === "college"
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

function hasPickScoreBug(game: Game | null | undefined) {
  if (!game || (game.live_state !== "in" && !isFinalGame(game))) return false;
  return (game.final_away_score != null && game.final_home_score != null) || (game.live_away_score != null && game.live_home_score != null);
}

function PickScoreBug({ game, pick, spread }: { game: Game; pick: Pick; spread: number | null }) {
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

function PickList({ picks, games, title, pointsMode, removePick, headerContent }: { picks: Pick[]; games: Game[]; title: string; pointsMode: boolean; removePick: (p: Pick) => void; headerContent?: React.ReactNode }) {
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
    return <div className="pick-card" key={pick.id}>
      <div className="pick-top"><TeamLogo url={game ? logoForTeam(game, pick.selected_team) : null} name={pick.selected_team} /><div className="pick-copy"><p className="pick-title">{game ? <AbbreviatedTeamName game={game} team={pick.selected_team} className="pick-title-team" /> : <span className="pick-title-team">{pick.selected_team}</span>}<span className="pick-title-market"><NumericText text={spreadText(displayedSpread)} />{pick.pick_type === "regular" && Number(pick.confidence_points || 0) > 0 && <span className="confidence-card-chip">· <NumericText text={confidencePointText(Number(pick.confidence_points))} /></span>}{pick.pick_type === "underdog" && <><span className="dog-separator" aria-hidden="true">·</span><span className="dog-tag">Dog <NumericText text={dogBonusText(pick.underdog_win_value || "?", pointsMode)} /></span></>}{game && <PossessionIcon game={game} team={pick.selected_team} />}</span></p>{metaText && <p className="pick-meta"><ResponsiveText full={compactMetaText} compact={compactMetaText} accessibleText={metaText} /></p>}</div><div className="pick-row-actions">{game && hasPickScoreBug(game) ? <PickScoreBug game={game} pick={pick} spread={displayedSpread} /> : graded ? <span className={`badge pick-result-${pick.result}`}>{resultLabel}</span> : locked ? <span className="badge pick-status-locked" aria-label="Locked">—</span> : null}{!locked && <button className="icon-btn" aria-label={`Remove ${pick.selected_team}`} onClick={() => removePick(pick)}><X size={16} /></button>}</div></div>
    </div>;
  })}</div>;
}

function VisiblePick({ pick, games, pointsMode }: { pick: Pick; games: Game[]; pointsMode: boolean }) {
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
  return <div className="visible-pick"><TeamLogo url={game ? logoForTeam(game, pick.selected_team) : null} name={pick.selected_team} /><div className="visible-pick-copy"><strong>{game ? <ResponsiveTeamName game={game} team={pick.selected_team} className="pick-title-team" /> : <span className="pick-title-team">{pick.selected_team}</span>}<span className="pick-title-market"><NumericText text={spreadText(displayedSpread)} />{pick.pick_type === "regular" && Number(pick.confidence_points || 0) > 0 && <span className="confidence-card-chip">· <NumericText text={confidencePointText(Number(pick.confidence_points))} /></span>}{pick.pick_type === "underdog" && <><span className="dog-separator" aria-hidden="true">·</span><span className="dog-tag">Dog <NumericText text={dogBonusText(pick.underdog_win_value || "?", pointsMode)} /></span></>}{game && <PossessionIcon game={game} team={pick.selected_team} />}</span></strong>{metaText && <p><ResponsiveText full={metaText} compact={compactMetaText} /></p>}</div><div className="visible-pick-actions">{game && hasPickScoreBug(game) ? <PickScoreBug game={game} pick={pick} spread={displayedSpread} /> : graded ? <span className={`badge pick-result-${pick.result}`}>{resultLabel}</span> : locked ? <span className="badge pick-status-locked" aria-label="Locked">—</span> : null}</div></div>;
}
