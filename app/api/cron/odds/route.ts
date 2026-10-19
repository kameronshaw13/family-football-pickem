import { refreshBasketballSlate } from "@/lib/basketballSync";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { refreshActionNetworkSpreads, syncUpcomingFootballSchedule } from "@/lib/footballMarketSync";
import { MARKET_REFRESH_SCHEDULE, scheduledMarketRefreshWindow } from "@/lib/marketSchedule";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { retryPendingPushNotifications } from "@/lib/notifications";
import type { Game } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const SUPABASE_ODDS_CRON_TOKEN_SHA256 = "3907027700258fc50a7d4ea237b41402793ca1082da70fdc5751a81216c09dbb";

function hasValidSupabaseOddsCronToken(req: NextRequest) {
  const token = req.headers.get("x-odds-cron-token");
  if (!token) return false;
  const actual = Buffer.from(createHash("sha256").update(token).digest("hex"), "hex");
  const expectedHash = process.env.ODDS_CRON_TOKEN_SHA256 || SUPABASE_ODDS_CRON_TOKEN_SHA256;
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function chicagoParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  return {
    weekday: parts.find((part) => part.type === "weekday")?.value || "",
    hour: Number(parts.find((part) => part.type === "hour")?.value),
    minute: Number(parts.find((part) => part.type === "minute")?.value)
  };
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
  const hasValidVercelSecret = Boolean(process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
  const hasValidSupabaseSecret = hasValidSupabaseOddsCronToken(req);
  if (!hasValidVercelSecret && !hasValidSupabaseSecret) return unauthorized();

  const supabase = getSupabaseAdmin();
  let pushRetries = { attempted: 0, sent: 0, failed: 0 };
  try {
    pushRetries = await retryPendingPushNotifications(supabase);
  } catch (error) {
    console.error("[cron/odds] push retry pass failed", error);
  }

  const scheduled = Boolean(req.headers.get("x-vercel-cron-schedule")) || hasValidSupabaseSecret;
  const force = req.nextUrl.searchParams.get("force") === "1";
  const now = new Date();
  const { hour } = chicagoParts(now);
  const refreshWindow = scheduledMarketRefreshWindow(now);
  let basketball: { gamesDiscovered?: number; gamesUpdated?: number; error?: string } | null = null;
  const { minute } = chicagoParts(now);
  if (force || !scheduled || (minute === 50 && hour >= 7 && hour <= 23)) {
    try { basketball = await refreshBasketballSlate(supabase, now); }
    catch (error) { basketball = { error: error instanceof Error ? error.message : String(error) }; }
  }
  if (scheduled && !force && !refreshWindow.shouldRefresh) {
    return NextResponse.json({
      ok: true,
      skipped: !basketball,
      basketball,
      provider: "DraftKings",
      refreshSchedule: MARKET_REFRESH_SCHEDULE,
      reason: "Outside the scheduled market refresh window.",
      pushRetries
    });
  }

  try {
    const defaultWindow = {
      gamesDiscovered: 0,
      start: new Date(now.getTime() - DAY_MS).toISOString(),
      end: new Date(now.getTime() + 14 * DAY_MS).toISOString()
    };
    let scheduleSync: { gamesDiscovered: number; start: string; end: string; error?: string } = defaultWindow;
    const refreshFuture = force || !scheduled || refreshWindow.refreshFuture;

    if (refreshFuture) {
      try {
        scheduleSync = await syncUpcomingFootballSchedule(supabase, now);
      } catch (error) {
        scheduleSync = {
          ...defaultWindow,
          error: error instanceof Error ? error.message : String(error)
        };
        console.error("[cron/odds] ESPN schedule sync failed; continuing with existing games.", error);
      }
    }

    const { data, error } = await supabase
      .from("games")
      .select("*")
      .gte("commence_time", scheduleSync.start)
      .lte("commence_time", scheduleSync.end)
      .in("league", ["CFB", "NFL"])
      .order("commence_time", { ascending: true });
    if (error) throw new Error(error.message);

    const games = (data || []) as Game[];
    const nearCutoff = now.getTime() + 8 * DAY_MS;
    const nearGames = games.filter((game) => new Date(game.commence_time).getTime() <= nearCutoff);
    const futureGames = games.filter((game) => new Date(game.commence_time).getTime() > nearCutoff);

    const nearResult = await refreshActionNetworkSpreads(supabase, nearGames, now);
    const futureResult = refreshFuture
      ? await refreshActionNetworkSpreads(supabase, futureGames, now)
      : { gamesUpdated: 0, dogAdjustments: { removed: 0, tierChanged: 0 } };

    return NextResponse.json({
      ok: true,
      provider: "DraftKings",
      scheduleSource: "ESPN (provider-verified fallback for TBD kickoff times)",
      marketFeed: "Action Network",
      basketball,
      gamesChecked: games.length,
      nearGamesChecked: nearGames.length,
      futureGamesChecked: refreshFuture ? futureGames.length : 0,
      refreshSchedule: MARKET_REFRESH_SCHEDULE,
      futureRefreshCadence: refreshFuture ? "refreshed this run" : "first scheduled refresh of the active day",
      gamesUpdated: nearResult.gamesUpdated + futureResult.gamesUpdated,
      dogAdjustments: {
        removed: nearResult.dogAdjustments.removed + futureResult.dogAdjustments.removed,
        tierChanged: nearResult.dogAdjustments.tierChanged + futureResult.dogAdjustments.tierChanged
      },
      scheduleSync,
      pushRetries
    });
  } catch (error) {
    console.error("[cron/odds] token-free market refresh failed", error);
    return NextResponse.json({
      ok: false,
      provider: "DraftKings",
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
