import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { falseyCsv, finiteNumber, officialCfbWeek, officialNflWeek, parseCsv, type SportsDataRow } from "@/lib/cfbMatchupData";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPABASE_CRON_TOKEN_SHA256 = "3907027700258fc50a7d4ea237b41402793ca1082da70fdc5751a81216c09dbb";

type League = "CFB" | "NFL";

const CFB_SUMMARY_KEYS = new Set([
  "team", "pos_team", "team_id", "through_week", "valid_games",
  "net_adj_epa", "net_adj_epa_rank",
  "adj_off_epa", "adj_off_epa_rank", "adj_def_epa", "adj_def_epa_rank",
  "EPAplay_off", "EPAplay_off_rank", "EPAplay_def", "EPAplay_def_rank",
  "EPAdrive_off", "EPAdrive_off_rank", "EPAdrive_def", "EPAdrive_def_rank",
  "early_down_EPA_off", "early_down_EPA_off_rank", "early_down_EPA_def", "early_down_EPA_def_rank",
  "late_down_success_off", "late_down_success_off_rank", "late_down_success_def", "late_down_success_def_rank",
  "available_yards_pct_off", "available_yards_pct_off_rank", "available_yards_pct_def", "available_yards_pct_def_rank",
  "success_off", "success_off_rank", "success_def", "success_def_rank",
  "explosive_off", "explosive_off_rank", "explosive_def", "explosive_def_rank",
  "yardsplay_off", "yardsplay_off_rank", "yardsplay_def", "yardsplay_def_rank",
  "line_yards_off", "line_yards_off_rank", "line_yards_def", "line_yards_def_rank",
  "third_down_success_off", "third_down_success_off_rank", "third_down_success_def", "third_down_success_def_rank",
  "red_zone_success_off", "red_zone_success_off_rank", "red_zone_success_def", "red_zone_success_def_rank"
]);

const CFB_FPI_KEYS = new Set([
  "team", "team_id", "week", "snapshot_out_of_sequence",
  "fpi", "rank",
  "offefficiency", "offefficiencyrank",
  "defefficiency", "defefficiencyrank",
  "stefficiency", "stefficiencyrank"
]);

const NFL_KEYS = new Set([
  "season", "week", "season_type", "team", "opponent_team",
  "attempts", "passing_yards", "passing_epa", "passing_cpoe",
  "passing_interceptions", "passing_first_downs", "passing_20",
  "sacks_suffered", "carries", "rushing_yards", "rushing_epa",
  "rushing_first_downs", "rushing_20", "rushing_fumbles_lost",
  "receiving_fumbles_lost"
]);

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

