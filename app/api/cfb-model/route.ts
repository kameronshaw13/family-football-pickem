import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { createAsyncCache } from "@/lib/asyncCache";
import {
  buildCfbModelProjection,
  cfbModelTeamKey,
  cfbSeasonForDate,
  pointRatingFromAdjustedEpa,
  pointRatingFromCore,
  pointRatingFromElo,
  type CfbDirectProjection,
  type CfbModelGame,
  type CfbRatingPair
} from "@/lib/cfbModel";
import { exactWeeklySummaryRow, falseyCsv, finiteNumber, latestWeeklyRow, logoTeamId, officialCfbWeek } from "@/lib/cfbMatchupData";
import { loadStoredCfbSnapshot } from "@/lib/matchupStatSnapshots";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

type RatingRow = { team?: string; rating?: number | null; fpi?: number | null; elo?: number | null; overall?: number | null };
type RatingSource = { id: string; label: string; values: Map<string, number> };
type RatingBundle = { fetchedAt: string; sources: RatingSource[] };
type HtmlCell = { text: string; raw: string };

const ratingCache = createAsyncCache<RatingBundle>(10 * 60_000, 4);
const feiCache = createAsyncCache<CfbDirectProjection[]>(15 * 60_000, 4);
const masseyCache = createAsyncCache<Map<string, number>>(15 * 60_000, 16);
const SUPABASE_CRON_TOKEN_SHA256 = "3907027700258fc50a7d4ea237b41402793ca1082da70fdc5751a81216c09dbb";
export const maxDuration = 30;
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function within<T>(promise: Promise<T>, fallback: T, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[cfb-model] ${label} exceeded ${timeoutMs}ms; returning partial model data.`);
      resolve(fallback);
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      promise.catch((error) => {
        console.warn(`[cfb-model] ${label} failed; returning partial model data.`, error);
        return fallback;
      }),
      timeout
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&#(d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function cleanHtml(value: string) {
  return decodeHtml(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlRows(html: string): HtmlCell[][] {
  return Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)).map((row) =>
    Array.from(row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((cell) => ({ raw: cell[1], text: cleanHtml(cell[1]) }))
  ).filter(row => row.length);
}

function tableDataRows(rows: HtmlCell[][], requiredHeaders: string[]) {
  const headerIndex = rows.findIndex(row => requiredHeaders.every(header => row.some(cell => cell.text.toLowerCase() === header.toLowerCase())));
  if (headerIndex < 0) return { header: [] as string[], rows: [] as HtmlCell[][] };
  return { header: rows[headerIndex].map(cell => cell.text), rows: rows.slice(headerIndex + 1) };
}

function keyContainsTeam(text: string, team: string) {
  const normalized = cfbModelTeamKey(text);
  const key = cfbModelTeamKey(team);
  return normalized === key || normalized.includes(key) || key.includes(normalized);
}

function isoDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || "";
  return `${get("year")}${get("month")}${get("day")}`;
}

async function fetchRatings(path: string, season: number) {
  const key = process.env.CFBD_API_KEY?.trim();
  if (!key) {
    console.warn(`[cfb-model] CFBD_API_KEY missing; ${path} will use fallback if available.`);
    return [] as RatingRow[];
  }
  try {
    const response = await fetch(`https://api.collegefootballdata.com/ratings/${path}?year=${season}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(4_500)
    });
    if (!response.ok) {
      console.warn(`[cfb-model] CFBD ${path} returned ${response.status}; using fallback if available.`);
      return [];
    }
    const payload = await response.json();
    return Array.isArray(payload) ? payload as RatingRow[] : [];
  } catch (error) {
    console.warn(`[cfb-model] CFBD ${path} failed; using fallback if available.`, error);
    return [];
  }
}

function ratingMap(rows: RatingRow[], field: keyof RatingRow, convert: (value: number) => number = value => value) {
  return new Map(rows.flatMap((row) => {
    const team = String(row.team || "");
    const value = Number(row[field]);
    return team && Number.isFinite(value) ? [[cfbModelTeamKey(team), convert(value)] as const] : [];
  }));
}

