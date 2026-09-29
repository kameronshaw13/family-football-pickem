import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { createAsyncCache } from "@/lib/asyncCache";
import {
  buildCfbModelProjection,
  buildResultsEloRatings,
  buildResultsSrsRatings,
  cfbModelTeamKey,
  cfbSeasonForDate,
  pointRatingFromAdjustedEpa,
  pointRatingFromCore,
  pointRatingFromElo,
  type CfbCompletedGame,
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
export const maxDuration = 30;
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  snapshot: Awaited<ReturnType<typeof loadStoredCfbSnapshot>>,
  srs: Map<string, number>,
  elo: Map<string, number>
) {
  const pairs: CfbRatingPair[] = [];
  const throughWeek = Math.max(0, officialCfbWeek(game.commence_time) - 1);
  const awayId = logoTeamId(game.away_logo_url);
  const homeId = logoTeamId(game.home_logo_url);

  if (snapshot) {
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
  }

  const homeKey = cfbModelTeamKey(game.home_team);
  const awayKey = cfbModelTeamKey(game.away_team);
  if (!usedIds.has("srs")) {
    pairs.push({ id: "srs", label: "SRS", homeRating: srs.get(homeKey) ?? null, awayRating: srs.get(awayKey) ?? null });
  }
  if (!usedIds.has("elo")) {
    pairs.push({ id: "elo", label: "Elo", homeRating: elo.get(homeKey) ?? null, awayRating: elo.get(awayKey) ?? null });
  }
  return pairs;
}

