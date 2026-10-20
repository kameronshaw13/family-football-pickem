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
  type BetView,
  type SideBetLeagueFilter,
  type SideBetBoardMarket,
  displayTeamName,
  abbreviatedTeamName,
  matchupTextVariants,
  ResponsiveText,
  SideBetResponseLine,
  ResponsiveTeamName,
  BoardTeamName,
  LiveSituationText,
  dt,
  fullDateText,
  openText,
  timeText,
  gameDayKey,
  gameDayLabel,
  gameDayShort,
  isFinalGame,
  gameConferences,
  logoForTeam,
  sideBetAmountForUser,
  sideBetTotalMatchupText,
  MatchupLogoPair,
  sideBetAppMarketReference,
  SideBetMarketReferenceText,
  TeamLogo,
} from "@/components/PickemPresentationShared";
import {
  conferenceFilterSections,
} from "@/components/PickemStandingsViews";

export function SideBetCenter({ appSlug, view, setView, currentUser, profiles, sideBets, availableFunds, reservedFunds, slotCounts, maxPerWeek, maxAmount, manualAmount, weekIsOpen, weekConcluded, weekOpenTime, week, openGames, gameLeague, gameConference, selectedGame, selectedCreatorTeam, amount, recipients, saving, savingBetId, offerNotificationCount, modelEdges, setGame, setGameLeague, setGameConference, setCreatorTeam, setAmount, setRecipients, toggleRecipient, createBet, respond, openPreview }: {
  appSlug: AppSlug;
  view: BetView;
  setView: (value: BetView) => void;
  currentUser: Profile;
  profiles: Profile[];
  sideBets: SideBet[];
  availableFunds: number | null;
  reservedFunds: number;
  slotCounts: Record<string, number>;
  maxPerWeek: number | null;
  maxAmount: number;
  manualAmount: boolean;
  weekIsOpen: boolean;
  weekConcluded: boolean;
  weekOpenTime: string | null;
  week: number;
  openGames: Game[];
  gameLeague: SideBetLeagueFilter;
  gameConference: string;
  selectedGame?: Game;
  selectedCreatorTeam: string;
  amount: string;
  recipients: string[];
  saving: boolean;
  savingBetId: string | null;
  offerNotificationCount: number;
  modelEdges: Record<string, { stars: number; edgePoints: number | null; edgeTeam: string | null }>;
  setGame: (value: string) => void;
  setGameLeague: (value: SideBetLeagueFilter) => void;
  setGameConference: (value: string) => void;
  setCreatorTeam: (value: string) => void;
  setAmount: (value: string) => void;
  setRecipients: (value: string[]) => void;
  toggleRecipient: (value: string) => void;
  createBet: (options: { marketType: SideBetMarketType; offerPhase: SideBetOfferPhase; creatorSpread: number; totalPoints?: number | null; creatorOdds: number; amount: number }) => Promise<boolean>;
  respond: (action: "accept" | "decline" | "cancel" | "clear", sideBetId: string) => Promise<boolean>;
  openPreview: (game: Game) => void;
}) {
  const [confirmingBetId, setConfirmingBetId] = useState<string | null>(null);
  const [slipExpanded, setSlipExpanded] = useState(false);
  const [slipClosing, setSlipClosing] = useState(false);
  const [marketType, setMarketType] = useState<SideBetMarketType>("spread");
  const [offerPhase, setOfferPhase] = useState<SideBetOfferPhase>("pregame");
  const [boardMarket, setBoardMarket] = useState<SideBetBoardMarket>("spreads");
  const [marketQuotes, setMarketQuotes] = useState<Record<string, SideBetMarketQuote>>({});
  const marketQuotesRef = useRef<Record<string, SideBetMarketQuote>>({});
  const marketQuoteRefreshInFlightRef = useRef(false);
  const [customSpread, setCustomSpread] = useState("");
  const [oddsInput, setOddsInput] = useState("100");
  const [customRiskMode, setCustomRiskMode] = useState(false);
  const [offerGameFilter, setOfferGameFilter] = useState<SideBetGameFilter>("all");
  const slipSheetRef = useRef<HTMLElement>(null);
  const slipSwipeStartY = useRef<number | null>(null);
  const slipCloseTimer = useRef<number | null>(null);
  const slipClosingRef = useRef(false);
  const received = sideBetsForView(sideBets, currentUser.id, "received");
  const sent = sideBetsForView(sideBets, currentUser.id, "sent");
  const offers = [...received, ...sent];
  const otherPlayers = profiles.filter((profile) => profile.id !== currentUser.id);
  const offeredTeam = selectedGame ? (selectedCreatorTeam === selectedGame.home_team ? selectedGame.away_team : selectedGame.home_team) : "";
  const selectedGameRef = useRef(selectedGame);
  selectedGameRef.current = selectedGame;
  const rawSelectedQuote = selectedGame ? marketQuotes[selectedGame.id] : undefined;
  const selectedQuote = rawSelectedQuote?.phase === offerPhase ? rawSelectedQuote : undefined;
  const selectedTotalSide: SideBetTotalSide = selectedGame && selectedCreatorTeam === selectedGame.home_team ? "under" : "over";
  const quoteSpread = selectedGame && selectedCreatorTeam && selectedQuote?.spread
    ? selectedCreatorTeam === selectedGame.away_team ? selectedQuote.spread.awayPoint : selectedQuote.spread.homePoint
    : null;
  const defaultCreatorSpread = quoteSpread ?? (selectedGame && selectedCreatorTeam ? normalizeSpreadForSelectedTeam(selectedCreatorTeam, selectedGame.current_spread_team, selectedGame.current_spread) : null);
  const quoteMoneyline = selectedGame && selectedCreatorTeam && selectedQuote?.moneyline
    ? selectedCreatorTeam === selectedGame.away_team ? selectedQuote.moneyline.awayOdds : selectedQuote.moneyline.homeOdds
    : null;
  const quoteOpponentMoneyline = selectedGame && selectedCreatorTeam && selectedQuote?.moneyline
    ? selectedCreatorTeam === selectedGame.away_team ? selectedQuote.moneyline.homeOdds : selectedQuote.moneyline.awayOdds
    : null;
  const defaultCreatorMoneyline = fairSymmetricMoneyline(quoteMoneyline, quoteOpponentMoneyline)
    ?? quoteMoneyline
    ?? fairMoneylineFromSpread(defaultCreatorSpread, selectedGame?.league);
  const parsedCustomSpread = customSpread.trim() === "" ? null : Number(customSpread);
  const creatorSpread = marketType === "spread"
    ? (parsedCustomSpread != null && Number.isFinite(parsedCustomSpread) ? parsedCustomSpread : defaultCreatorSpread)
    : 0;
  const creatorTotalPoints = marketType === "total"
    ? (parsedCustomSpread != null && Number.isFinite(parsedCustomSpread) ? parsedCustomSpread : selectedQuote?.total?.points ?? null)
    : null;
  const creatorOdds = Number(oddsInput);
  const offeredOdds = oppositeAmericanOdds(creatorOdds);
  const parsedRisk = Number(amount);
  const wagerMax = manualAmount ? MAX_CUSTOM_SIDE_BET_AMOUNT : maxAmount;
  const riskIsValid = Number.isFinite(parsedRisk) && parsedRisk > 0 && parsedRisk <= wagerMax && (availableFunds == null || Math.round(parsedRisk * 100) <= Math.round(availableFunds * 100));
  const creatorRisk = riskIsValid ? Math.round(parsedRisk * 100) / 100 : 0;
  const creatorWin = validAmericanOdds(creatorOdds) ? profitForRisk(creatorRisk, creatorOdds) : 0;
  const offeredRisk = creatorWin;
  const selectedMarketText = sideBetMarketText(marketType, marketType === "spread" ? creatorSpread : null, creatorOdds, creatorTotalPoints, marketType === "total" ? selectedTotalSide : null);
  const offeredMarketText = sideBetMarketText(marketType, marketType === "spread" ? -Number(creatorSpread || 0) : null, offeredOdds, creatorTotalPoints, marketType === "total" ? oppositeTotalSide(selectedTotalSide) : null);
  const evenPayout = Math.abs(creatorRisk - creatorWin) < 0.005;
  const amountOptions = manualAmount || maxAmount >= 40 ? ["40", "30", "20", "10"] : ["20", "15", "10", "5"];
  const selectedMatchup = selectedGame ? matchupTextVariants(selectedGame) : null;
  const selectedOfferFull = selectedGame
    ? marketType === "total"
      ? sideBetTotalMatchupText(selectedGame, selectedMarketText)
      : `${displayTeamName(selectedGame, selectedCreatorTeam)} ${selectedMarketText}`
    : "";
  const selectedOfferCompact = selectedGame
    ? marketType === "total"
      ? sideBetTotalMatchupText(selectedGame, selectedMarketText, true)
      : `${abbreviatedTeamName(selectedGame, selectedCreatorTeam)} ${selectedMarketText}`
    : "";
  const offeredOfferFull = selectedGame
    ? marketType === "total"
      ? sideBetTotalMatchupText(selectedGame, offeredMarketText)
      : `${displayTeamName(selectedGame, offeredTeam)} ${offeredMarketText}`
    : "";
  const offeredOfferCompact = selectedGame
    ? marketType === "total"
      ? sideBetTotalMatchupText(selectedGame, offeredMarketText, true)
      : `${abbreviatedTeamName(selectedGame, offeredTeam)} ${offeredMarketText}`
    : "";
  const confirmingBet = received.find((bet) => bet.id === confirmingBetId);
  const slotCount = slotCounts[currentUser.id] || 0;
  const weeklyLimit = maxPerWeek == null ? Infinity : maxPerWeek;
  const availableRecipientIds = otherPlayers
    .filter((profile) => !Number.isFinite(weeklyLimit) || (slotCounts[profile.id] || 0) < weeklyLimit)
    .map((profile) => profile.id);
  const allRecipientsSelected = availableRecipientIds.length > 0 && availableRecipientIds.every((id) => recipients.includes(id));
  const recipientGridColumns = ["friends", "friends-basketball"].includes(appSlug) ? 4 : appSlug === "shaw-family" ? 3 : 2;
  const limitReached = Number.isFinite(weeklyLimit) && slotCount >= weeklyLimit;
  const filteredOpenGames = openGames
    .filter((game) => {
      if (game.league !== gameLeague) return false;
      if (gameLeague === "CFB" && gameConference !== "ALL" && !gameConferences(game).includes(gameConference)) return false;
      if (offerPhase === "live") return game.live_state === "in";
      return new Date(game.commence_time).getTime() > Date.now() && game.live_state !== "in";
    })
    .sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
  const sideBetGameGroups = filteredOpenGames.reduce<Array<{ key: string; label: string; shortDay: string; games: Game[] }>>((groups, game) => {
    const key = gameDayKey(game.commence_time);
    const existingGroup = groups[groups.length - 1];
    if (existingGroup?.key === key) existingGroup.games.push(game);
    else groups.push({ key, label: gameDayLabel(game.commence_time), shortDay: gameDayShort(game.commence_time), games: [game] });
    return groups;
  }, []);
  const hasSlip = Boolean(selectedGame && selectedCreatorTeam);
  const hasPendingLiveOffer = offers.some((bet) => bet.status === "open" && bet.offer_phase === "live");

  const refreshMarketQuotes = useCallback(async () => {
    if (marketQuoteRefreshInFlightRef.current) return marketQuotesRef.current;
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) return marketQuotesRef.current;
    marketQuoteRefreshInFlightRef.current = true;
    try {
      const response = await fetch(`/api/side-bet-markets?week=${week}`, {
        headers: { Authorization: `Bearer ${token}`, "x-pickem-group": appSlug },
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.markets)) return marketQuotesRef.current;
      const next = Object.fromEntries((payload.markets as SideBetMarketQuote[]).map((quote) => [quote.gameId, quote]));
      marketQuotesRef.current = next;
      setMarketQuotes(next);
      return next;
    } catch {
      return marketQuotesRef.current;
    } finally {
      marketQuoteRefreshInFlightRef.current = false;
    }
  }, [appSlug, week]);

  useEffect(() => {
    if (view !== "new" && view !== "offers") return;
    const refreshVisibleMarkets = () => {
      if (document.visibilityState === "visible") void refreshMarketQuotes();
    };
    refreshVisibleMarkets();
    const interval = window.setInterval(refreshVisibleMarkets, offerPhase === "live" || hasPendingLiveOffer ? 5000 : 30000);
    window.addEventListener("focus", refreshVisibleMarkets);
    window.addEventListener("online", refreshVisibleMarkets);
    document.addEventListener("visibilitychange", refreshVisibleMarkets);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisibleMarkets);
      window.removeEventListener("online", refreshVisibleMarkets);
      document.removeEventListener("visibilitychange", refreshVisibleMarkets);
    };
  }, [view, offerPhase, hasPendingLiveOffer, refreshMarketQuotes]);

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

  useEffect(() => {
    const game = selectedGameRef.current;
    if (!game || !selectedCreatorTeam) return;
    const quote = marketQuotesRef.current[game.id];
    if (boardMarket === "total") {
      const total = quote?.total;
      setCustomSpread(total?.points == null ? "" : String(total.points));
      setMarketType("total");
      setOddsInput("100");
    } else {
      const spread = quote?.spread;
      const initialSpread = spread
        ? selectedCreatorTeam === game.away_team ? spread.awayPoint : spread.homePoint
        : normalizeSpreadForSelectedTeam(selectedCreatorTeam, game.current_spread_team, game.current_spread);
      setCustomSpread(initialSpread == null ? "" : String(initialSpread));
      setMarketType("spread");
      setOddsInput("100");
    }
    setAmount("20");
    setCustomRiskMode(false);
  }, [selectedGame?.id, selectedCreatorTeam, boardMarket, setAmount]);

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
    // Keep an already-open slip open while changing the active side. This lets
    // multi-bet tickets switch in-place instead of collapsing the editor.
    if (!slipExpanded) setSlipExpanded(false);
  }

  function clearSlip() {
    setSlipExpanded(false);
    setGame("");
    setCreatorTeam("");
    setMarketType(boardMarket === "total" ? "total" : "spread");
    setCustomSpread("");
    setOddsInput("100");
    setAmount("20");
    setCustomRiskMode(false);
  }

  function updateCustomMarketLine(value: string) {
    setCustomSpread(value);
    if (value.trim() === "") return;

    const nextLine = Number(value);
    if (!Number.isFinite(nextLine)) return;

    if (marketType === "spread") {
      const marketLine = quoteSpread ?? defaultCreatorSpread;
      if (marketLine != null) setOddsInput(String(fairAltSpreadOdds(Number(marketLine), nextLine, {
        teamMoneylineOdds: quoteMoneyline,
        opponentMoneylineOdds: quoteOpponentMoneyline,
        league: selectedGame?.league
      })));
      return;
    }

    if (marketType === "total") {
      const marketTotal = selectedQuote?.total?.points;
      if (marketTotal != null) setOddsInput(String(fairAltTotalOdds(Number(marketTotal), nextLine, selectedTotalSide)));
    }
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
    if (!validAmericanOdds(creatorOdds)) return;
    if (marketType === "spread" && creatorSpread == null) return;
    if (marketType === "total" && creatorTotalPoints == null) return;
    const sentOffer = await createBet({
      marketType,
      offerPhase,
      creatorSpread: marketType === "spread" ? Number(creatorSpread) : 0,
      totalPoints: marketType === "total" ? Number(creatorTotalPoints) : null,
      creatorOdds,
      amount: creatorRisk
    });
    if (sentOffer) {
      setCustomRiskMode(false);
      setSlipExpanded(false);
    }
  }

  async function requestAcceptBet(sideBetId: string) {
    await refreshMarketQuotes();
    setConfirmingBetId(sideBetId);
  }

  async function acceptConfirmedBet() {
    if (!confirmingBetId) return;
    await refreshMarketQuotes();
    const accepted = await respond("accept", confirmingBetId);
    if (accepted) setConfirmingBetId(null);
  }

  return <div className={`side-bet-center ${view === "new" && hasSlip ? "has-bet-slip" : ""}`.trim()}>
    {availableFunds != null && <div className="side-bet-bank-available" aria-label="Bank funds available for side bets">
      <span className="side-bet-bank-amount"><span>Available</span><strong><NumericText text={stakeMoney(availableFunds)} /></strong></span>
      <span className="side-bet-bank-separator" aria-hidden="true">·</span>
      <span className="side-bet-bank-amount"><span>Pending</span><strong><NumericText text={stakeMoney(reservedFunds)} /></strong></span>
    </div>}
    <div className={`view-select-row side-bet-filter-row ${view === "new" && weekIsOpen && !weekConcluded ? "make-offer" : ""}`.trim()}>
      <MenuSelect ariaLabel="Choose side bet view" className="compact-select" value={view} sections={[{ options: [{ value: "offers", label: "Offers", badge: offerNotificationCount }, { value: "new", label: "Make Offer" }] }]} onChange={(value) => {
        setSlipExpanded(false);
        if (value === "new") {
          setOfferPhase("pregame");
          setBoardMarket("spreads");
          setMarketType("spread");
          setGame("");
          setCreatorTeam("");
        }
        setView(value as BetView);
        
      }} />
      {view === "offers" && <div className="side-bet-game-filter-toggle side-bet-offers-game-filter" role="group" aria-label="Filter offers by game status"><button type="button" className={offerGameFilter === "all" ? "active" : ""} aria-pressed={offerGameFilter === "all"} onClick={() => setOfferGameFilter("all")}>All</button><button type="button" className={offerGameFilter === "upcoming" ? "active" : ""} aria-pressed={offerGameFilter === "upcoming"} onClick={() => setOfferGameFilter("upcoming")}>Upcoming</button><button type="button" className={offerGameFilter === "completed" ? "active" : ""} aria-pressed={offerGameFilter === "completed"} onClick={() => setOfferGameFilter("completed")}>Completed</button></div>}
      {view === "new" && weekIsOpen && !weekConcluded && <MenuSelect
        ariaLabel="Filter side bet games by league"
        className="compact-select"
        value={gameLeague}
        sections={[{ options: (appSlug === "friends-basketball" ? ["CBB", "NBA"] : ["CFB", "NFL"]).map((league) => ({ value: league, label: league })) }]}
        onChange={(value) => { setSlipExpanded(false); setGameLeague(value as SideBetLeagueFilter); }}
      />}
      {view === "new" && weekIsOpen && !weekConcluded && gameLeague === "CFB" && <MenuSelect
        ariaLabel="Filter side bet games by conference"
        className="compact-select context-select"
        value={gameConference}
        sections={conferenceFilterSections("ALL CONF.")}
        onChange={(value) => { setSlipExpanded(false); setGameConference(value); }}
      />}
    </div>

    {view === "new" && weekIsOpen && !weekConcluded && <div className="side-bet-offer-mode-row">
      <div className="side-bet-game-filter-toggle side-bet-two-option-toggle" role="group" aria-label="Choose pregame or live games">
        <button type="button" className={offerPhase === "pregame" ? "active" : ""} aria-pressed={offerPhase === "pregame"} onClick={() => { clearSlip(); setOfferPhase("pregame"); }}>Pregame</button>
        <button type="button" className={offerPhase === "live" ? "active" : ""} aria-pressed={offerPhase === "live"} onClick={() => { clearSlip(); setOfferPhase("live"); }}>Live</button>
      </div>
      <div className="side-bet-game-filter-toggle side-bet-two-option-toggle" role="group" aria-label="Choose spreads or over under">
        <button type="button" className={boardMarket === "spreads" ? "active" : ""} aria-pressed={boardMarket === "spreads"} onClick={() => { clearSlip(); setBoardMarket("spreads"); setMarketType("spread"); }}>Spreads</button>
        <button type="button" className={boardMarket === "total" ? "active" : ""} aria-pressed={boardMarket === "total"} onClick={() => { clearSlip(); setBoardMarket("total"); setMarketType("total"); }}>O/U</button>
      </div>
    </div>}

    {view === "new" && weekConcluded && <div className="side-bet-sportsbook-board"><div className="empty-state side-bet-empty-state">This week has concluded.</div></div>}

    {view === "new" && !weekConcluded && !weekIsOpen && <div className="side-bet-sportsbook-board"><div className="empty-state side-bet-empty-state">{weekOpenTime ? <>This week opens on <NumericText text={openText(weekOpenTime)} />.</> : "This week is not open yet."}</div></div>}

    {view === "new" && !weekConcluded && weekIsOpen && <div className="side-bet-sportsbook-board">
      {limitReached && <div className="empty-state side-bet-empty-state"><NumericText text={`Your ${weeklyLimit} side bet slots are accepted or pending this week.`} /></div>}
      {!limitReached && openGames.length === 0 && <div className="empty-state side-bet-empty-state">No games are available.</div>}
      {!limitReached && openGames.length > 0 && filteredOpenGames.length === 0 && <div className="empty-state side-bet-empty-state">{offerPhase === "live" ? "No live games have this market available right now." : "No pregame markets are available."}</div>}
      {!limitReached && filteredOpenGames.length > 0 && <div className="game-days side-bet-game-days">{sideBetGameGroups.map((group) => <section key={group.key} className="game-day-section">
        <div className="game-day-marker"><b>{group.shortDay}</b><strong>{group.label}</strong></div>
        <div className="game-list">{group.games.map((game) => <SideBetGameCard
          key={game.id}
          game={game}
          market={marketQuotes[game.id]?.phase === offerPhase ? marketQuotes[game.id] : undefined}
          boardMarket={boardMarket}
          selectedTeam={selectedGame?.id === game.id ? selectedCreatorTeam : ""}
          modelStars={modelEdges[game.id]?.stars || 0}
          disabled={!weekIsOpen || (() => {
            const quote = marketQuotes[game.id]?.phase === offerPhase ? marketQuotes[game.id] : undefined;
            return boardMarket === "total"
              ? !quote?.total || quote.total.suspended
              : !quote?.spread || quote.spread.suspended;
          })()}
          onSelect={selectSide}
          openPreview={openPreview}
        />)}</div>
      </section>)}</div>}
    </div>}

    {view === "new" && !weekConcluded && selectedGame && selectedCreatorTeam && !slipExpanded && <button className="side-bet-slip-bar" type="button" aria-expanded="false" onClick={() => setSlipExpanded(true)}>
      {marketType === "total" ? <MatchupLogoPair game={selectedGame} /> : <TeamLogo url={logoForTeam(selectedGame, selectedCreatorTeam)} name={selectedCreatorTeam} />}
      <span className="side-bet-slip-copy">{marketType === "total"
        ? <ResponsiveText full={selectedOfferFull} compact={selectedOfferCompact} />
        : <><ResponsiveTeamName game={selectedGame} team={selectedCreatorTeam} className="team-name" /><span className="team-spread"><NumericText text={selectedMarketText} /></span></>}</span>
      <span className="side-bet-slip-open"><ChevronUp size={17} /></span>
    </button>}

    {view === "new" && !weekConcluded && selectedGame && selectedCreatorTeam && slipExpanded && <section ref={slipSheetRef} className={`side-bet-slip-sheet ${slipClosing ? "closing" : ""}`.trim()} role="dialog" aria-labelledby="side-bet-slip-title">
        <div className="side-bet-slip-sheet-head" onPointerDown={beginSlipSwipe} onPointerMove={continueSlipSwipe} onPointerUp={endSlipSwipe} onPointerCancel={endSlipSwipe}>
          <div className="side-bet-slip-title"><h2 id="side-bet-slip-title">{selectedMatchup && <ResponsiveText full={selectedMatchup.full} intermediate={selectedMatchup.intermediate} compact={selectedMatchup.compact} />}</h2><p><NumericText text={`${fullDateText(selectedGame.commence_time)} · ${timeText(selectedGame.commence_time)}`} /></p></div>
          <button type="button" className="slip-icon-btn side-bet-header-collapse" aria-label="Collapse bet slip" onPointerDown={(event) => event.stopPropagation()} onClick={collapseSlip}><ChevronDown size={18} /></button>
        </div>

        <div className="side-bet-slip-scroll">
        <div className="team-row side-bet-slip-selection">
          {marketType === "total" ? <MatchupLogoPair game={selectedGame} /> : <TeamLogo url={logoForTeam(selectedGame, selectedCreatorTeam)} name={selectedCreatorTeam} />}
          <span className="side-bet-slip-team-choice">{marketType === "total"
            ? <ResponsiveText full={selectedOfferFull} compact={selectedOfferCompact} />
            : <><ResponsiveTeamName game={selectedGame} team={selectedCreatorTeam} className="team-name" /><span className="team-spread"><NumericText text={selectedMarketText} /></span></>}</span>
          <button type="button" className="slip-icon-btn side-bet-selection-clear" aria-label="Clear selected team" onClick={clearSlip}><X size={18} /></button>
        </div>

        <section className="side-bet-slip-section side-bet-market-section">
          <div className="side-bet-slip-section-head"><span>Market</span></div>
          {boardMarket === "spreads" && <div className="side-bet-market-toggle" role="group" aria-label="Side bet market">
            <button type="button" className={marketType === "spread" ? "active" : ""} aria-pressed={marketType === "spread"} onClick={() => {
              const quote = selectedGame ? marketQuotesRef.current[selectedGame.id]?.spread : null;
              const nextSpread = selectedGame && selectedCreatorTeam && quote
                ? selectedCreatorTeam === selectedGame.away_team ? quote.awayPoint : quote.homePoint
                : defaultCreatorSpread;
              setMarketType("spread");
              setCustomSpread(nextSpread == null ? "" : String(nextSpread));
              setOddsInput("100");
              setAmount("20");
              setCustomRiskMode(false);
            }}>Spread</button>
            <button type="button" className={marketType === "moneyline" ? "active" : ""} aria-pressed={marketType === "moneyline"} onClick={() => {
              setMarketType("moneyline");
              setOddsInput(String(defaultCreatorMoneyline));
              setCustomRiskMode(false);
              setAmount("20");
            }}>Moneyline</button>
          </div>}
          <div className="side-bet-market-fields">
            {marketType === "spread" && <label><span>Spread</span><input className="side-bet-spread-input" type="number" step="0.5" value={customSpread} onChange={(event) => updateCustomMarketLine(event.target.value)} /></label>}
            {marketType === "total" && <label><span>Total</span><input className="side-bet-spread-input" type="number" step="0.5" value={customSpread} onChange={(event) => updateCustomMarketLine(event.target.value)} /></label>}
            <label><span>American odds</span><input className="side-bet-odds-input" type="number" step="1" value={oddsInput} onChange={(event) => setOddsInput(event.target.value)} /></label>
          </div>
          {!validAmericanOdds(creatorOdds) && <p className="side-bet-field-error">Use odds of -100 or lower, or +100 or higher.</p>}
        </section>

        <section className="side-bet-slip-section">
          <div className="side-bet-slip-section-head"><span>Risk</span></div>
          <div className="side-bet-amount-grid">{amountOptions.map((value) => <button type="button" key={value} className={!customRiskMode && amount === value ? "active" : ""} aria-pressed={!customRiskMode && amount === value} onClick={() => { setCustomRiskMode(false); setAmount(value); }}><NumericText text={stakeMoney(Number(value))} /></button>)}</div>
          {manualAmount && <label className="side-bet-risk-field"><span>Custom risk</span><div><span>$</span><input className="side-bet-risk-input" type="text" inputMode="decimal" autoComplete="off" value={amount} onFocus={() => setCustomRiskMode(true)} onChange={(event) => { setCustomRiskMode(true); setAmount(normalizeRiskInput(event.target.value)); }} onBlur={() => {
            const value = Number(amount);
            if (Number.isFinite(value) && value > 0) setAmount(String(Math.min(wagerMax, Math.round(value * 100) / 100)));
          }} /></div></label>}
          {manualAmount && amount !== "" && !riskIsValid && <p className="side-bet-field-error">{availableFunds != null && Number(amount) > availableFunds ? `Only $${availableFunds.toFixed(2)} is available after outstanding bets.` : "Enter a valid risk amount."}</p>}
          {!evenPayout && <div className="side-bet-payout-preview">
            <span>You risk <strong><NumericText text={stakeMoney(creatorRisk)} /></strong> to win <strong><NumericText text={stakeMoney(creatorWin)} /></strong></span>
            <span>They risk <strong><NumericText text={stakeMoney(offeredRisk)} /></strong> to win <strong><NumericText text={stakeMoney(creatorRisk)} /></strong></span>
          </div>}
        </section>

        <section className="side-bet-slip-section">
          <div className="side-bet-slip-section-head"><span>Send to</span></div>
          <fieldset aria-label="Send side bet to"><div className="side-bet-recipient-grid" style={{ gridTemplateColumns: `repeat(${recipientGridColumns}, minmax(0, 1fr))` }}>
            <label className={`${allRecipientsSelected ? "checked" : ""} ${availableRecipientIds.length === 0 ? "disabled" : ""}`.trim()}><input type="checkbox" aria-label="All recipients" disabled={availableRecipientIds.length === 0} checked={allRecipientsSelected} onChange={() => setRecipients(allRecipientsSelected ? [] : availableRecipientIds)} /><span>All</span></label>
            {otherPlayers.map((profile) => {
              const recipientFull = Number.isFinite(weeklyLimit) && (slotCounts[profile.id] || 0) >= weeklyLimit;
              return <label key={profile.id} className={`${recipients.includes(profile.id) ? "checked" : ""} ${recipientFull ? "disabled" : ""}`.trim()}><input type="checkbox" aria-label={profile.display_name} disabled={recipientFull} checked={recipients.includes(profile.id)} onChange={() => toggleRecipient(profile.id)} /><span>{profile.display_name}</span></label>;
            })}
          </div></fieldset>
        </section>

        <div className="side-bet-slip-summary">
          <div><span>You keep</span><strong><ResponsiveText full={selectedOfferFull} compact={selectedOfferCompact} /></strong></div>
          <div><span>They get</span><strong><ResponsiveText full={offeredOfferFull} compact={offeredOfferCompact} /></strong></div>
        </div>
        <button className="btn accent side-bet-slip-submit" type="button" disabled={!weekIsOpen || saving || !riskIsValid || !recipients.length || !validAmericanOdds(creatorOdds) || (marketType === "spread" && creatorSpread == null) || (marketType === "total" && creatorTotalPoints == null)} onClick={() => void sendOffer()}><Send size={15} /> {saving ? "Sending…" : "Send offer"}</button>
        </div>
      </section>}

    {view === "offers" && <SideBetList bets={offers.filter((bet) => sideBetMatchesGameFilter(bet, offerGameFilter))} currentUser={currentUser} marketQuotes={marketQuotes} empty={weekConcluded ? "No side bet history yet." : !weekIsOpen ? "This week is not open yet." : "No side bet offers yet."} historyOnly={weekConcluded} saving={saving} savingBetId={savingBetId} canAccept={(bet) => !weekConcluded && weekIsOpen && hasAvailableSideBetSlot(sideBets, currentUser.id, bet.week, weeklyLimit, bet.id) && (availableFunds == null || Math.round(sideBetCreatorProfit(bet) * 100) <= Math.round(availableFunds * 100))} acceptDisabledText={weekConcluded ? "Week concluded" : !weekIsOpen ? "Not open yet" : availableFunds != null ? "Insufficient funds" : "Limit reached"} requestAccept={requestAcceptBet} respond={respond} />}

    {confirmingBet && <div className="confirmation-backdrop" onClick={(event) => { if (event.target === event.currentTarget && !saving) setConfirmingBetId(null); }}>
      <section className="confirmation-sheet" role="dialog" aria-modal="true" aria-labelledby="accept-bet-title" onClick={(event) => event.stopPropagation()}>
        <div className="confirmation-icon"><CircleDollarSign size={22} /></div>
        <div className="confirmation-heading"><span>Review side bet</span><h2 id="accept-bet-title">{Math.abs(sideBetRiskForUser(confirmingBet, currentUser.id) - sideBetProfitForUser(confirmingBet, currentUser.id)) < 0.005
          ? <>Risk <NumericText text={stakeMoney(sideBetRiskForUser(confirmingBet, currentUser.id))} />?</>
          : <>Risk <NumericText text={stakeMoney(sideBetRiskForUser(confirmingBet, currentUser.id))} /> to win <NumericText text={stakeMoney(sideBetProfitForUser(confirmingBet, currentUser.id))} />?</>}</h2></div>
        <div className="confirmation-matchup">
          <div><span>You take</span><strong>{confirmingBet.game && confirmingBet.market_type === "total"
            ? <ResponsiveText full={sideBetTotalMatchupText(confirmingBet.game, sideBetLineText(confirmingBet, confirmingBet.offered_team))} compact={sideBetTotalMatchupText(confirmingBet.game, sideBetLineText(confirmingBet, confirmingBet.offered_team), true)} />
            : confirmingBet.game ? <ResponsiveText full={`${displayTeamName(confirmingBet.game, confirmingBet.offered_team)} ${sideBetLineText(confirmingBet, confirmingBet.offered_team)}`} compact={`${abbreviatedTeamName(confirmingBet.game, confirmingBet.offered_team)} ${sideBetLineText(confirmingBet, confirmingBet.offered_team)}`} /> : <>{confirmingBet.offered_team} <NumericText text={sideBetLineText(confirmingBet, confirmingBet.offered_team)} /></>}</strong>{confirmingBet.game && confirmingBet.market_type === "total" ? <MatchupLogoPair game={confirmingBet.game} className="side-bet-review-logo-pair" /> : <TeamLogo className="side-bet-review-logo" url={confirmingBet.game ? logoForTeam(confirmingBet.game, confirmingBet.offered_team) : null} name={confirmingBet.offered_team} />}</div>
          <div><span>{confirmingBet.creator?.display_name || "Opponent"} keeps</span><strong>{confirmingBet.game && confirmingBet.market_type === "total"
            ? <ResponsiveText full={sideBetTotalMatchupText(confirmingBet.game, sideBetLineText(confirmingBet, confirmingBet.creator_team))} compact={sideBetTotalMatchupText(confirmingBet.game, sideBetLineText(confirmingBet, confirmingBet.creator_team), true)} />
            : confirmingBet.game ? <ResponsiveText full={`${displayTeamName(confirmingBet.game, confirmingBet.creator_team)} ${sideBetLineText(confirmingBet, confirmingBet.creator_team)}`} compact={`${abbreviatedTeamName(confirmingBet.game, confirmingBet.creator_team)} ${sideBetLineText(confirmingBet, confirmingBet.creator_team)}`} /> : <>{confirmingBet.creator_team} <NumericText text={sideBetLineText(confirmingBet, confirmingBet.creator_team)} /></>}</strong>{confirmingBet.game && confirmingBet.market_type === "total" ? <MatchupLogoPair game={confirmingBet.game} className="side-bet-review-logo-pair" /> : <TeamLogo className="side-bet-review-logo" url={confirmingBet.game ? logoForTeam(confirmingBet.game, confirmingBet.creator_team) : null} name={confirmingBet.creator_team} />}</div>
        </div>
        {sideBetAppMarketReference(confirmingBet, confirmingBet.offered_team, confirmingBet.game ? marketQuotes[confirmingBet.game.id] : null) && <p className="confirmation-market-line"><SideBetMarketReferenceText text={sideBetAppMarketReference(confirmingBet, confirmingBet.offered_team, confirmingBet.game ? marketQuotes[confirmingBet.game.id] : null)!.text} /></p>}
        {confirmingBet.game && <p className="confirmation-kickoff"><NumericText text={`${matchupTextVariants(confirmingBet.game).full} · ${openText(confirmingBet.game.commence_time)}`} /></p>}
        <div className="confirmation-actions"><button className="btn secondary" disabled={saving} onClick={() => setConfirmingBetId(null)}>Cancel</button><button className="btn accept" disabled={saving} onClick={acceptConfirmedBet}><Check size={16} /> {saving ? "Accepting…" : "Accept bet"}</button></div>
      </section>
    </div>}
  </div>;
}