async function loadRatings(season: number) {
  return ratingCache(String(season), async () => {
    const [sp, fpi, srs, elo, core] = await Promise.all([
      fetchRatings("sp", season),
      fetchRatings("fpi", season),
      fetchRatings("srs", season),
      fetchRatings("elo", season),
      fetchRatings("core", season)
    ]);
    const sources: RatingSource[] = [
      { id: "sp", label: "SP+", values: ratingMap(sp, "rating") },
      { id: "fpi", label: "FPI", values: ratingMap(fpi, "fpi") },
      { id: "srs", label: "SRS", values: ratingMap(srs, "rating") },
      { id: "elo", label: "Elo", values: ratingMap(elo, "elo", pointRatingFromElo) },
      { id: "core", label: "CORE", values: ratingMap(core, "overall", pointRatingFromCore) }
    ].filter(source => source.values.size > 0);
    return { fetchedAt: new Date().toISOString(), sources };
  });
}

async function loadFei(season: number, games: CfbModelGame[]) {
  return feiCache(`${season}:${games.map(game => game.id).sort().join(",")}`, async () => {
    try {
      const response = await fetch(`https://bcftoys.com/${season}-gp`, {
        headers: { "User-Agent": "FamilyFootballPickem/1.0 (+matchup model)" },
        cache: "no-store",
        signal: AbortSignal.timeout(4_500)
      });
      if (!response.ok) return [];
      const { header, rows } = tableDataRows(htmlRows(await response.text()), ["Projected Win", "Projected Loss", "PM"]);
      const winIndex = header.findIndex(value => value.toLowerCase() === "projected win");
      const lossIndex = header.findIndex(value => value.toLowerCase() === "projected loss");
      const marginIndex = header.findIndex(value => value.toLowerCase() === "pm");
      if (winIndex < 0 || lossIndex < 0 || marginIndex < 0) return [];

      const projections: CfbDirectProjection[] = [];
      for (const game of games) {
        const row = rows.find(cells => {
          const winner = cells[winIndex]?.text || "";
          const loser = cells[lossIndex]?.text || "";
          return (keyContainsTeam(winner, game.home_team) && keyContainsTeam(loser, game.away_team)) ||
            (keyContainsTeam(winner, game.away_team) && keyContainsTeam(loser, game.home_team));
        });
        if (!row) continue;
        const margin = Number(row[marginIndex]?.text);
        if (!Number.isFinite(margin)) continue;
        const winner = row[winIndex]?.text || "";
        const homeSpread = keyContainsTeam(winner, game.home_team) ? -Math.abs(margin) : Math.abs(margin);
        projections.push({ id: `fei:${game.id}`, label: "FEI", homeSpread });
      }
      return projections;
    } catch (error) {
      console.warn("[cfb-model] FEI projections unavailable.", error);
      return [];
    }
  });
}

async function loadMasseyDate(dateKey: string, games: CfbModelGame[]) {
  return masseyCache(`${dateKey}:${games.map(game => game.id).sort().join(",")}`, async () => {
    const values = new Map<string, number>();
    try {
      const response = await fetch(`https://masseyratings.com/cf/fbs/games?dt=${dateKey}`, {
        headers: { "User-Agent": "FamilyFootballPickem/1.0 (+matchup model)" },
        cache: "no-store",
        signal: AbortSignal.timeout(4_500)
      });
      if (!response.ok) return values;
      const { header, rows } = tableDataRows(htmlRows(await response.text()), ["Team", "Pred"]);
      const teamIndex = header.findIndex(value => value.toLowerCase() === "team");
      const predIndex = header.findIndex(value => value.toLowerCase() === "pred");
      if (teamIndex < 0 || predIndex < 0) return values;

      for (const game of games) {
        const row = rows.find(cells => {
          const teamText = cells[teamIndex]?.text || "";
          const normalized = normalizeCombinedTeamCell(teamText);
          return normalized.includes(cfbModelTeamKey(game.away_team)) && normalized.includes(cfbModelTeamKey(game.home_team));
        });
        if (!row) continue;
        const scores = (row[predIndex]?.text || "").match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
        if (!scores) continue;
        const awayPred = Number(scores[1]);
        const homePred = Number(scores[2]);
        if (!Number.isFinite(awayPred) || !Number.isFinite(homePred)) continue;
        values.set(game.id, Math.round(-(homePred - awayPred) * 10) / 10);
      }
    } catch (error) {
      console.warn("[cfb-model] Massey projections unavailable.", error);
    }
    return values;
  });
}

