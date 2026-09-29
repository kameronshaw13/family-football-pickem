import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { falseyCsv, finiteNumber, parseCsv } from "@/lib/cfbMatchupData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPABASE_CRON_TOKEN_SHA256 = "3907027700258fc50a7d4ea237b41402793ca1082da70fdc5751a81216c09dbb";

type League = "CFB" | "NFL";

function hasValidSupabaseCronToken(req: NextRequest) {
  const token = req.headers.get("x-odds-cron-token");
  if (!token) return false;
  const actual = Buffer.from(createHash("sha256").update(token).digest("hex"), "hex");
  const expectedHash = process.env.ODDS_CRON_TOKEN_SHA256 || SUPABASE_CRON_TOKEN_SHA256;
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function chicagoParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return {
    weekday: get("weekday"),
    year: Number(get("year")),
    month: Number(get("month")),
    hour: Number(get("hour")),
    minute: Number(get("minute"))
  };
}

function footballSeason(date = new Date()) {
  const { year, month } = chicagoParts(date);
  return month <= 2 ? year - 1 : year;
}

function scheduledLeagues(date = new Date()): League[] {
  const { weekday, hour, minute } = chicagoParts(date);
  if (hour !== 8 || minute !== 30) return [];

  const leagues: League[] = [];
  if (["Sun", "Mon", "Tue", "Wed"].includes(weekday)) leagues.push("CFB");
  if (["Tue", "Wed", "Thu"].includes(weekday)) leagues.push("NFL");
  return leagues;
}

async function checkCfb(season: number) {
  const [summaryResponse, fpiResponse] = await Promise.all([
    fetch(
      `https://github.com/sportsdataverse/sportsdataverse-data/releases/download/cfb_team_summaries_weekly/cfb_team_summaries_weekly_${season}.csv`,
      { cache: "no-store", signal: AbortSignal.timeout(20_000) }
    ),
    fetch(
      `https://github.com/sportsdataverse/sportsdataverse-data/releases/download/cfb_fpi_weekly/cfb_fpi_weekly_${season}.csv`,
      { cache: "no-store", signal: AbortSignal.timeout(20_000) }
    )
  ]);
  if (!summaryResponse.ok) throw new Error(`CFB team summaries returned ${summaryResponse.status}`);
  if (!fpiResponse.ok) throw new Error(`CFB FPI returned ${fpiResponse.status}`);

  const [summaryText, fpiText] = await Promise.all([summaryResponse.text(), fpiResponse.text()]);
  const summaries = parseCsv(summaryText, (key) => key === "through_week");
  const fpi = parseCsv(fpiText, (key) => ["week", "snapshot_out_of_sequence"].includes(key));
  const summaryWeek = summaries.reduce((max, row) => Math.max(max, finiteNumber(row.through_week) ?? -1), -1);
  const fpiWeek = fpi
    .filter((row) => falseyCsv(row.snapshot_out_of_sequence))
    .reduce((max, row) => Math.max(max, finiteNumber(row.week) ?? -1), -1);

  return {
    league: "CFB" as const,
    season,
    availableThroughWeek: summaryWeek >= 0 ? summaryWeek : null,
    fpiThroughWeek: fpiWeek >= 0 ? fpiWeek : null,
    source: "SportsDataverse weekly snapshots"
  };
}

async function checkNfl(season: number) {
  const response = await fetch(
    `https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_${season}.csv`,
    { cache: "no-store", signal: AbortSignal.timeout(20_000) }
  );
  if (!response.ok) throw new Error(`NFL team stats returned ${response.status}`);

  const rows = parseCsv(await response.text(), (key) => key === "week" || key === "season_type");
  const availableWeek = rows
    .filter((row) => String(row.season_type || "").toUpperCase() === "REG")
    .reduce((max, row) => Math.max(max, finiteNumber(row.week) ?? -1), -1);

  return {
    league: "NFL" as const,
    season,
    availableThroughWeek: availableWeek >= 0 ? availableWeek : null,
    source: "nflverse team weekly stats"
  };
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
  const hasValidVercelSecret = Boolean(process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
  const hasValidSupabaseSecret = hasValidSupabaseCronToken(req);
  if (!hasValidVercelSecret && !hasValidSupabaseSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const force = req.nextUrl.searchParams.get("force") === "1";
  const requestedLeague = req.nextUrl.searchParams.get("league")?.toUpperCase();
  const leagues: League[] = force
    ? requestedLeague === "CFB" || requestedLeague === "NFL"
      ? [requestedLeague]
      : ["CFB", "NFL"]
    : scheduledLeagues(now);

  if (!leagues.length) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Outside the 8:30 AM Central matchup-stat refresh window."
    });
  }

  const season = footballSeason(now);
  const checks = await Promise.all(leagues.map(async (league) => {
    try {
      const result = league === "CFB" ? await checkCfb(season) : await checkNfl(season);
      console.info("[cron/matchup-stats] source check", result);
      return { ok: true, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[cron/matchup-stats] ${league} source check failed`, error);
      return { ok: false, league, season, error: message };
    }
  }));

  return NextResponse.json({
    ok: checks.every((check) => check.ok),
    checkedAt: now.toISOString(),
    chicago: chicagoParts(now),
    checks
  }, { status: checks.every((check) => check.ok) ? 200 : 502 });
}