export async function GET(request: NextRequest) {
  const auth = await getProfileFromRequest(request);
  if (!auth.profile) return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status });

  const username = String(auth.profile.username || "").trim().toLowerCase();
  const group = String(request.headers.get("x-pickem-group") || "").trim().toLowerCase();
  if (username !== "kameron" || (group !== "shaw-family" && group !== "friends")) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const gameId = request.nextUrl.searchParams.get("gameId")?.trim() || "";
  const rawWeek = request.nextUrl.searchParams.get("week")?.trim() || "";
  const week = rawWeek === "" ? null : Number(rawWeek);
  if ((!gameId && week == null) || (gameId && gameId.length > 120) || (week != null && (!Number.isInteger(week) || week < 0 || week > 30))) {
    return NextResponse.json({ error: "A valid game or week is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const select = "id,commence_time,home_team,away_team,home_logo_url,away_logo_url,current_spread_team,current_spread";
    let games: CfbModelGame[] = [];

    if (gameId) {
      const { data, error } = await supabase.from("games").select(select).eq("id", gameId).eq("league", "CFB").abortSignal(AbortSignal.timeout(5_000)).maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "This college football matchup could not be found." }, { status: 404 });
      games = [data as CfbModelGame];
    } else {
      const { data, error } = await supabase.from("games").select(select).eq("league", "CFB").eq("week", week!).order("commence_time", { ascending: true }).limit(100).abortSignal(AbortSignal.timeout(8_000));
      if (error) throw error;
      games = (data || []) as CfbModelGame[];
    }

    if (!games.length) {
      const headers = { "Cache-Control": "private, no-store" };
      return gameId ? NextResponse.json(null, { headers }) : NextResponse.json({ week, games: [] }, { headers });
    }

    const earliestSeason = Math.min(...games.map(game => cfbSeasonForDate(game.commence_time)));
    const latestKickoff = games.map(game => game.commence_time).sort().at(-1)!;
    const { data: history, error: historyError } = await supabase.from("games")
      .select("commence_time,home_team,away_team,final_home_score,final_away_score")
      .eq("league", "CFB")
      .gte("commence_time", `${earliestSeason}-08-01T00:00:00Z`)
      .lt("commence_time", latestKickoff)
      .not("final_home_score", "is", null)
      .not("final_away_score", "is", null)
      .order("commence_time", { ascending: true })
      .limit(1500)
      .abortSignal(AbortSignal.timeout(8_000));
    if (historyError) throw historyError;
    const completedGames = (history || []) as CfbCompletedGame[];

    const seasons = Array.from(new Set(games.map(game => cfbSeasonForDate(game.commence_time))));
    const dates = Array.from(new Set(games.map(game => isoDateKey(game.commence_time))));
    const snapshotKeys = Array.from(new Map(games.map(game => {
      const season = cfbSeasonForDate(game.commence_time);
      const throughWeek = Math.max(0, officialCfbWeek(game.commence_time) - 1);
      return [`${season}:${throughWeek}`, { season, throughWeek }] as const;
    })).entries());

    const [ratingEntries, feiEntries, masseyEntries, snapshotEntries] = await Promise.all([
      Promise.all(seasons.map(async season => [season, await loadRatings(season)] as const)),
      Promise.all(seasons.map(async season => [
        season,
        await loadFei(season, games.filter(game => cfbSeasonForDate(game.commence_time) === season))
      ] as const)),
      Promise.all(dates.map(async dateKey => [
        dateKey,
        await loadMasseyDate(dateKey, games.filter(game => isoDateKey(game.commence_time) === dateKey))
      ] as const)),
      Promise.all(snapshotKeys.map(async ([key, value]) => [
        key,
        await loadStoredCfbSnapshot(value.season, value.throughWeek).catch(() => null)
      ] as const))
    ]);

    const ratingBundles = new Map(ratingEntries);
    const feiBySeason = new Map(feiEntries);
    const masseyByDate = new Map(masseyEntries);
    const snapshots = new Map(snapshotEntries);

    const resultRatingsByDate = new Map<string, { srs: Map<string, number>; elo: Map<string, number> }>();
    for (const dateKey of dates) {
      const dateGames = games.filter(game => isoDateKey(game.commence_time) === dateKey);
      const cutoff = dateGames.map(game => game.commence_time).sort()[0];
      resultRatingsByDate.set(dateKey, {
        srs: buildResultsSrsRatings(completedGames, cutoff),
        elo: buildResultsEloRatings(completedGames, cutoff)
      });
    }

    const projections = games.map(game => {
      const season = cfbSeasonForDate(game.commence_time);
      const dateKey = isoDateKey(game.commence_time);
      const throughWeek = Math.max(0, officialCfbWeek(game.commence_time) - 1);
      const bundle = ratingBundles.get(season) || { fetchedAt: new Date().toISOString(), sources: [] };
      const feiRows = feiBySeason.get(season) || [];
      const masseyRows = masseyByDate.get(dateKey) || new Map<string, number>();
      const snapshot = snapshots.get(`${season}:${throughWeek}`) || null;
      const resultRatings = resultRatingsByDate.get(dateKey) || { srs: new Map<string, number>(), elo: new Map<string, number>() };

      const officialPairs = bundle.sources.map(source => pairForSource(game, source));
      const usedIds = new Set(officialPairs.filter(pair => pair.homeRating != null && pair.awayRating != null).map(pair => pair.id));
      const fallbacks = fallbackPairs(game, usedIds, snapshot, resultRatings.srs, resultRatings.elo);
      const validPairs = [...officialPairs, ...fallbacks].filter((pair, index, all) =>
        pair.homeRating != null && pair.awayRating != null &&
        all.findIndex(other => other.id === pair.id && other.homeRating != null && other.awayRating != null) === index
      );

      const direct: CfbDirectProjection[] = [];
      const fei = feiRows.find(row => row.id === `fei:${game.id}`);
      if (fei) direct.push({ id: "fei", label: "FEI", homeSpread: fei.homeSpread });
      const massey = masseyRows.get(game.id);
      if (massey != null) direct.push({ id: "massey", label: "Massey", homeSpread: massey });

      return buildCfbModelProjection(game, validPairs, direct, bundle.fetchedAt);
    });

    const headers = { "Cache-Control": "private, no-store" };
    if (gameId) return NextResponse.json(projections[0] || null, { headers });
    return NextResponse.json({ week, games: projections }, { headers });
  } catch (error) {
    console.error("[cfb-model]", error);
    return NextResponse.json({ error: "Model data is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
