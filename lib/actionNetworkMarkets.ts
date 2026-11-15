import { fetchEspnBasketballMarkets } from "./espnBasketballMarkets";
import { actionV2MarketRows, type V2MarketGame } from "./actionNetworkV2";
import { normalizeVerifiedMarketSpread } from "./marketSpread";
import { isFreshMarketTimestamp } from "./marketFreshness.ts";
import { officialNflWeek } from "@/lib/cfbMatchupData";
import type { Game, SideBetMarketQuote, SideBetOfferPhase } from "@/lib/types";

const ACTION_BASE = "https://api.actionnetwork.com/web/v1/scoreboard";
const ACTION_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const DRAFTKINGS_BOOK_ID = 1533; // DK Kansas, verified against Action Network /web/v1/books
const ACTION_BOOK_IDS = [DRAFTKINGS_BOOK_ID];
const LIVE_MAX_AGE_SECONDS = 45;
const ACTION_CACHE_MS = 5_000;
const actionLeagueRequestCache = new Map<string, { expiresAt: number; promise: Promise<ActionGame[]> }>();

type ActionTeam = {
  id?: number | string;
  full_name?: string;
  display_name?: string;
  short_name?: string;
  name?: string;
  abbr?: string;
};

type ActionOddsRow = {
  book_id?: number;
  type?: string;
  inserted?: string;
  ml_home?: number | string | null;
  ml_away?: number | string | null;
  spread_home?: number | string | null;
  spread_away?: number | string | null;
  spread_home_line?: number | string | null;
  spread_away_line?: number | string | null;
  total?: number | string | null;
  over?: number | string | null;
  under?: number | string | null;
  line_status?: Record<strin¶»§q«^