function lastModified(response: Response) {
  const value = response.headers.get("last-modified");
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function targetThroughWeek(league: League, season: number, now: Date) {
  const supabase = getSupabaseAdmin();
  const seasonEnd = new Date(Date.UTC(season + 1, 2, 1)).toISOString();
  const { data, error } = await supabase
    .from("games")
    .select("week,commence_time")
    .eq("league", league)
    .gt("commence_time", now.toISOString())
    .lt("commence_time", seasonEnd)
    .order("commence_time", { ascending: true })
    .limit(20)
    .abortSignal(AbortSignal.timeout(8_000));
  if (error) throw new Error(error.message);

  const nextKickoff = (data || []).find((row) => Boolean(row.commence_time))?.commence_time;
  if (nextKickoff) {
    const nextWeek = league === "CFB"
      ? officialCfbWeek(nextKickoff)
      : officialNflWeek(nextKickoff);
    return Math.max(0, nextWeek - 1);
  }

  const { data: completed, error: completedError } = await supabase
    .from("games")
    .select("commence_time")
    .eq("league", league)
    .not("final_home_score", "is", null)
    .not("final_away_score", "is", null)
    .lte("commence_time", now.toISOString())
    .order("commence_time", { ascending: false })
    .limit(1)
    .abortSignal(AbortSignal.timeout(8_000));
  if (completedError) throw new Error(completedError.message);
  const lastKickoff = completed?.[0]?.commence_time;
  if (!lastKickoff) return 0;
  return league === "CFB"
    ? officialCfbWeek(lastKickoff)
    : officialNflWeek(lastKickoff);
}

async function saveSnapshot(
  league: League,
  season: number,
  throughWeek: number,
  source: string,
  sourceUpdatedAt: string | null,
  payload: Record<string, unknown>
) {
  const { error } = await getSupabaseAdmin()
    .from("matchup_stat_snapshots")
    .upsert({
      league,
      season,
      through_week: throughWeek,
      source,
      source_updated_at: sourceUpdatedAt,
      fetched_at: new Date().toISOString(),
      payload
    }, { onConflict: "league,season,through_week" });
  if (error) throw new Error(error.message);
}

async function refreshCfb(season: number, throughWeek: number) {
  const [summaryResponse, fpiResponse] = await Promise.all([
    fetch(
      `https://github.com/sportsdataverse/sportsdataverse-data/releases/download/cfb_team_summaries_weekly/cfb_team_summaries_weekly_${season}.csv`,
      { cache: "no-store", signal: AbortSignal.timeout(25_000) }
    ),
    fetch(
      `https://github.com/sportsdataverse/sportsdataverse-data/releases/download/cfb_fpi_weekly/cfb_fpi_weekly_${season}.csv`,
      { cache: "no-store", signal: AbortSignal.timeout(25_000) }
    )
  ]);
  if (!summaryResponse.ok) throw new Error(`CFB team summaries returned ${summaryResponse.status}`);
  if (!fpiResponse.ok) throw new Error(`CFB FPI returned ${fpiResponse.status}`);

  const [summaryText, fpiText] = await Promise.all([summaryResponse.text(), fpiResponse.text()]);
  const summaries = parseCsv(summaryText, (key) => CFB_SUMMARY_KEYS.has(key));
  const fpi = parseCsv(fpiText, (key) => CFB_FPI_KEYS.has(key));
  const availableThroughWeek = summaries.reduce((max, row) => Math.max(max, finiteNumber(row.through_week) ?? -1), -1);
  const exactSummaries = summaries.filter((row) => finiteNumber(row.through_week) === throughWeek);
  const fpiRows = fpi.filter((row) =>
    (finiteNumber(row.week) ?? 999) <= throughWeek &&
    falseyCsv(row.snapshot_out_of_sequence)
  );
  const fpiThroughWeek = fpiRows.reduce((max, row) => Math.max(max, finiteNumber(row.week) ?? -1), -1);

  if (!exactSummaries.length) {
    return {
      league: "CFB" as const,
      season,
      targetThroughWeek: throughWeek,
      availableThroughWeek: availableThroughWeek >= 0 ? availableThroughWeek : null,
      fpiThroughWeek: fpiThroughWeek >= 0 ? fpiThroughWeek : null,
      saved: false,
      reason: "The completed-week CFB snapshot has not been published yet."
    };
  }

  const sourceUpdatedAt = [lastModified(summaryResponse), lastModified(fpiResponse)]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) || null;

  await saveSnapshot("CFB", season, throughWeek, "SportsDataverse weekly snapshots", sourceUpdatedAt, {
    summaries: exactSummaries,
    fpi: fpiRows
  });

  return {
    league: "CFB" as const,
    season,
    targetThroughWeek: throughWeek,
    availableThroughWeek,
    fpiThroughWeek: fpiThroughWeek >= 0 ? fpiThroughWeek : null,
    teams: exactSummaries.length,
    saved: true,
    sourceUpdatedAt
  };
}

async function refreshNfl(season: number, throughWeek: number) {
  const response = await fetch(
    `https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_${season}.csv`,
    { cache: "no-store", signal: AbortSignal.timeout(25_000) }
  );
  if (!response.ok) throw new Error(`NFL team stats returned ${response.status}`);

  const rows = parseCsv(await response.text(), (key) => NFL_KEYS.has(key));
  const regularRows = rows.filter((row) => String(row.season_type || "").toUpperCase() === "REG");
  const availableThroughWeek = regularRows.reduce((max, row) => Math.max(max, finiteNumber(row.week) ?? -1), -1);
  if (availableThroughWeek < throughWeek) {
    return {
      league: "NFL" as const,
      season,
      targetThroughWeek: throughWeek,
      availableThroughWeek: availableThroughWeek >= 0 ? availableThroughWeek : null,
      saved: false,
      reason: "The completed-week NFL team stats have not been published yet."
    };
  }

  const snapshotRows: SportsDataRow[] = regularRows.filter((row) => (finiteNumber(row.week) ?? 999) <= throughWeek);
  const sourceUpdatedAt = lastModified(response);
  await saveSnapshot("NFL", season, throughWeek, "nflverse team weekly stats", sourceUpdatedAt, {
    rows: snapshotRows
  });

  return {
    league: "NFL" as const,
    season,
    targetThroughWeek: throughWeek,
    availableThroughWeek,
    rows: snapshotRows.length,
    saved: true,
    sourceUpdatedAt
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
      const throughWeek = await targetThroughWeek(league, season, now);
      const result = league === "CFB"
        ? await refreshCfb(season, throughWeek)
        : await refreshNfl(season, throughWeek);
      console.info("[cron/matchup-stats] refresh", result);
      return { ok: true, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[cron/matchup-stats] ${league} refresh failed`, error);
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