export function SideBetGameCard({ game, market, boardMarket, selectedTeam, disabled, modelStars = 0, onSelect, openPreview }: { game: Game; market?: SideBetMarketQuote; boardMarket: SideBetBoardMarket; selectedTeam: string; disabled: boolean; modelStars?: number; onSelect: (game: Game, team: string) => void; openPreview: (game: Game) => void }) {
  const lineFor = (team: string) => {
    if (boardMarket === "total") {
      if (!market?.total) return "—";
      return `${team === game.away_team ? "O" : "U"} ${market.total.points}`;
    }
    if (!market?.spread) return "—";
    return spreadText(team === game.away_team ? market.spread.awayPoint : market.spread.homePoint);
  };
  const live = game.live_state === "in";
  return <article className={`game-card matchup-card side-bet-game-card ${disabled ? "closed" : ""} ${selectedTeam ? "selected" : ""}`.trim()}>
    <div className="game-head compact-game-head">
      <div className="game-time-group"><span className={live ? "game-live-status" : "game-time"}><NumericText text={live ? game.live_status || "Live" : timeText(game.commence_time)} /></span></div>
      {live && <div className="side-bet-live-actions">{game.live_situation && <span className="side-bet-live-situation"><LiveSituationText game={game} /></span>}<button type="button" className="matchup-preview-trigger game-tracker-trigger" onClick={() => openPreview(game)}>GameTracker</button></div>}
      {!live && <div className="matchup-preview-actions">{modelStars > 0 && game.league === "CFB" && <span className="board-model-stars" aria-label={`${modelStars} model edge star${modelStars === 1 ? "" : "s"}`}>{"★".repeat(modelStars)}</span>}<button type="button" className="matchup-preview-trigger side-bet-matchup-preview-trigger" onClick={() => openPreview(game)}>Matchup Preview</button></div>}
    </div>
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
        <span className="side-bet-live-team-name"><BoardTeamName game={game} team={team} />{live && <strong className="side-bet-live-score"><NumericText text={team === game.away_team ? game.live_away_score ?? "—" : game.live_home_score ?? "—"} /></strong>}</span>
        <span className={`team-spread ${boardMarket === "total" ? "side-bet-total-market" : ""}`.trim()}>{boardMarket === "total" && market?.total
          ? <><span className="side-bet-total-side">{team === game.away_team ? "O" : "U"}</span><NumericText text={market.total.points} /></>
          : boardMarket === "spreads" && market?.spread ? <NumericText text={lineFor(team)} /> : null}</span>
      </button>)}
    </div>
  </article>;
}

