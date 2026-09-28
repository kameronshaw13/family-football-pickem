import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { refreshActionNetworkSpreads, syncUpcomingFootballSchedule } from "@/lib/footballMarketSync";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import type { Game } from "@/lib/types";

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

function isChicagoMarketRefreshWindow(date = new Date()) {
  const { weekday, hour, minute } = chicagoParts(date);
  if (["Tue", "Wed", "Thu", "Fri"].includes(weekday)) return true;
  if (weekday !== "Sat") return false;

  // Weekend spreads keep moving until the existing 10:00 AM CT spread freeze,
  // one hour before the shared 11:00 AM CT Pick Board lock.
  return hour < 10 || (hour === 10 && minute === 0);
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
  const hasValidVercelSecret = Boolean(process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
  const hasValidSupabaseSecret = hasValidSupabaseOddsCronToken(req);
  if (!hasValidVercelSecret && !hasValidSupabaseSecret) return unauthorized();

  const scheduled = Boolean(req.headers.get("x-vercel-cron-schedule")) || hasValidSupabaseSecret;
  const now = new Date();
  if (scheduled && !isChicagoMarketRefreshWindow(now)) {
    return NextResponse.json({ ok: true, skipped: true, provider: "Action Network", reason: "Outside the active CT market refresh window." });
  }

  try {
    const supabase = getSupabaseAdmin();
    let scheduleSync: { gamesDiscovered: number; start: string; end: string; error?: string };

    try {
      scheduleSync = await syncUpcomingFootballSchedule(supabase, now);
    } catch (error) {
      scheduleSync = {
        gamesDiscovered: 0,
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        end: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000).toISOString(),
        error: error instanceof Error ? error.message : String(error)
      };
      console.error("[cron/odds] ESPN schedule sync failed; continuing with existing games.", error);
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
    const result = await refreshActionNetworkSpreads(supabase, games, now);

    return NextResponse.json({
      ok: true,
      provider: "Action Network",
      scheduleSource: "ESPN",
      gamesChecked: games.length,
      gamesUpdated: result.gamesUpdated,
      dogAdjustments: result.dogAdjustments,
      scheduleSync
    });
  } catch (error) {
    console.error("[cron/odds] token-free market refresh failed", error);
    return NextResponse.json({
      ok: false,
      provider: "Action Network",
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
