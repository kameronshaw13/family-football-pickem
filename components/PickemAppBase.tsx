"use client";

import { buildTestWeek } from "@/lib/demoWeekFixture";
import { pickCardSignature, completeSeasonStandings } from "@/lib/standingsDisplay";
import RuleItem from "@/components/RuleItem";
import Leaderboard from "@/components/Leaderboard";
import SectionTabs from "@/components/SectionTabs";
import { expandGameAliases, mergeLiveScores } from "@/lib/liveScoreMerge";
import { sideBetMatchesGameFilter, sortSideBetsByGameStatus, sortSideBetsGroupedByGame, type SideBetGameFilter } from "@/lib/sideBetSorting";
import { sideBetMarketText, sideBetOddsForTeam, sideBetOddsSuffix, sideBetTotalSideForTeam, sideBetLineText } from "@/lib/sideBetDisplay";
import { money, roundedMoney, stakeMoney, normalizeRiskInput } from "@/lib/moneyDisplay";
import { dogBonusText, dogLineText, confidencePointText } from "@/lib/pickDisplay";
import { basketballLockTime, basketballWeek, basketballWeekBounds, basketballSeasonEnd, isBasketballLeague } from "@/lib/basketballRules";
import BasketballGameDetails from "@/components/BasketballGameDetails";
import BasketballHeaderWordmark from "@/components/BasketballHeaderWordmark";
import { formatOrdinalDate, formatUppercaseOrdinalDate } from "@/lib/displayDates";
import NextImage from "next/image";
import { useRouter } from "next/navigation";

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
import { leagueNameForSlug, type LeagueMembership } from "@/lib/leagueAccess";
import { leagueTabDestination, leagueTabFromQuery } from "@/lib/leagueNavigation";
import { sideBetBettorForTeam, sideBetLedgerPerspective, sideBetOfferIsPending, sideBetPerspective, sideBetResponseSummary, sideBetsForView } from "@/lib/sideBetPresentation";
import { orderCardPicks } from "@/lib/cardOrdering";
import { teamAbbreviatedName, teamDisplayName } from "@/lib/teamNames";
import { canRefreshSpread, getCurrentPickWeek } from "@/lib/lockRules";


import {
  type Tab,
  type PicksView,
  type CardView,
  type StandingsView,
  type BetView,
  type SideBetLeagueFilter,
  type SideBetBoardMarket,
  defaultFootballLeague,
  type SideBetLedgerScope,
  type GameStatusFilter,
  type LeagueFilter,
  type DogValueFilter,
  type GameOutcome,
  type Toast,
  type NotificationDestination,
  type NotificationCounts,
  type BadgeNavigator,
  type LiveScoreUpdate,
  type AppData,
  type AppDataCacheEntry,
  type SideBetSnapshot,
  APP_DATA_CACHE_PREFIX,
  APP_DATA_CACHE_MAX_AGE,
  EMPTY_NOTIFICATION_COUNTS,
  useBrowserLayoutEffect,
  INITIAL_BOARD_LOGO_GAME_LIMIT,
  initialBoardLogoCache,
  preloadTeamLogo,
  preloadInitialBoardLogos,
  CENTRAL_WEEKDAY_SHORT_FORMATTER,
  CENTRAL_FULL_DATE_FORMATTER,
  CENTRAL_OPEN_DATE_FORMATTER,
  CENTRAL_TIME_FORMATTER,
  CENTRAL_DAY_KEY_FORMATTER,
  CENTRAL_DAY_LABEL_FORMATTER,
  CENTRAL_WEEKDAY_LONG_FORMATTER,
  displayTeamName,
  abbreviatedTeamName,
  matchupTextVariants,
  ResponsiveText,
  type SideBetResponseText,
  type SideBetResponseVariant,
  SIDE_BET_RESPONSE_VARIANTS,
  SideBetResponseLine,
  ResponsiveTeamName,
  teamRank,
  BoardTeamName,
  weekdayAbbreviation,
  dt,
  fullDateText,
  openText,
  cardGameStateText,
  timeText,
  gameDayKey,
  gameDayLabel,
  gameDayShort,
  spreadForTeam,
  isClosed,
  isFinalGame,
  universalWeekendLockTime,
  LockedPickIndicator,
  boardStatusForGame,
  defaultBoardStatus,
  livePeriodStatus,
  liveSituationStatus,
  LivePeriodText,
  LiveSituationText,
  liveGameStatus,
  liveRemainingFraction,
  normalCdf,
  livePeriodAndClock,
  liveModelStrategy,
  expectedPossessionPoints,
  liveProbabilityVolatility,
  estimatedCoverChance,
  espnWinChance,
  estimatedWinChance,
  liveWinChance,
  liveOutcome,
  scoreChanged,
  finalScoreText,
  outcomeLabel,
  buildLiveAlert,
  teamDogValue,
  gameConferences,
  appDataCacheKey,
  readCachedAppData,
  writeCachedAppData,
  sideBetSyncSignature,
  sideBetLedgerSignature,
  logoForTeam,
  sideBetAmountForUser,
  totalSideText,
  sideBetTotalMatchupText,
  MatchupLogoPair,
  sideBetAppMarketReference,
  SideBetMarketReferenceText,
  pctText,
  RecordText,
  TeamLogo,
} from "@/components/PickemPresentationShared";
import {
  GameCard,
  PossessionIcon,
  CardProgress,
  hasPickScoreBug,
  PickScoreBug,
  PickList,
  VisiblePick,
} from "@/components/PickemPickViews";
import {
  conferenceFilterSections,
  ConferenceFilter,
  BankBalanceHistoryRow,
  BankWeekResults,
  ConfidenceOrder,
} from "@/components/PickemStandingsViews";
import {
  SideBetCenter,
  SideBetGameCard,
  SideBetList,
  SideBetCard,
  SideBetLedgerRow,
} from "@/components/PickemSideBetViews";