export function SideBetList({ bets, currentUser, marketQuotes, empty, historyOnly = false, saving, savingBetId, canAccept, acceptDisabledText, requestAccept, respond }: { bets: SideBet[]; currentUser: Profile; marketQuotes: Record<string, SideBetMarketQuote>; empty: string; historyOnly?: boolean; saving: boolean; savingBetId: string | null; canAccept: (bet: SideBet) => boolean; acceptDisabledText: string; requestAccept: (sideBetId: string) => void; respond: (action: "accept" | "decline" | "cancel" | "clear", sideBetId: string) => Promise<boolean> }) {
  const modeFor = (bet: SideBet) => bet.creator_id === currentUser.id ? "sent" as const : "received" as const;
  const pending = sortSideBetsGroupedByGame(
    bets.filter((bet) => sideBetOfferIsPending(bet, currentUser.id, modeFor(bet)))
  );
  const history = sortSideBetsGroupedByGame(
    bets.filter((bet) => !sideBetOfferIsPending(bet, currentUser.id, modeFor(bet)))
  );
  const card = (bet: SideBet) => <SideBetCard key={bet.id} bet={bet} mode={modeFor(bet)} currentUser={currentUser} marketQuote={marketQuotes[bet.game_id]} saving={saving} working={savingBetId === bet.id} canAccept={canAccept(bet)} acceptDisabledText={acceptDisabledText} requestAccept={requestAccept} respond={respond} />;

  if (!bets.length) return <div className="side-bet-list"><div className="empty-state">{empty}</div></div>;
  return <div className="side-bet-list grouped">
    {!historyOnly && <section className="side-bet-list-section" aria-labelledby="pending-offers-title">
      <h3 id="pending-offers-title">Pending Offers</h3>
      <div className="side-bet-list-section-body">{pending.length ? pending.map(card) : <p className="muted side-bet-list-empty">No pending offers.</p>}</div>
    </section>}
    <section className="side-bet-list-section" aria-labelledby="offer-history-title">
      <h3 id="offer-history-title">Offer History</h3>
      <div className="side-bet-list-section-body">{history.length ? history.map(card) : <p className="muted side-bet-list-empty">No offer history yet.</p>}</div>
    </section>
  </div>;
}

