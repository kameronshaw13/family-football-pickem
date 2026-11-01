import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { requestedGroupFromRequest, resolveGroupContext, isGameAllowedForGroup } from "@/lib/groupContext";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { espnSportPath } from "@/lib/sportPaths";
import { isBasketballLeague } from "@/lib/basketballRules";
import { basketballForm, basketballResults } from "@/lib/basketballPreviewData";
import { basketballSeasonYear, fetchBasketballTeamSeason } from "@/lib/basketballPreviewServer";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ error: auth.error }, { status: auth.status, headers });
  try {
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    const id = req.nextUrl.searchParams.get("gameId"), history = req.nextUrl.searchParams.get("view") === "history";
    if (!id || id.length > 120) return NextResponse.json({ error: "Choose a valid game." }, { status: 400, headers });
    const { data: game, error } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!game || !isBasketballLeague(game.league) || !isGameAllowedForGroup(context, game)) return NextResponse.json({ error: "Game not found." }, { status: 404, headers });
    const summaryResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnSportPath(game.league)}/summary?event=${encodeURIComponent(game.espn_event_id)}`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(8000) });
    if (!summaryResponse.ok) throw new Error("Matchup information is temporarily unavailable.");
    const summary = await summaryResponse.json();
    const competitors = summary.header?.competitions?.[0]?.competitors || [];
    const awayId = String(competitors.find((row: any) => row.homeAway === "away")?.team?.id || "");
    const homeId = String(competitors.find((row: any) => row.homeAway === "home")?.team?.id || "");
    if (!awayId || !homeId) throw new Error("Team information is temporarily unavailable.");
    const year = basketballSeasonYear(game.commence_time);
    const cutoff = Math.min(Date.now(), Date.parse(game.commence_time));
    if (history) {
      const all: any[] = [];
      let complete = true;
      // Bounded batches keep provider traffic modest and history comfortably within the route budget.
      for (let offset = 0; offset < 8; offset += 4) {
        const requests = [year - offset, year - offset - 1, year - offset - 2, year - offset - 3].flatMap(season => [2, 3].map(type => fetchBasketballTeamSeason(game.league, awayId, season, type)));
        const results = await Promise.allSettled(requests);
        for (const result of results) {
          if (result.status === "fulfilled") all.push(...result.value);
          else complete = false;
        }
      }
      const games = basketballResults(all, awayId, cutoff).filter(row => row.opponentId === homeId).slice(0, 10);
      return NextResponse.json({ games, complete, firstSeason: year - 7, lastSeason: year }, { headers });
    }
    const requests = [awayId, homeId].flatMap(team => [2, 3].map(type => fetchBasketballTeamSeason(game.league, team, year, type)));
    const results = await Promise.allSettled(requests);
    const eventsFor = (start: number) => results.slice(start, start + 2).flatMap(result => result.status === "fulfilled" ? result.value : []);
    if (results.slice(0, 2).every(result => result.status === "rejected") || results.slice(2).every(result => result.status === "rejected")) throw new Error("Season results are temporarily unavailable.");
    const awayEvents = eventsFor(0), homeEvents = eventsFor(2);
    const eventIds = [...new Set([...awayEvents, ...homeEvents].map(event => String(event.id)))];
    const { data: lines, error: lineError } = eventIds.length ? await supabase.from("games").select("id,espn_event_id,home_team,away_team,current_spread_team,current_spread")
      .eq("league", game.league).in("espn_event_id", eventIds).order("updated_at", { ascending: false }).range(0, 999) : { data: [], error: null };
    if (lineError) throw lineError;
    return NextResponse.json({
      year, complete: results.every(result => result.status === "fulfilled"),
      teams: {
        away: basketballForm(awayId, game.away_team, game.away_logo_url, basketballResults(awayEvents, awayId, cutoff, lines || [])),
        home: basketballForm(homeId, game.home_team, game.home_logo_url, basketballResults(homeEvents, homeId, cutoff, lines || []))
      }
    }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load matchup." }, { status: 503, headers });
  }
}