function normalizeCombinedTeamCell(value: string) {
  return normalizeTeamNameForContains(value);
}

function normalizeTeamNameForContains(value: string) {
  return value
    .toLowerCase()
    .replace(/miami\s*\(oh\)/g, "miami ohio")
    .replace(/\bul\s*monroe\b/g, "louisiana monroe")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pairForSource(game: CfbModelGame, source: RatingSource): CfbRatingPair {
  return {
    id: source.id,
    label: source.label,
    homeRating: source.values.get(cfbModelTeamKey(game.home_team)) ?? null,
    awayRating: source.values.get(cfbModelTeamKey(game.away_team)) ?? null
  };
}

function fallbackPairs(
  game: CfbModelGame,
  usedIds: Set<string>,
  snapshot: Awaited<ReturnType<typeof loadStoredCfbSnapshot>>
) {
  const pairs: CfbRatingPair[] = [];
  const throughWeek = Math.max(0, officialCfbWeek(game.commence_time) - 1);
  const awayId = logoTeamId(game.away_logo_url);
  const homeId = logoTeamId(game.home_logo_url);

  if (!snapshot) return pairs;

  if (!usedIds.has("fpi")) {
    const awayFpi = latestWeeklyRow(snapshot.fpi, awayId, "week", throughWeek, value => falseyCsv(value.snapshot_out_of_sequence));
    const homeFpi = latestWeeklyRow(snapshot.fpi, homeId, "week", throughWeek, value => falseyCsv(value.snapshot_out_of_sequence));
    pairs.push({ id: "fpi", label: "FPI", awayRating: finiteNumber(awayFpi?.fpi), homeRating: finiteNumber(homeFpi?.fpi) });
  }

  const awaySummary = exactWeeklySummaryRow(snapshot.summaries, awayId, game.away_team, throughWeek);
  const homeSummary = exactWeeklySummaryRow(snapshot.summaries, homeId, game.home_team, throughWeek);
  const awayEpa = finiteNumber(awaySummary?.net_adj_epa);
  const homeEpa = finiteNumber(homeSummary?.net_adj_epa);
  pairs.push({
    id: "adj-epa",
    label: "Adj. EPA",
    awayRating: awayEpa == null ? null : pointRatingFromAdjustedEpa(awayEpa),
    homeRating: homeEpa == null ? null : pointRatingFromAdjustedEpa(homeEpa)
  });

  return pairs;
}

function hasValidRefreshToken(request: NextRequest) {
  const token = request.headers.get("x-odds-cron-token");
  if (token) {
    const expectedHash = process.env.ODDS_CRON_TOKEN_SHA256 || SUPABASE_CRON_TOKEN_SHA256;
    if (/^[a-f0-9]{64}$/i.test(expectedHash)) {
      const actual = Buffer.from(createHash("sha256").update(token).digest("hex"), "hex");
      const expected = Buffer.from(expectedHash, "hex");
      if (actual.length === expected.length && timingSafeEqual(actual, expected)) return true;
    }
  }

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return Boolean(process.env.CRON_SECRET && bearer === process.env.CRON_SECRET);
}

export async function GET(request: NextRequest) {
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  if (refresh) {
    if (!hasValidRefreshToken(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    const auth = await getProfileFromRequest(request);
    if (!auth.profile) return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status });

    const username = String(auth.profile.username || "").trim().toLowerCase();
    const group = String(request.headers.get("x-pickem-group") || "").trim().toLowerCase();
    if (username !== "kameron" || (group !== "shaw-family" && group !== "friends")) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
  }

  const gameId = request.nextUrl.searchParams.get("gameId")?.trim() || "";
  const rawWeek = request.nextUrl.searchParams.get("week")?.trim() || "";
  const week = rawWeek === "" ? null : Number(rawWeek);
  if (!refresh && ((!gameId && week == null) || (gameId && gameId.length > 120) || (week != null && (!Number.isInteger(week) || week < 0 || week > 30)))) {
    return NextResponse.json({ error: "A valid game or week is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const select = "id,week,commence_time,home_team,away_team,home_logo_url,away_logo_url,current_spread_team,current_spread";
    let games: CfbModelGame[] = [];

    if (refresh) {
      const now = Date.now();
      const from = new Date(now - 12 * 60 * 60 * 1000).toISOString();
      const through = new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase.from("games")
        .select(select)
        .eq("league", "CFB")
        .gte("commence_time", from)
        .lte("commence_time", through)
        .order("commence_time", { ascending: true })
        .limit(150)
        .abortSignal(AbortSignal.timeout(8_000));
      if (error) throw error;
      games = (data || []) as CfbModelGame[];
    } else if (gameId) {
      const { data, error } = await supabase.from("games").select(select).eq("id", gameId).eq("league", "CFB").abortSignal(AbortSignal.timeout(5_000)).maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "This college football matchup could not be found." }, { status: 404 });
      games = [data as CfbModelGame];
    } else {
      const { data, error } = await supabase.from("games").select(select).eq("league", "CFB").eq("week", week!).order("commence_time", { ascending: true }).limit(100).abortSignal(AbortSignal.timeout(8_000));
      if (error) throw error;
      games = (data || []) as CfbModelGame[];
    }

    const headers = { "Cache-Control": "private, no-store" };
    if (!games.length) {
      if (refresh) return NextResponse.json({ ok: true, refreshed: 0, games: [] }, { headers });
      return gameId ? NextResponse.json(null, { headers }) : NextResponse.json({ week, games: [] }, { headers });
    }

    if (!refresh) {
      const ids = games.map(game => game.id);
      const { data: savedRows, error: savedError } = await supabase
        .from("cfb_model_snapshots")
        .select("game_id,payload,fetched_at")
        .in("game_id", ids)
        .abortSignal(AbortSignal.timeout(5_000));
      if (savedError) throw savedError;

      const savedByGame = new Map((savedRows || []).map(row => [String(row.game_id), row]));
      const projections = games.flatMap(game => {
        const saved = savedByGame.get(game.id) as { payload?: { models?: Array<{ id: string; label: string; homeSpread: number }> }; fetched_at?: string } | undefined;
        const models = Array.isArray(saved?.payload?.models) ? saved!.payload!.models! : [];
        if (!models.length) return [];
        const direct: CfbDirectProjection[] = models.flatMap(model =>
          Number.isFinite(Number(model.homeSpread))
            ? [{ id: String(model.id), label: String(model.label), homeSpread: Number(model.homeSpread) }]
            : []
        );
        return [buildCfbModelProjection(game, [], direct, saved?.fetched_at || new Date().toISOString())];
      });

      if (gameId) {
        if (!projections[0]) {
          return NextResponse.json({ error: "Model snapshot is not ready yet. It refreshes daily." }, { status: 503, headers });
        }
        return NextResponse.json(projections[0], { headers });
      }
      return NextResponse.json({ week, games: projections }, { headers });
    }

    const seasons = Array.from(new Set(games.map(game => cfbSeasonForDate(game.commence_time))));
    const dates = Array.from(new Set(games.map(game => isoDateKey(game.commence_time))));
    const snapshotKeys = Array.from(new Map(games.map(game => {
      const season = cfbSeasonForDate(game.commence_time);
      const throughWeek = Math.max(0, officialCfbWeek(game.commence_time) - 1);
      return [`${season}:${throughWeek}`, { season, throughWeek }] as const;
    })).entries());

    const [ratingEntries, feiEntries, masseyEntries, snapshotEntries] = await Promise.all([
      Promise.all(seasons.map(async season => [
        season,
        await within(loadRatings(season), { fetchedAt: new Date().toISOString(), sources: [] }, 5_000, `CFBD ratings ${season}`)
      ] as const)),
      Promise.all(seasons.map(async season => [
        season,
        await within(
          loadFei(season, games.filter(game => cfbSeasonForDate(game.commence_time) === season)),
          [],
          3_000,
          `FEI ${season}`
        )
      ] as const)),
      Promise.all(dates.map(async dateKey => [
        dateKey,
        await within(
          loadMasseyDate(dateKey, games.filter(game => isoDateKey(game.commence_time) === dateKey)),
          new Map<string, number>(),
          3_000,
          `Massey ${dateKey}`
        )
      ] as const)),
      Promise.all(snapshotKeys.map(async ([key, value]) => [
        key,
        await within(loadStoredCfbSnapshot(value.season, value.throughWeek), null, 2_000, `stored snapshot ${key}`)
      ] as const))
    ]);

    const ratingBundles = new Map(ratingEntries);
    const feiBySeason = new Map(feiEntries);
    const masseyByDate = new Map(masseyEntries);
    const snapshots = new Map(snapshotEntries);
    const refreshedAt = new Date().toISOString();

    const projections = games.map(game => {
      const season = cfbSeasonForDate(game.commence_time);
      const dateKey = isoDateKey(game.commence_time);
      const throughWeek = Math.max(0, officialCfbWeek(game.commence_time) - 1);
      const bundle = ratingBundles.get(season) || { fetchedAt: refreshedAt, sources: [] };
      const feiRows = feiBySeason.get(season) || [];
      const masseyRows = masseyByDate.get(dateKey) || new Map<string, number>();
      const snapshot = snapshots.get(`${season}:${throughWeek}`) || null;
      const officialPairs = bundle.sources.map(source => pairForSource(game, source));
      const usedIds = new Set(officialPairs.filter(pair => pair.homeRating != null && pair.awayRating != null).map(pair => pair.id));
      const fallbacks = fallbackPairs(game, usedIds, snapshot);
      const validPairs = [...officialPairs, ...fallbacks].filter((pair, index, all) =>
        pair.homeRating != null && pair.awayRating != null &&
        all.findIndex(other => other.id === pair.id && other.homeRating != null && other.awayRating != null) === index
      );

      const direct: CfbDirectProjection[] = [];
      const fei = feiRows.find(row => row.id === `fei:${game.id}`);
      if (fei) direct.push({ id: "fei", label: "FEI", homeSpread: fei.homeSpread });
      const massey = masseyRows.get(game.id);
      if (massey != null) direct.push({ id: "massey", label: "Massey", homeSpread: massey });

      return buildCfbModelProjection(game, validPairs, direct, refreshedAt);
    });

    const rows = projections
      .filter(projection => projection.models.length > 0)
      .map(projection => {
        const game = games.find(item => item.id === projection.gameId)!;
        return {
          game_id: projection.gameId,
          season: cfbSeasonForDate(game.commence_time),
          official_week: officialCfbWeek(game.commence_time),
          payload: { models: projection.models },
          fetched_at: refreshedAt
        };
      });

    if (rows.length) {
      const { error: saveError } = await supabase
        .from("cfb_model_snapshots")
        .upsert(rows, { onConflict: "game_id" });
      if (saveError) throw saveError;
    }

    console.info(`[cfb-model] daily refresh stored ${rows.length}/${games.length} upcoming projections`);
    return NextResponse.json({
      ok: true,
      refreshedAt,
      refreshed: rows.length,
      games: projections.map(projection => ({ gameId: projection.gameId, models: projection.models.map(model => model.label) }))
    }, { headers });
  } catch (error) {
    console.error("[cfb-model]", error);
    return NextResponse.json({ error: "Model data is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