export function SideBetCard({ bet, mode, currentUser, marketQuote, saving, working, canAccept, acceptDisabledText, requestAccept, respond }: { bet: SideBet; mode: "received" | "sent"; currentUser: Profile; marketQuote?: SideBetMarketQuote; saving: boolean; working: boolean; canAccept: boolean; acceptDisabledText: string; requestAccept: (sideBetId: string) => void; respond: (action: "accept" | "decline" | "cancel" | "clear", sideBetId: string) => Promise<boolean> }) {
  const game = bet.game;
  const target = bet.targets?.find((row) => row.recipient_id === currentUser.id);
  const offerOpen = bet.status === "open" && (mode === "sent" || target?.response === "pending") && Boolean(game && (bet.offer_phase === "live" ? !isFinalGame(game) : new Date(game.commence_time) > new Date()));
  const perspective = sideBetPerspective(bet, mode);
  const perspectiveTeam = perspective.team;
  const perspectiveSpread = perspective.spread;
  const offeredSideName = game
    ? bet.market_type === "total"
      ? `${displayTeamName(game, game.away_team)} at ${displayTeamName(game, game.home_team)}`
      : displayTeamName(game, bet.offered_team)
    : bet.offered_team;
  const offeredSideCompact = game
    ? bet.market_type === "total"
      ? `${abbreviatedTeamName(game, game.away_team)} at ${abbreviatedTeamName(game, game.home_team)}`
      : abbreviatedTeamName(game, bet.offered_team)
    : bet.offered_team;
  const perspectiveMarket = sideBetLineText(bet, perspectiveTeam);
  const matchup = game
    ? bet.market_type === "total"
      ? {
          full: sideBetTotalMatchupText(game, perspectiveMarket),
          intermediate: undefined,
          compact: sideBetTotalMatchupText(game, perspectiveMarket, true)
        }
      : bet.market_type === "moneyline"
        ? matchupTextVariants(game, { spreadTeam: perspectiveTeam, marketText: perspectiveMarket })
        : matchupTextVariants(game, { spreadTeam: perspectiveTeam, spread: perspectiveSpread, suffix: sideBetOddsSuffix(bet, perspectiveTeam) })
    : { full: `${perspectiveTeam} ${perspectiveMarket}`, intermediate: undefined, compact: `${perspectiveTeam} ${perspectiveMarket}` };
  const responseSummary = sideBetResponseSummary(bet, currentUser.id, mode);
  const responseSpread = sideBetLineText(bet, bet.offered_team);
  const amountDisplay = sideBetAmountForUser(bet, currentUser.id);
  const marketReference = offerOpen ? sideBetAppMarketReference(bet, perspectiveTeam, marketQuote) : null;
  const canClearOffer = mode === "received"
    ? target?.response === "declined" || ["cancelled", "expired"].includes(bet.status)
    : ["declined", "cancelled", "expired"].includes(bet.status);

  const hasActionRow = offerOpen || canClearOffer;

  return <article className={`side-bet-card mode-${mode} ${offerOpen ? "open" : ""} ${hasActionRow ? "has-actions" : ""} ${saving && !working ? "background-busy" : ""}`.trim()}>
    <div className="side-bet-offer-row">
      <TeamLogo url={game ? logoForTeam(game, perspectiveTeam) : null} name={perspectiveTeam} />
      <div className="side-bet-offer-copy"><strong><ResponsiveText full={matchup.full} intermediate={matchup.intermediate} compact={matchup.compact} /></strong>{marketReference && <span className="side-bet-market-reference"><SideBetMarketReferenceText text={marketReference.text} /></span>}<SideBetResponseLine summary={responseSummary} teamFull={offeredSideName} teamCompact={offeredSideCompact} spread={responseSpread} date={game ? dt(game.commence_time) : undefined} /></div>
      {amountDisplay.settled || amountDisplay.evenPayout
        ? <strong className={`side-bet-offer-amount ${amountDisplay.tone}`}><NumericText text={amountDisplay.text} /></strong>
        : <div className="side-bet-offer-amount side-bet-offer-payout" aria-label={`Risk ${amountDisplay.risk} to win ${amountDisplay.win}`}>
            <span><small>Risk</small><strong><NumericText text={amountDisplay.risk} /></strong></span>
            <span><small>Win</small><strong><NumericText text={amountDisplay.win} /></strong></span>
          </div>}
    </div>
    {mode === "received" && offerOpen && <div className="actions"><button className={`btn accept ${working ? "working" : ""}`} disabled={saving || !canAccept} onClick={() => requestAccept(bet.id)}><Check size={15} /> {canAccept ? "Review & accept" : <NumericText text={acceptDisabledText} />}</button><button className={`btn secondary ${working ? "working" : ""}`} disabled={saving} onClick={() => respond("decline", bet.id)}><X size={15} /> Decline</button></div>}
    {mode === "sent" && bet.status === "open" && <div className="actions"><button className={`btn secondary ${working ? "working" : ""}`} disabled={saving} onClick={() => respond("cancel", bet.id)}><X size={15} /> Cancel offer</button></div>}
    {canClearOffer && <div className="actions clear-offer-actions"><button className={`btn secondary ${working ? "working" : ""}`} disabled={saving} onClick={() => respond("clear", bet.id)}><Trash2 size={14} /> Clear</button></div>}
  </article>;
}