export default function PickemApp({ appSlug = "shaw-family" }: { appSlug?: AppSlug }) {
  const router = useRouter();
  const loginPath = appLoginPath(appSlug);
  const [tab, setTab] = useState<Tab>("picks");
  const [selectedLeague, setSelectedLeague] = useState<LeagueMembership | null>(null);
  const [picksView, setPicksView] = useState<PicksView>("board");
  const [cardView, setCardView] = useState<CardView>("mine");
  const [standingsView, setStandingsView] = useState<StandingsView>("standings");
  const [betView, setBetView] = useState<BetView>("offers");
  const [sideBetLedgerScope, setSideBetLedgerScope] = useState<SideBetLedgerScope>("all");
  const [sideBetLedgerGameFilter, setSideBetLedgerGameFilter] = useState<SideBetGameFilter>("all");
  const [statusFilter, setStatusFilter] = useState<GameStatusFilter>("OPEN");
  const [leagueFilter, setLeagueFilter] = useState<LeagueFilter>(() => appSlug === "friends-basketball" ? "CBB" : defaultFootballLeague());
  const [conferenceFilter, setConferenceFilter] = useState("ALL");
  const [dogValueFilter, setDogValueFilter] = useState<DogValueFilter>("ALL");
  const [statusFilterTouched, setStatusFilterTouched] = useState(false);
  const [data, setData] = useState<AppData | null>(null);
  const [matchupPreviewGame, setMatchupPreviewGame] = useState<Game | null>(null);
  const closeMatchupPreview = useCallback(() => setMatchupPreviewGame(null), []);
  // Keep an open tracker synced to the same live game object as the Pick Board.
  const currentPreviewGame = matchupPreviewGame
    ? data?.games.find((game) => game.id === matchupPreviewGame.id) || matchupPreviewGame
    : null;
  const [cfbModelEdges, setCfbModelEdges] = useState<Record<string, { stars: number; edgePoints: number | null; edgeTeam: string | null }>>({});
  const [week, setWeek] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [headerLogoReady, setHeaderLogoReady] = useState(false);
  const headerLogoRef = useRef<HTMLImageElement>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionValidated, setSessionValidated] = useState(false);
  const lastAppOpenSentAtRef = useRef(0);
  const [message, setMessage] = useState("");
  const [showSavedDataNotice, setShowSavedDataNotice] = useState(false);
  const [marketUpdatesUnavailable, setMarketUpdatesUnavailable] = useState(false);
  const [scoreUpdatesUnavailable, setScoreUpdatesUnavailable] = useState(false);
  const [savingPicks, setSavingPicks] = useState(false);
  const [savingBet, setSavingBet] = useState(false);
  const [savingBetId, setSavingBetId] = useState<string | null>(null);
  const [sideBetLedger, setSideBetLedger] = useState<SideBet[]>([]);
  const [sideBetLedgerReady, setSideBetLedgerReady] = useState(false);
  const [stagedPicks, setStagedPicks] = useState<Pick[] | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [betGameId, setBetGameId] = useState("");
  const [betCreatorTeam, setBetCreatorTeam] = useState("");
  const [betAmount, setBetAmount] = useState("20");
  const [betRecipients, setBetRecipients] = useState<string[]>([]);
  const [betLeagueFilter, setBetLeagueFilter] = useState<SideBetLeagueFilter>(() => appSlug === "friends-basketball" ? "CBB" : defaultFootballLeague());
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
  const liveOfferExpiryInFlightRef = useRef(false);
  const sideBetLedgerRefreshInFlightRef = useRef(false);
  const hasActiveGames = Boolean(data?.games.some((game) => {
    const start = new Date(game.commence_time).getTime();
    return game.final_home_score == null &&
      game.final_away_score == null &&
      !game.live_completed &&
      start <= clock &&
      start >= clock - 18 * 60 * 60 * 1000;
  }));

  useEffect(() => {
    const image = headerLogoRef.current;
    if (image?.complete && image.naturalWidth > 0) setHeaderLogoReady(true);
  }, [appSlug, loading]);

  useEffect(() => {
    const handlePickLocked = (event: Event) => {
      const detail = (event as CustomEvent<{ appSlug?: AppSlug; week?: number; pick?: Partial<Pick> | null }>).detail;
      if (!detail || detail.appSlug !== appSlug || !detail.pick?.selected_team) return;

      setData((current) => {
        if (!current || (detail.week != null && Number(detail.week) !== Number(current.week))) return current;
        let changed = false;
        const nextPicks = current.picks.map((pick) => {
          if (pick.user_id !== current.currentUser.id ||
              Number(pick.week) !== Number(current.week) ||
              pick.selected_team !== detail.pick?.selected_team || (detail.pick.game_id && pick.game_id !== detail.pick.game_id)) return pick;
          changed = true;
          return {
            ...pick,
            status: "locked" as const,
            locked_spread: detail.pick?.locked_spread ?? pick.locked_spread,
            locked_at: detail.pick?.locked_at ?? pick.locked_at
          };
        });
        if (!changed) return current;
        const nextData = { ...current, picks: nextPicks };
        dataRef.current = nextData;
        writeCachedAppData(appSlug, nextData.week, nextData);
        return nextData;
      });

      setStagedPicks((current) => current?.map((pick) =>
        pick.selected_team === detail.pick?.selected_team && (!detail.pick.game_id || pick.game_id === detail.pick.game_id)
          ? { ...pick, status: "locked" as const, locked_spread: detail.pick?.locked_spread ?? pick.locked_spread, locked_at: detail.pick?.locked_at ?? pick.locked_at }
          : pick
      ) ?? current);
    };

    window.addEventListener("pickem:pick-locked", handlePickLocked);
    return () => window.removeEventListener("pickem:pick-locked", handlePickLocked);
  }, [appSlug]);

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
      const changed = sideBetSyncSignature(current.sideBets) !== sideBetSyncSignature(payload.sideBets || []);
      applySideBetSnapshot({ ...payload, sideBets: payload.sideBets || [] }, requestId);
      if (changed) {
        void refreshNotificationCounts();
        // Never scroll the document in response to remote Side Bet or ledger updates.
      }
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
      const current = dataRef.current;
      if (!current) return;
      const response = await fetch(`/api/side-bet-ledger?week=${current.week}`, {
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
    setNotificationCounts((current) => ({
      ...current,
      [destination]: 0,
      total: Math.max(0, current.total - current[destination])
    }));
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

  // Preserve the selected destination tab when moving between league routes.
  useEffect(() => {
    const url = new URL(window.location.href);
    const requestedTab = leagueTabFromQuery(url.searchParams.get("view"));
    if (!requestedTab) return;
    setTab(requestedTab);
    url.searchParams.delete("view");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [appSlug]);

  const chooseNavTab = useCallback((nextTab: Tab) => {
    const destination = leagueTabDestination(appSlug, selectedLeague, nextTab);
    if (destination) {
      router.push(destination);
      return;
    }
    setTab(nextTab);
  }, [appSlug, router, selectedLeague]);

  const loadSequence = useRef(0);
  const load = useCallback(async (nextWeek: number | null = dataRef.current?.week ?? null) => {
    const sequence = ++loadSequence.current;
    const isInitialLoad = dataRef.current === null;
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) {
      window.location.href = loginPath;
      return;
    }
    const cachedPayload = isInitialLoad ? readCachedAppData(appSlug, nextWeek) : null;
    if (cachedPayload) {
      void preloadInitialBoardLogos(cachedPayload);
      const cachedAt = Date.now();
      const cachedWeekIsOpen = !cachedPayload.weekOpenTime || new Date(cachedPayload.weekOpenTime).getTime() <= cachedAt;
      dataRef.current = cachedPayload;
      setData(cachedPayload);
      setWeek(cachedPayload.week);
      setStatusFilter(defaultBoardStatus(cachedPayload.games || [], cachedAt, cachedWeekIsOpen));
      setStatusFilterTouched(false);
      setLoading(false);
      setRefreshing(true);
      setShowSavedDataNotice(true);
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
      if (sequence !== loadSequence.current) return;
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
      setSessionValidated(true);
      const usingSavedResponse = response.headers.get("x-pickem-startup-cache") === "1";
      setShowSavedDataNotice(usingSavedResponse);
      const loadedAt = Date.now();
      const loadedWeekIsOpen = !payload.weekOpenTime || new Date(payload.weekOpenTime).getTime() <= loadedAt;
      if (!cachedPayload) await preloadInitialBoardLogos(payload);
      if (sequence !== loadSequence.current) return;
      dataRef.current = payload;
      setData(payload);
      setWeek(payload.week);
      if (!cachedPayload) {
        setStatusFilter(defaultBoardStatus(payload.games || [], loadedAt, loadedWeekIsOpen));
        setStatusFilterTouched(false);
      }
      if (!usingSavedResponse) writeCachedAppData(appSlug, nextWeek, payload);
    } catch {
      if (sequence === loadSequence.current && !cachedPayload) setMessage("Could not load app data.");
    } finally {
      if (sequence === loadSequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [appSlug, loginPath]);

  useEffect(() => { void load(null); return () => { loadSequence.current += 1; }; }, [load]);
  useEffect(() => { dataRef.current = data; }, [data]);
  const modelUsername = data?.currentUser?.username;
  const modelWeek = data?.week;
  useEffect(() => {
    const username = String(modelUsername || "").trim().toLowerCase();
    const enabled = (appSlug === "shaw-family" || appSlug === "friends") && username === "kameron" && modelWeek != null;
    if (!enabled) {
      setCfbModelEdges({});
      return;
    }
    let active = true;
    const token = window.localStorage.getItem("pickem_session_token") || "";
    fetch(`/api/cfb-model?week=${encodeURIComponent(String(modelWeek))}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "x-pickem-group": appSlug },
      cache: "no-store"
    })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Model edges unavailable.");
        return payload;
      })
      .then(payload => {
        if (!active) return;
        const rows = Array.isArray(payload.games) ? payload.games : [];
        setCfbModelEdges(Object.fromEntries(rows.map((row: { gameId: string; stars?: number; edgePoints?: number | null; edgeTeam?: string | null }) => [row.gameId, {
          stars: Number(row.stars || 0),
          edgePoints: row.edgePoints == null ? null : Number(row.edgePoints),
          edgeTeam: row.edgeTeam || null
        }])));
      })
      .catch(() => { if (active) setCfbModelEdges({}); });
    return () => { active = false; };
  }, [appSlug, modelUsername, modelWeek]);
  useEffect(() => {
    if (!data?.currentUser.id) return;
    const nextLedger = Array.isArray(data.sideBetLedger) ? data.sideBetLedger : [];
    setSideBetLedger((current) => sideBetLedgerSignature(current) === sideBetLedgerSignature(nextLedger) ? current : nextLedger);
    setSideBetLedgerReady(true);
  }, [data?.activeGroup?.id, data?.currentUser.id, data?.sideBetLedger, data?.week]);
  useEffect(() => {
    if (!dataRef.current || testWeekActive) return;
    const offersVisible = tab === "picks" && picksView === "sideBets";
    const ledgerVisible = tab === "standings" && standingsView === "bank";
    if (!offersVisible && !ledgerVisible) return;

    const refreshVisibleSideBets = () => {
      if (document.visibilityState !== "visible") return;
      if (offersVisible) void refreshSideBets();
      if (ledgerVisible) void refreshSideBetLedger();
    };

    refreshVisibleSideBets();
    const timer = window.setInterval(refreshVisibleSideBets, offersVisible ? 5000 : 30000);
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
    const timer = window.setInterval(refresh, 60_000);
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
    if (!sessionValidated || !data?.currentUser?.id || (appSlug !== "friends" && appSlug !== "shaw-family")) return;
    let hiddenSince: number | null = document.visibilityState === "hidden" ? 0 : null;

    const recordOpen = () => {
      const now = Date.now();
      if (now - lastAppOpenSentAtRef.current < 2 * 60_000) return;
      const token = window.localStorage.getItem("pickem_session_token");
      if (!token) return;
      lastAppOpenSentAtRef.current = now;
      void fetch("/api/app-open", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "x-pickem-group": appSlug },
        cache: "no-store"
      }).catch(() => { /* Activity logging must never interfere with the app. */ });
    };

    if (document.visibilityState === "visible") recordOpen();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") hiddenSince = Date.now();
      else if (hiddenSince === 0 || (hiddenSince != null && Date.now() - hiddenSince >= 2 * 60_000)) recordOpen();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [appSlug, data?.currentUser?.id, sessionValidated]);
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
    if (tab === "picks" && picksView === "sideBets" && betView === "offers") {
      if (notificationCounts.side_bets_received > 0) void markNotificationsSeen("side_bets_received");
      if (notificationCounts.side_bets_sent > 0) void markNotificationsSeen("side_bets_sent");
      return;
    }
    if (destination && notificationCounts[destination] > 0) void markNotificationsSeen(destination);
  }, [betView, cardView, data, markNotificationsSeen, notificationCounts, picksView, standingsView, tab, testWeekActive]);
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
    if (!dataRef.current || week == null || testWeekActive || tab !== "picks" || picksView !== "board") return;
    let cancelled = false;
    let refreshInFlight = false;
    let failedChecks = 0;

    async function refreshPickBoardMarkets() {
      if (document.visibilityState === "hidden" || refreshInFlight) return;
      const token = window.localStorage.getItem("pickem_session_token");
      if (!token) return;
      refreshInFlight = true;
      try {
        const response = await fetch(`/api/side-bet-markets?week=${week}`, {
          headers: { Authorization: `Bearer ${token}`, "x-pickem-group": appSlug },
          cache: "no-store"
        });
        if (!response.ok) throw new Error("Market updates unavailable");
        const payload = await response.json() as {
          markets?: SideBetMarketQuote[];
          schedule?: Array<{ id: string; commence_time: string; lock_time: string; is_locked: boolean }>;
        };
        if (cancelled) return;
        if (!Array.isArray(payload.markets)) throw new Error("Invalid market response");
        failedChecks = 0;
        setMarketUpdatesUnavailable(false);

        const quotesById = new Map(payload.markets.map((quote) => [quote.gameId, quote]));
        const scheduleById = new Map((payload.schedule || []).map((game) => [game.id, game]));
        setData((current) => {
          if (!current || Number(current.week) !== Number(week)) return current;
          let changed = false;
          const now = new Date();
          const nextGames = current.games.map((game) => {
            const scheduleGame = scheduleById.get(game.id);
            let nextGame = game;
            if (scheduleGame && (
              scheduleGame.commence_time !== game.commence_time ||
              scheduleGame.lock_time !== game.lock_time ||
              scheduleGame.is_locked !== game.is_locked
            )) {
              changed = true;
              nextGame = { ...game, ...scheduleGame };
            }

            const quote = quotesById.get(game.id);
            const spread = quote?.phase === "pregame" && quote.spread && !quote.spread.suspended ? quote.spread : null;
            if (!spread || !(isBasketballLeague(nextGame.league) ? now < basketballLockTime(nextGame.commence_time) : canRefreshSpread(nextGame.commence_time, now))) return nextGame;
            const nextAwaySpread = Number(spread.awayPoint);
            const currentAwaySpread = normalizeSpreadForSelectedTeam(nextGame.away_team, nextGame.current_spread_team, nextGame.current_spread);
            if (!Number.isFinite(nextAwaySpread)) return nextGame;
            const spreadUnchanged = currentAwaySpread != null && Math.abs(currentAwaySpread - nextAwaySpread) < 0.001;
            if (spreadUnchanged && nextGame.current_bookmaker === "DraftKings") return nextGame;
            changed = true;
            return {
              ...nextGame,
              current_spread_team: nextGame.away_team,
              current_spread: nextAwaySpread,
              current_bookmaker: "DraftKings",
              updated_at: now.toISOString()
            };
          });
          if (!changed) return current;
          const nextData = { ...current, games: nextGames };
          dataRef.current = nextData;
          writeCachedAppData(appSlug, current.week, nextData);
          return nextData;
        });
      } catch {
        if (!cancelled && ++failedChecks >= 3) setMarketUpdatesUnavailable(true);
      } finally {
        refreshInFlight = false;
      }
    }

    void refreshPickBoardMarkets();
    const timer = window.setInterval(refreshPickBoardMarkets, 30_000);
    const refreshOnResume = () => void refreshPickBoardMarkets();
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
  }, [appSlug, picksView, tab, testWeekActive, week]);
  useEffect(() => {
    if (week == null || !hasActiveGames) return;
    let cancelled = false;
    let scoreRefreshInFlight = false;
    let finalizationInFlight = false;
    let failedScoreChecks = 0;

    async function finalizeCompletedGames() {
      if (finalizationInFlight) return;
      const token = window.localStorage.getItem("pickem_session_token");
      if (!token) return;
      finalizationInFlight = true;
      try {
        const response = await fetch("/api/live-finalize?week=" + week, {
          method: "POST",
          headers: { Authorization: "Bearer " + token, "x-pickem-group": appSlug },
          cache: "no-store"
        });
        if (!response.ok) return;
        const payload = await response.json() as { resultsUpdated?: boolean };
        if (payload.resultsUpdated) void load(week);
      } catch {
        // The daily results cron remains the fallback if a finalization request fails.
      } finally {
        finalizationInFlight = false;
      }
    }

    async function refreshLiveScores() {
      if (document.visibilityState === "hidden" || scoreRefreshInFlight) return;
      const token = window.localStorage.getItem("pickem_session_token");
      if (!token) return;
      scoreRefreshInFlight = true;
      try {
        const response = await fetch("/api/live-scores?week=" + week, {
          signal: AbortSignal.timeout(15000),
          headers: { Authorization: "Bearer " + token, "x-pickem-group": appSlug },
          cache: "no-store"
        });
        if (!response.ok) throw new Error("Score updates unavailable");
        const payload = await response.json() as { games?: LiveScoreUpdate[]; needsFinalization?: boolean; unavailableGameIds?: string[] };
        if (!cancelled) {
          failedScoreChecks = 0;
          setScoreUpdatesUnavailable(Boolean(payload.unavailableGameIds?.length));
        }
        if (cancelled || !payload.games?.length) return;
        const current = dataRef.current;
        if (!current) return;
        const nextGames = mergeLiveScores(current.games, payload.games);
        const alert = buildLiveAlert(current, nextGames);
        const nextData = { ...current, games: nextGames };
        dataRef.current = nextData;
        setData(nextData);

        const changedLiveOffers = current.sideBets.flatMap((bet) => {
          if (bet.status !== "open" || bet.offer_phase !== "live") return [];
          const sentHome = bet.live_offer_home_score == null ? null : Number(bet.live_offer_home_score);
          const sentAway = bet.live_offer_away_score == null ? null : Number(bet.live_offer_away_score);
          const game = nextGames.find((item) => item.id === bet.game_id);
          const visibleHome = game?.live_home_score == null ? null : Number(game.live_home_score);
          const visibleAway = game?.live_away_score == null ? null : Number(game.live_away_score);
          if (sentHome == null || sentAway == null || visibleHome == null || visibleAway == null) return [];
          if (sentHome === visibleHome && sentAway === visibleAway) return [];
          return [{
            sideBetId: bet.id,
            visibleLiveHomeScore: visibleHome,
            visibleLiveAwayScore: visibleAway
          }];
        });

        if (changedLiveOffers.length && !liveOfferExpiryInFlightRef.current) {
          const token = window.localStorage.getItem("pickem_session_token");
          if (token) {
            const requestId = ++sideBetRequestSequenceRef.current;
            liveOfferExpiryInFlightRef.current = true;
            void fetch("/api/side-bets", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-pickem-group": appSlug },
              body: JSON.stringify({ action: "expireLiveScores", offers: changedLiveOffers, viewWeek: week })
            })
              .then(async (response) => response.ok ? response.json() as Promise<SideBetSnapshot> : null)
              .then((payload) => {
                if (!payload) return;
                applySideBetSnapshot({ ...payload, sideBets: payload.sideBets || [] }, requestId);
                void refreshNotificationCounts();
              })
              .catch(() => undefined)
              .finally(() => { liveOfferExpiryInFlightRef.current = false; });
          }
        }

        if (alert) setToast(alert);
        if (payload.needsFinalization) void finalizeCompletedGames();
      } catch {
        if (!cancelled && ++failedScoreChecks >= 3) setScoreUpdatesUnavailable(true);
      } finally {
        scoreRefreshInFlight = false;
      }
    }

    void refreshLiveScores();
    const timer = window.setInterval(refreshLiveScores, 5_000);
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
  }, [appSlug, applySideBetSnapshot, hasActiveGames, load, refreshNotificationCounts, week]);
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
    if (data?.groupRules?.scoring?.mode !== "confidence" || stagedPicks || savingPicks || testWeekActive) return;
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
    sideBetMutationInFlightRef.current = true;
    const requestId = ++sideBetRequestSequenceRef.current;
    setSavingBet(true);
    setSavingBetId(body.sideBetId || null);
    try {
      const current = dataRef.current;
      const liveBet = body.action === "accept" && body.sideBetId
        ? current?.sideBets.find((bet) => bet.id === body.sideBetId)
        : null;
      const liveGame = liveBet?.offer_phase === "live"
        ? current?.games.find((game) => game.id === liveBet.game_id)
        : null;
      const requestBody = liveGame
        ? {
            ...body,
            visibleLiveHomeScore: liveGame.live_home_score ?? undefined,
            visibleLiveAwayScore: liveGame.live_away_score ?? undefined
          }
        : body;
      const response = await fetch("/api/side-bets", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-pickem-group": appSlug }, body: JSON.stringify({ ...requestBody, viewWeek: current?.week ?? data?.week }) });
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
      if (["friends", "friends-basketball"].includes(appSlug) && ["create", "accept", "cancel", "decline"].includes(body.action)) {
        void load(current?.week ?? data?.week ?? week);
      }
      if (body.action === "accept") void refreshSideBetLedger();
      void refreshNotificationCounts();
      return true;
    } catch {
      notify("Side bet action failed.", "error");
      return false;
    } finally {
      sideBetMutationInFlightRef.current = false;
      setSavingBet(false);
      setSavingBetId(null);
    }
  }

  if (loading) {
    const startupWeek = appSlug === "friends-basketball" ? basketballWeek(new Date(clock)) : getCurrentPickWeek(new Date(clock));
    const loadingNav = [
      { label: "Picks", icon: Zap },
      { label: "My Card", icon: SquareCheck },
      { label: "Standings", icon: Trophy },
      { label: "Settings", icon: SettingsIcon }
    ];

    return <div className="app-shell loading-shell">
      <header className="scoreboard-header">
        <div className="scoreboard-main">
          {appSlug === "friends-basketball"
            ? <BasketballHeaderWordmark imageRef={headerLogoRef} ready={headerLogoReady} onReady={() => setHeaderLogoReady(true)} />
            : <div className="brand-lockup"><NextImage unoptimized ref={headerLogoRef} className="header-wordmark" style={{ visibility: headerLogoReady ? "visible" : "hidden", opacity: headerLogoReady ? 1 : 0 }} src={appSlug === "shaw-family" ? "/header-wordmark.png" : "/football-pickem-wordmark.png"} alt={appSlug === "shaw-family" ? "Shaw Family Pick'em" : "Football Pick'em"} width={800} height={appSlug === "shaw-family" ? 96 : 100} decoding="sync" fetchPriority="high" onLoad={() => setHeaderLogoReady(true)} /></div>}
          <div className="header-actions" aria-hidden="true">
            <span className="header-refresh-indicator" />
            <div className="header-slate">
              <div className="week-select-wrap header-menu-select loading-week-select"><span>{startupWeek === 0 ? "Week 0" : `Week ${startupWeek}`}</span><ChevronDown size={16} /></div>
            </div>
          </div>
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
  if (!data) return <div className="app-shell"><main className="container"><div className="error-card">{message || "Could not load app."}</div></main></div>;

  const { currentUser, games, picks, profiles, standings, availableWeeks, bankEntries } = data;
  const sideBetAccessDenied = isSideBetRestricted(data.groupRules, currentUser.id);
  const pointsMode = data.groupRules?.scoring?.mode === "confidence";
  const leagueCardProfiles = [
    profiles.find((profile) => profile.id === currentUser.id) || currentUser,
    ...profiles.filter((profile) => profile.id !== currentUser.id)
  ];
  const liveSideBets = data.sideBets || [];
  const testWeek = testWeekActive && profiles.length === 3 ? buildTestWeek(profiles, currentUser.id) : null;
  const previewActive = Boolean(testWeekActive && testWeek);
  const sideBets = previewActive ? testWeek!.sideBets : liveSideBets;
  const viewedSideBetLedger = sortSideBetsGroupedByGame(
    (previewActive ? testWeek!.sideBets : sideBetLedger)
      .filter((bet) => bet.status === "accepted" || bet.status === "settled")
      .filter((bet) => sideBetLedgerScope === "all" || bet.creator_id === currentUser.id || bet.accepted_by === currentUser.id)
      .filter((bet) => sideBetMatchesGameFilter(bet, sideBetLedgerGameFilter))
  );
  const viewedSideBetBankTotals = previewActive ? testWeek!.sideBetBankTotals : data.sideBetBankTotals;
  const viewedGames = previewActive ? testWeek!.games : games;
  const cardGames = expandGameAliases(viewedGames);
  const viewedPicks = previewActive ? testWeek!.picks : picks;
  const viewedWeek = previewActive ? 3 : data.week;
  const currentWeek = Number(data.currentWeek ?? data.week);
  const weekConcluded = !previewActive && (Number(data.week) < currentWeek || (appSlug === "friends-basketball" && clock >= basketballSeasonEnd(data.groupRules).getTime()));
  const weekNotOpenYet = !previewActive && Number(data.week) > currentWeek;
  const viewedBankEntries = previewActive ? testWeek!.bankEntries : bankEntries;
  const viewedBankHistory = previewActive ? [] : data.bankHistory || [];
  const rule = previewActive ? getWeekRule(3) : data.weekRule || getWeekRule(data.week);
  const boardActive = tab === "picks" && picksView === "board";
  const sideBetsActive = tab === "picks" && picksView === "sideBets";
  const standingsActive = tab === "standings" && standingsView === "standings";
  const bankActive = tab === "standings" && standingsView === "bank";
  const myPicks = viewedPicks.filter((p) => p.user_id === currentUser.id && p.week === viewedWeek);
  const cardPicks = previewActive ? myPicks : stagedPicks ?? myPicks;
  const universalLockAt = appSlug === "friends-basketball" ? basketballWeekBounds(viewedWeek, data.groupRules).end.getTime() : universalWeekendLockTime(viewedGames);
  const universalLockReached = universalLockAt != null && universalLockAt <= clock;
  const requiredCardPicks = rule.regularTotal + rule.underdogTotal;
  const allSubmittedPicksLocked = cardPicks.length > 0 && cardPicks.every((pick) => {
    const game = viewedGames.find((item) => item.id === pick.game_id) || pick.game;
    return pick.status === "locked" || Boolean(game && isClosed(game));
  });
  const cardIsFullyLocked = cardPicks.length >= requiredCardPicks && allSubmittedPicksLocked;
  const hideCardProgress = universalLockReached || cardIsFullyLocked;
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
  const weekIsOpen = !previewActive && !weekNotOpenYet && (!data.weekOpenTime || new Date(data.weekOpenTime).getTime() <= clock);
  const sideBetWeekIsOpen = !previewActive && !weekNotOpenYet && (!data.sideBetWeekOpenTime || new Date(data.sideBetWeekOpenTime).getTime() <= clock);
  const receivedNotificationCount = previewActive ? 1 : notificationCounts.side_bets_received;
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
    total: !previewActive && data.bankBalances && Object.prototype.hasOwnProperty.call(data.bankBalances, profile.id)
      ? Number(data.bankBalances[profile.id] || 0)
      : viewedBankEntries.filter((entry) => entry.user_id === profile.id).reduce((sum, entry) => sum + Number(entry.amount || 0), 0) + Number(viewedSideBetBankTotals?.[profile.id] || 0)
  })).sort((a, b) => b.total - a.total) : [];
  const mySideBetWeekTotal = previewActive
    ? Number(testWeek!.sideBetBankTotals?.[currentUser.id] || 0)
    : Number(data.sideBetWeekTotals?.[currentUser.id] || 0);
  const myActiveSideBets = (previewActive ? testWeek!.sideBets : sideBetLedger)
    .filter((bet) => bet.status === "accepted" && (bet.creator_id === currentUser.id || bet.accepted_by === currentUser.id));
  const myActiveSideBetCount = myActiveSideBets.length;
  const myActivePotentialProfit = myActiveSideBets.reduce((sum, bet) => sum + sideBetProfitForUser(bet, currentUser.id), 0);
  const myActivePotentialLoss = myActiveSideBets.reduce((sum, bet) => sum + sideBetRiskForUser(bet, currentUser.id), 0);
  const openBetGames = sideBetsActive ? games.filter((game) => !isFinalGame(game)) : [];
  const selectedBetGame = openBetGames.find((game) => game.id === betGameId);
  const selectedCreatorTeam = selectedBetGame && [selectedBetGame.away_team, selectedBetGame.home_team].includes(betCreatorTeam) ? betCreatorTeam : "";
  const displayedRules = tab === "settings" ? ruleSections(appSlug, data.groupRules || {}) : [];

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

  const displayedFinalMatchups = new Set<string>();
  const filteredGames = boardActive ? viewedGames.filter((g) => {
    if (boardStatusForGame(g, clock, weekIsOpen) !== statusFilter) return false;
    if (leagueFilter === "CFB") {
      return g.league === "CFB" && (conferenceFilter === "ALL" || gameConferences(g).includes(conferenceFilter));
    }
    if (leagueFilter === "NFL" || leagueFilter === "CBB" || leagueFilter === "NBA") return g.league === leagueFilter;
    const dogValue = Math.max(...[g.away_team, g.home_team].map((team) => teamDogValue(g, team)));
    return dogValue > 0 && (dogValueFilter === "ALL" || dogValue === Number(dogValueFilter));
  }).sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()).filter((game) => {
    // Historical imports can retain more than one row for the same matchup,
    // each with picks or side bets attached. Keep those records for grading,
    // but show the final score just once on the board.
    if (statusFilter !== "FINAL") return true;
    const key = [game.league, game.week, game.commence_time, game.away_team, game.home_team].join("|");
    if (displayedFinalMatchups.has(key)) return false;
    displayedFinalMatchups.add(key);
    return true;
  }) : [];
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

  async function createSideBet(options: { marketType: SideBetMarketType; offerPhase: SideBetOfferPhase; creatorSpread: number; totalPoints?: number | null; creatorOdds: number; amount: number }): Promise<boolean> {
    if (!sideBetWeekIsOpen) {
      notify("Side bet offers are not open for this week yet.", "error");
      return false;
    }
    if (!selectedBetGame || !selectedCreatorTeam || !betRecipients.length) return false;
    const submittedAmount = Math.round(Number(options.amount) * 100) / 100;
    const maxAmount = data?.sideBetSettings?.manualAmount
      ? MAX_CUSTOM_SIDE_BET_AMOUNT
      : data?.sideBetSettings?.maxAmount ?? MAX_SIDE_BET_AMOUNT;
    if (!Number.isFinite(submittedAmount) || submittedAmount <= 0) {
      notify("Choose a valid side bet amount.", "error");
      return false;
    }
    if (submittedAmount > maxAmount) {
      notify(`Side bets are capped at ${maxAmount}.`, "error");
      return false;
    }
    if (!validAmericanOdds(options.creatorOdds)) {
      notify("Enter valid American odds (for example -200, -110, +100, or +200).", "error");
      return false;
    }
    const maxPerWeek = data?.sideBetSettings?.maxPerWeek ?? null;
    if (maxPerWeek != null && (data?.sideBetSlotCounts?.[currentUser.id] || 0) >= maxPerWeek) {
      notify(`You already have ${maxPerWeek} accepted or pending side bets this week.`, "error");
      return false;
    }
    const fullRecipient = maxPerWeek == null ? undefined : profiles.find((profile) => betRecipients.includes(profile.id) && (data?.sideBetSlotCounts?.[profile.id] || 0) >= maxPerWeek);
    if (fullRecipient) {
      notify(`${fullRecipient.display_name} has reached the weekly side bet limit.`, "error");
      return false;
    }
    const ok = await postSideBet({
      action: "create",
      gameId: selectedBetGame.id,
      creatorTeam: selectedCreatorTeam,
      amount: submittedAmount,
      recipientIds: betRecipients,
      marketType: options.marketType,
      offerPhase: options.offerPhase,
      creatorSpread: options.marketType === "spread" ? options.creatorSpread : 0,
      totalPoints: options.marketType === "total" ? options.totalPoints : undefined,
      creatorOdds: options.creatorOdds,
      visibleLiveHomeScore: options.offerPhase === "live" ? selectedBetGame.live_home_score ?? undefined : undefined,
      visibleLiveAwayScore: options.offerPhase === "live" ? selectedBetGame.live_away_score ?? undefined : undefined
    });
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
    { id: "settings", label: "Settings", icon: SettingsIcon }
  ];

  // Show the chosen league wordmark in Settings before navigating to its data.
  const displayedHeaderSlug = tab === "settings" ? selectedLeague?.slug ?? appSlug : appSlug;

  return <div className="app-shell">
    <header className="scoreboard-header">
      <div className="scoreboard-main">
        {displayedHeaderSlug === "friends-basketball"
          ? <BasketballHeaderWordmark imageRef={headerLogoRef} ready={headerLogoReady} onReady={() => setHeaderLogoReady(true)} />
          : <div className="brand-lockup"><NextImage unoptimized ref={headerLogoRef} className="header-wordmark" style={{ visibility: headerLogoReady ? "visible" : "hidden", opacity: headerLogoReady ? 1 : 0 }} src={displayedHeaderSlug === "shaw-family" ? "/header-wordmark.png" : "/football-pickem-wordmark.png"} alt={displayedHeaderSlug === "shaw-family" ? "Shaw Family Pick'em" : "Football Pick'em"} width={800} height={displayedHeaderSlug === "shaw-family" ? 96 : 100} decoding="sync" fetchPriority="high" onLoad={() => setHeaderLogoReady(true)} /></div>}
        <div className="header-actions">
          <span className="header-refresh-indicator" role="status" aria-label={refreshing ? "Updating week" : undefined}>{refreshing && <LoaderCircle size={17} />}</span>
          {displayedHeaderSlug !== appSlug ? null : previewActive ? <div className="test-week-chip">Test Week</div> : availableWeeks.length > 0 && <div className="header-slate"><MenuSelect
            ariaLabel="Select week"
            className="week-select-wrap header-menu-select"
            plainText
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
        {primaryNav.map((item) => <button key={item.id} aria-current={tab === item.id ? "page" : undefined} className={tab === item.id ? "active" : ""} onClick={() => chooseNavTab(item.id)}><span className={`nav-icon nav-icon-${item.id}`}><item.icon size={19} /><NotificationBadge count={navNotificationCounts[item.id] || 0} className="nav-notification-badge" /></span><span>{item.label}</span></button>)}
      </div>
    </nav>

    <main className="container">
      {message && <div className="error-card"><NumericText text={message} /></div>}
      {showSavedDataNotice && <div className="saved-data-notice" role="status"><span>Showing saved data. Live updates are unavailable.</span><button type="button" onClick={() => void load(data.week)}>Retry</button></div>}
      {tab === "picks" && picksView === "board" && marketUpdatesUnavailable && <div className="feed-notice" role="status">Odds updates are delayed. Showing the last available lines.</div>}
      {hasActiveGames && scoreUpdatesUnavailable && <div className="feed-notice" role="status">Score updates are delayed. Showing the last available scores.</div>}
      {previewActive && <div className="test-mode-banner"><span><FlaskConical size={16} /><span><strong>Board state preview</strong><small>No real picks or bank balances are changed</small></span></span><button type="button" onClick={() => { setTestWeekActive(false); setStatusFilter(defaultBoardStatus(data.games, clock, !data.weekOpenTime || new Date(data.weekOpenTime).getTime() <= clock)); setStatusFilterTouched(false); }}><X size={16} /> Exit</button></div>}

      {tab === "picks" && <section className="panel picks-panel">
        {!previewActive && picksView === "board" && !weekIsOpen && data.weekOpenTime && <div className="notice-card">This week opens on <NumericText text={openText(data.weekOpenTime)} />.</div>}
        <SectionTabs items={[{ id: "board", label: "Pick Board" }, { id: "sideBets", label: "Side Bets", badge: picksNotificationCount }]} value={picksView} onChange={(value) => {
          if (value === "sideBets" && sideBetAccessDenied) {
            notify("No access to Side Bets.", "error");
            return;
          }
          setPicksView(value as PicksView);
        }} />
        {picksView === "board" && <>
          <div className="view-select-row board-filter-row">
            <MenuSelect ariaLabel="Choose game status" className="compact-select status-select" value={statusFilter} sections={[{ options: (["OPEN", "LOCKED", "FINAL"] as GameStatusFilter[]).map((option) => ({ value: option, label: option })) }]} onChange={(value) => { setStatusFilter(value as GameStatusFilter); setStatusFilterTouched(true); }} />
            <MenuSelect ariaLabel="Choose league" className="compact-select league-select" value={leagueFilter} sections={[{ options: ((appSlug === "friends-basketball" ? ["CBB", "NBA", "DOGS"] : ["CFB", "NFL", "DOGS"]) as LeagueFilter[]).map((option) => ({ value: option, label: option })) }]} onChange={(value) => setLeagueFilter(value as LeagueFilter)} />
            {leagueFilter === "CFB" && <ConferenceFilter value={conferenceFilter} onChange={setConferenceFilter} />}
            {leagueFilter === "DOGS" && <MenuSelect ariaLabel="Filter dogs by win value" className="compact-select context-select" value={dogValueFilter} sections={[{ options: [{ value: "ALL", label: "ALL DOGS" }, ...(["1", "2", "3"] as const).map((value) => ({ value, label: dogBonusText(value, pointsMode) }))] }]} onChange={(value) => setDogValueFilter(value as DogValueFilter)} />}
          </div>
          {filteredGames.length === 0 && <div className="empty-state board-empty-state">No {statusFilter.toLowerCase()} {leagueFilter === "DOGS" ? "dog" : leagueFilter} games.</div>}
          <div className="game-days">
            {gameGroups.map((group) => <div className={`game-day-group ${statusFilter === "FINAL" ? "past-day-group" : ""}`} key={group.key}>
              <div className="game-day-marker"><b>{group.shortDay}</b><strong>{group.label}</strong></div>
              <div className="game-list">{group.games.map((game) => <GameCard key={game.id} game={game} picks={cardPicks} statusFilter={statusFilter} leagueFilter={leagueFilter} weekIsOpen={weekIsOpen} now={clock} pointsMode={pointsMode} modelStars={cfbModelEdges[game.id]?.stars || 0} addPick={addPick} openPreview={setMatchupPreviewGame} />)}</div>
            </div>)}
          </div>
        </>}
        {picksView === "sideBets" && sideBetAccessDenied && <div className="notice-card" role="alert">No access to Side Bets.</div>}
        {picksView === "sideBets" && !sideBetAccessDenied && <SideBetCenter
          appSlug={appSlug}
          view={betView}
          setView={setBetView}
          currentUser={currentUser}
          profiles={profiles.filter((profile) => !isSideBetRestricted(data.groupRules, profile.id))}
          sideBets={sideBets}
          slotCounts={data.sideBetSlotCounts || {}}
          maxPerWeek={data.sideBetSettings?.maxPerWeek ?? null}
          maxAmount={data.sideBetSettings?.maxAmount ?? MAX_SIDE_BET_AMOUNT}
          manualAmount={Boolean(data.sideBetSettings?.manualAmount)}
          weekIsOpen={sideBetWeekIsOpen}
          weekConcluded={weekConcluded}
          weekOpenTime={data.sideBetWeekOpenTime ?? data.weekOpenTime}
          week={viewedWeek}
          openGames={openBetGames}
          gameLeague={betLeagueFilter}
          gameConference={betConferenceFilter}
          selectedGame={selectedBetGame}
          selectedCreatorTeam={selectedCreatorTeam}
          amount={betAmount}
          recipients={betRecipients}
          saving={savingBet}
          savingBetId={savingBetId}
          offerNotificationCount={receivedNotificationCount + sentNotificationCount}
          modelEdges={cfbModelEdges}
          setGame={(gameId) => { setBetGameId(gameId); setBetCreatorTeam(""); }}
          setGameLeague={(nextLeague) => { setBetLeagueFilter(nextLeague); setBetConferenceFilter("ALL"); setBetGameId(""); setBetCreatorTeam(""); }}
          setGameConference={(nextConference) => { setBetConferenceFilter(nextConference); setBetGameId(""); setBetCreatorTeam(""); }}
          setCreatorTeam={setBetCreatorTeam}
          setAmount={setBetAmount}
          setRecipients={setBetRecipients}
          toggleRecipient={toggleBetRecipient}
          createBet={createSideBet}
          respond={(action, sideBetId) => postSideBet({ action, sideBetId })}
          openPreview={setMatchupPreviewGame}
        />}
      </section>}

      {tab === "card" && <section className="panel card-panel">
        <SectionTabs items={[{ id: "mine", label: "My Card", badge: myCardNotificationCount }, { id: "group", label: "League Cards", badge: leagueCardsNotificationCount }]} value={cardView} onChange={(value) => setCardView(value as CardView)} />
        {cardView === "mine" && <>
          {!hideCardProgress && <CardProgress rule={rule} counts={regularCounts} hasDog={Boolean(myUnderdog)} dirty={stagedPicks !== null} />}
          <PickList
            picks={myUnderdog ? [...myRegular, myUnderdog] : myRegular}
            games={cardGames}
            title="Picks"
            pointsMode={pointsMode}
            universalLockReached={universalLockReached}
            removePick={removePick}
            openPreview={setMatchupPreviewGame}
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
              {playerPicks.length === 0 && <p className="muted group-empty-picks">No visible picks yet.</p>}
              {playerPicks.map((pick) => <VisiblePick key={pick.id} pick={pick} games={cardGames} pointsMode={pointsMode} universalLockReached={universalLockReached} openPreview={setMatchupPreviewGame} />)}
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
            <div className="bank-summary-head bank-summary-head-expandable"><span>Player</span><span>Balance</span><span aria-hidden="true" /></div>
            {bankTotals.map((row) => <BankBalanceHistoryRow
              key={row.id}
              player={row}
              weeks={viewedBankHistory}
            />)}
          </div>
          <div className="subsection bank-section bank-week-section">
            <div className="standings-heading-row">
              <h2>{previewActive ? "Test Weekly Results" : "Weekly Results"}</h2>
              {previewActive ? <span className="test-standings-label">Week 3</span> : null}
            </div>
            <BankWeekResults rows={bankWeekStandings} picks={bankResultPicks} games={bankResultGames} amounts={bankWeekAmounts} pointsMode={pointsMode} universalLockReached={universalLockReached} />
          </div>
          <div className="subsection bank-section bank-week-section"><div className="standings-heading-row side-bet-ledger-heading-row"><h2 className="heading-with-badge side-bet-ledger-heading"><span className="side-bet-ledger-heading-title">Side Bet Ledger</span><span className="side-bet-ledger-summary">{weekConcluded ? <><span className="side-bet-ledger-summary-label">{mySideBetWeekTotal < 0 ? "Loss" : "Profit"}</span><span className={mySideBetWeekTotal > 0 ? "money-pos" : mySideBetWeekTotal < 0 ? "money-neg" : "money-neutral"}><NumericText text={roundedMoney(mySideBetWeekTotal)} /></span></> : <><span className="side-bet-ledger-summary-label">Settled</span><span className={mySideBetWeekTotal > 0 ? "money-pos" : mySideBetWeekTotal < 0 ? "money-neg" : "money-neutral"}><NumericText text={roundedMoney(mySideBetWeekTotal)} /></span>{myActiveSideBetCount > 0 && <><span className="side-bet-ledger-summary-divider ui-separator-dot">·</span><span><NumericText text={`${myActiveSideBetCount} Active`} /></span><span className="side-bet-ledger-summary-divider ui-separator-dot">·</span><span className="side-bet-potential-label">Potential</span><span className="side-bet-potential-profit"><NumericText text={roundedMoney(myActivePotentialProfit)} /></span><span className="side-bet-potential-separator">/</span><span className="side-bet-potential-loss"><NumericText text={roundedMoney(-myActivePotentialLoss)} /></span></>}</>}</span><NotificationBadge count={bankNotificationCount} /></h2></div><div className="side-bet-ledger-filter-row"><div className="side-bet-ledger-scope-toggle" role="group" aria-label="Filter side bet ledger"><button type="button" className={sideBetLedgerScope === "all" ? "active" : ""} aria-pressed={sideBetLedgerScope === "all"} onClick={() => setSideBetLedgerScope("all")}>All Bets</button><button type="button" className={sideBetLedgerScope === "mine" ? "active" : ""} aria-pressed={sideBetLedgerScope === "mine"} onClick={() => setSideBetLedgerScope("mine")}>My Bets</button></div><div className="side-bet-game-filter-toggle" role="group" aria-label="Filter side bets by game status"><button type="button" className={sideBetLedgerGameFilter === "all" ? "active" : ""} aria-pressed={sideBetLedgerGameFilter === "all"} onClick={() => setSideBetLedgerGameFilter("all")}>All</button><button type="button" className={sideBetLedgerGameFilter === "upcoming" ? "active" : ""} aria-pressed={sideBetLedgerGameFilter === "upcoming"} onClick={() => setSideBetLedgerGameFilter("upcoming")}>Upcoming</button><button type="button" className={sideBetLedgerGameFilter === "completed" ? "active" : ""} aria-pressed={sideBetLedgerGameFilter === "completed"} onClick={() => setSideBetLedgerGameFilter("completed")}>Completed</button></div></div><div className="ledger-list">{!previewActive && !sideBetLedgerReady && <p className="muted">Loading side bet ledger…</p>}{(previewActive || sideBetLedgerReady) && viewedSideBetLedger.length === 0 && <p className="muted ledger-empty-state">No side bets in the ledger yet.</p>}{(previewActive || sideBetLedgerReady) && viewedSideBetLedger.map((bet) => <SideBetLedgerRow key={bet.id} bet={bet} currentUser={currentUser} />)}</div></div>
        </>}
      </section>}

      {tab === "settings" && <SettingsPanel
        appSlug={appSlug}
        currentUser={currentUser}
        leagueName={selectedLeague?.name || leagueNameForSlug(appSlug)}
        rules={displayedRules}
        loginPath={loginPath}
        onCountsChanged={updateNotificationCounts}
        selectedLeagueSlug={selectedLeague?.slug || appSlug}
        onLeagueSelect={(league) => setSelectedLeague(league.slug === appSlug ? null : league)}
      />}
    </main>
    {currentPreviewGame && (isBasketballLeague(currentPreviewGame.league)
      ? <BasketballGameDetails game={currentPreviewGame} onClose={closeMatchupPreview} />
      : isFinalGame(currentPreviewGame) || new Date(currentPreviewGame.commence_time).getTime() <= clock
      ? <GameTracker game={currentPreviewGame} appSlug={appSlug} onClose={closeMatchupPreview} />
      : currentPreviewGame.league === "NFL"
        ? <NflMatchupPreview game={currentPreviewGame} onClose={closeMatchupPreview} />
        : <MatchupPreview game={currentPreviewGame} onClose={closeMatchupPreview} showModel={(appSlug === "shaw-family" || ["friends", "friends-basketball"].includes(appSlug)) && String(currentUser.username || "").trim().toLowerCase() === "kameron"} modelGroup={appSlug} />)}
    {!previewActive && stagedPicks !== null && autosaveBlockedSignatureRef.current !== pickCardSignature(stagedPicks) && !toast && <div className="autosave-toast" role="status" aria-live="polite"><LoaderCircle size={18} /><span>Saving…</span></div>}
    {toast && <div className={`toast ${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"} aria-live="polite">{toast.tone === "success" && <CircleCheckBig className="toast-status-icon" size={18} />}<span><NumericText text={toast.message} /></span><button className="toast-close" type="button" aria-label="Dismiss message" onClick={() => setToast(null)}><X size={16} /></button></div>}
  </div>;
}
