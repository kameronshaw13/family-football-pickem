import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { createAsyncCache } from "@/lib/asyncCache";
import { buildCfbModelProjection, cfbModelTeamKey, cfbSeasonForDate, type CfbModelGame, type CfbRatingPair } from "@/lib/cfbModel";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

type RatingRow = { team?: string; rating?: number | null; fpi?: number | null };
type RatingSource = { id: string; label: string; values: Map<string, number> };
type RatingBundle = { fetchedAt: string; sources: RatingSource[] };

const ratingCache = createAsyncCache<RatingBundle>(10 * 60_000, 4);
export const maxDuration = 30;
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function fetchRatings(path: string, season: number) {
  const key = process.env.CFBD_API_KEY;
  if (!key) throw new Error("CFBD_API_KEY is not configured.");
  const response = await fetch(`https://api.collegefootballdata.com/ratings/${path}?year=${season}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`CFBD ${path} ratings returned ${response.status}.`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload as RatingRow[] : [];
}

function ratingMap(rows: RatingRow[], field: "rating" | "fpi") {
  return new Map(rows.flatMap((row) => {
    const team = String(row.team || "");
    const value = Number(row[field]);
    return team && Number.isFinite(value) ? [[cfbModelTeamKey(team), value] as const] : [];
  }));
}

async function loadRatings(season: number) {
  return ratingCache(String(season), async () => {
    const [sp, fpi, srs] = await Promise.all([
      fetchRatings("sp", season).catch(() => []),
      fetchRatings("fpi", season).catch(() => []),
      fetchRatings("srs", season).catch(() => [])
    ]);
    const sources: RatingSource[] = [
      { id: "sp", label: "SP+", values: ratingMap(sp, "rating") },
      { id: "fpi", label: "FPI", values: ratingMap(fpi, "fpi") },
      { id: "srs", label: "SRS", values: ratingMap(srs, "rating") }
    ].filter(source => source.values.size > 0);
    if (!sources.length) throw new Error("No CFBD model ratings are currently available.");
    return { fetchedAt: new Date().toISOString(), sources };
  });
}

function ratingPairs(game: CfbModelGame, bundle: RatingBundle): CfbRatingPair[] {
  const homeKey = cfbModelTeamKey(game.home_team);
  const awayKey = cfbModelTeamKey(game.away_team);
  return bundle.sources.map(source => ({
    id: source.id,
    label: source.label,
    homeRating: source.values.get(homeKey) ?? null,
    awayRating: source.values.get(awayKey) ?? null
  }));
}

export async function GET(request: NextRequest) {
  const auth = await getProfileFromRequest(request);
  if (!auth.profile) return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status });

  const username = String(auth.profile.username || "").trim().toLowerCase();
  const group = String(request.headers.get("x-pickem-group") || "").trim().toLowerCase();
  if (username !== "kameron" || group !== "shaw-family") {
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
    const select = "id,commence_time,home_team,away_team,current_spread_team,current_spread";
    let games: CfbModelGame[] = [];

    if (gameId) {
      const { data, error } = await supabase.from("games")
        .select(select)
        .eq("id", gameId)
        .eq("league", "CFB")
        .abortSignal(AbortSignal.timeout(5_000))
        .maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "This college football matchup could not be found." }, { status: 404 });
      games = [data as CfbModelGame];
    } else {
      const { data, error } = await supabase.from("games")
        .select(select)
        .eq("league", "CFB")
        .eq("week", week!)
        .order("commence_time", { ascending: true })
        .limit(100)
        .abortSignal(AbortSignal.timeout(8_000));
      if (error) throw error;
      games = (data || []) as CfbModelGame[];
    }

    const bySeason = new Map<number, CfbModelGame[]>();
    for (const game of games) {
      const season = cfbSeasonForDate(game.commence_time);
      bySeason.set(season, [...(bySeason.get(season) || []), game]);
    }

    const projections = [];
    for (const [season, seasonGames] of bySeason) {
      const bundle = await loadRatings(season);
      projections.push(...seasonGames.map(game => buildCfbModelProjection(game, ratingPairs(game, bundle), bundle.fetchedAt)));
    }

    const headers = { "Cache-Control": "private, no-store" };
    if (gameId) return NextResponse.json(projections[0] || null, { headers });
    return NextResponse.json({ week, games: projections }, { headers });
  } catch (error) {
    console.error("[cfb-model]", error);
    return NextResponse.json({ error: "Model ratings are temporarily unavailable. Please try again." }, { status: 503 });
  }
}