export function SideBetLedgerRow({ bet, currentUser }: { bet: SideBet; currentUser: Profile }) {
  const game = bet.game;
  const creator = sideBetBettorForTeam(bet, bet.creator_team);
  const acceptor = sideBetBettorForTeam(bet, bet.offered_team);
  const displayPerson = (person: { id: string; name: string }) => person.id === currentUser.id ? "You" : person.name;
  const perspective = sideBetLedgerPerspective(bet, currentUser.id);
  const settledWinnerTeam = bet.status === "settled" && bet.winner_id
    ? bet.winner_id === bet.creator_id
      ? bet.creator_team
      : bet.winner_id === bet.accepted_by
        ? bet.offered_team
        : null
    : null;
  const displayTeam = settledWinnerTeam || perspective.team;
  const displaySpread = Number(displayTeam === bet.creator_team ? bet.creator_spread : bet.offered_spread);
  const awayTeam = game?.away_team || bet.offered_team;
  const homeTeam = game?.home_team || bet.creator_team;
  const market = sideBetLineText(bet, displayTeam);
  const matchup = game
    ? bet.market_type === "total"
      ? {
          full: sideBetTotalMatchupText(game, market),
          intermediate: undefined,
          compact: sideBetTotalMatchupText(game, market, true)
        }
      : bet.market_type === "moneyline"
        ? matchupTextVariants(game, { spreadTeam: displayTeam, marketText: market })
        : matchupTextVariants(game, { spreadTeam: displayTeam, spread: displaySpread, suffix: sideBetOddsSuffix(bet, displayTeam) })
    : { full: `${displayTeam} ${market} vs ${displayTeam === bet.creator_team ? bet.offered_team : bet.creator_team}`, intermediate: undefined, compact: `${displayTeam} ${market} vs ${displayTeam === bet.creator_team ? bet.offered_team : bet.creator_team}` };
  const winner = bet.winner_id === creator.id ? creator : bet.winner_id === acceptor.id ? acceptor : null;
  const status = bet.status === "accepted"
    ? ""
    : bet.result === "push"
      ? "Push"
      : winner
        ? perspective.involvesUser
          ? winner.id === currentUser.id ? "You Won" : "You Lost"
          : `${winner.name} Won`
        : "Settled";
  const statusTone = bet.status === "settled" && winner && perspective.involvesUser
    ? winner.id === currentUser.id ? "ledger-result-win" : "ledger-result-loss"
    : "";
  const bettors = `${displayPerson(sideBetBettorForTeam(bet, awayTeam))} vs ${displayPerson(sideBetBettorForTeam(bet, homeTeam))}`;
  const amountDisplay = perspective.involvesUser ? sideBetAmountForUser(bet, currentUser.id) : { settled: true, text: stakeMoney(Number(bet.amount)), risk: "", win: "", evenPayout: true, tone: "money-neutral" };
  return <div className={`ledger-row side-bet-ledger-row ${bet.status === "accepted" ? "accepted" : ""}`}>
    <TeamLogo url={game ? logoForTeam(game, displayTeam) : null} name={displayTeam} />
    <div className="side-bet-ledger-copy"><strong className="side-bet-ledger-title"><ResponsiveText full={matchup.full} intermediate={matchup.intermediate} compact={matchup.compact} className="side-bet-ledger-matchup" /></strong><p className="side-bet-ledger-meta"><span>{bettors}</span>{bet.status !== "settled" && game?.commence_time ? <><span className="side-bet-ledger-meta-dot ui-separator-dot">·</span><span className="side-bet-ledger-date"><NumericText text={dt(game.commence_time)} /></span></> : null}{status ? <><span className="side-bet-ledger-meta-dot ui-separator-dot">·</span><span className={statusTone}>{status}</span></> : null}</p></div>
    {amountDisplay.settled || amountDisplay.evenPayout
      ? <strong className={`side-bet-ledger-amount ${amountDisplay.tone}`}><NumericText text={amountDisplay.text} /></strong>
      : <div className="side-bet-ledger-amount side-bet-offer-payout" aria-label={`Risk ${amountDisplay.risk} to win ${amountDisplay.win}`}>
          <span><small>Risk</small><strong><NumericText text={amountDisplay.risk} /></strong></span>
          <span><small>Win</small><strong><NumericText text={amountDisplay.win} /></strong></span>
        </div>}
  </div>;
}

