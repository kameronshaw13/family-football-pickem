import { NextRequest, NextResponse } from "next/server";
import { findEspnLogo, fetchEspnLogoMap } from "@/lib/espnLogos";
import { fetchEspnSchedule, findEspnScheduleMatch, resolveEspnCommenceTime } from "@/lib/espnSchedule";
import { canRefreshSpread, getFootballWeek, getGameLockTime, getSpreadFreezeTime } from "@/lib/lockRules";
import { isEligibleSeasonGame } from "@/lib/seasonRules";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const SPORTS = [
  { key: "americanfootball_nfl", league: "NFL" },
  { key: "americanfootball_ncaaf", league: "CFB" }
] as const;

type OddsEvent = {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;
      outcomes: Array<{ name: string; point?: number; price?: number }>;
    }>;
  }>;
};

type PreparedSport = {
  sport: string;
  eventsReturned: number;
  scheduleMatched: number;
  spreadGames: any[];
  frozenGames: any[];
  snapshots: any[];
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function pickSpread(event: OddsEvent) {
  const preferred = ["draftkings", "fanduel", "betmgm", "caesars", "espnbet", "bovada"];
  const books = [...(event.bookmakers || [])].sort((a, b) => {
    const ai = preferred.includes(a.key) ? preferred.indexOf(a.key) : 999;
    const bi = preferred.includes(b.key) ? preferred.indexOf(b.key) : 999;
    return ai - bi;
  });
  for (const book of books) {
    const market = book.markets.find((m) => m.key === "spreads");
    const withPoints = market?.outcomes.filter((o) => typeof o.point === "number") || [];
    if (withPoints.length >= 2) {
      const outcome = withPoints[0];
      return { team: outcome.name, spread: outcome.point as number, bookmaker: book.title };
    }
  }
  return { team: null, spread: null, bookmaker: null };
}

async function refreshOdds() {
  try {
    const oddsApiKey = process.env.ODDS_API_KEY;
    if (!oddsApiKey) return NextResponse.json({ ok: false, error: "Missing ODDS_API_KEY" }, { status: 500 });

    const supabase = getSupabaseAdmin();
    const startedAt = Date.now();
    const now = new Date();
    const { data: knownGames, error: knownGamesError } = await supabase.from("games").select("id");
    if (knownGamesError) return NextResponse.json({ ok: false, error: "Could not read existing games.", details: knownGamesError.message }, { status: 500 });
    const knownGameIds = new Set((knownGames || []).map((game) => game.id));

    const preparedSports = await Promise.all(SPORTS.map(async (sport): Promise<PreparedSport> => {
      const oddsUrl = new URL(`https://api.the-odds-api.com/v4/sports/${sport.key}/odds`);
      oddsUrl.searchParams.set("apiKey", oddsApiKey);
      oddsUrl.searchParams.set("regions", "us");
      oddsUrl.searchParams.set("markets", "spreads");
      oddsUrl.searchParams.set("oddsFormat", "american");
      oddsUrl.searchParams.set("dateFormat", "iso");

      const [logoMap, oddsResponse] = await Promise.all([
        fetchEspnLogoMap(sport.league),
        fetch(oddsUrl.toString(), { cache: "no-store" })
      ]);
      if (!oddsResponse.ok) {
        const text = await oddsResponse.text();
        throw new Error(`Odds API failed for ${sport.key}: ${text}`);
      }

      const returned = (await oddsResponse.json()) as OddsEvent[];
      const schedule = await fetchEspnSchedule(sport.league, returned.map((event) => event.commence_time));
      const data = returned.flatMap((event) => {
        const scheduleMatch = findEspnScheduleMatch(event, schedule);
        if (!scheduleMatch) return [];
        const officialHomeName = scheduleMatch.swapped ? event.away_team : event.home_team;
        const officialAwayName = scheduleMatch.swapped ? event.home_team : event.away_team;
        const officialGame = {
          event,
          scheduleMatch,
          commenceTime: resolveEspnCommenceTime(scheduleMatch, event.commence_time),
          homeTeam: officialHomeName,
          awayTeam: officialAwayName
        };
        return isEligibleSeasonGame({
          league: sport.league,
          commence_time: officialGame.commenceTime,
          home_team: officialGame.homeTeam,
          away_team: officialGame.awayTeam,
          home_logo_url: scheduleMatch.game.homeTeam.logoUrl,
          away_logo_url: scheduleMatch.game.awayTeam.logoUrl
        }) ? [officialGame] : [];
      });

      const spreadGames: any[] = [];
      const frozenGames: any[] = [];
      const snapshots: any[] = [];
      for (const official of data) {
        const { event, scheduleMatch } = official;
        const spread = pickSpread(event);
        if (spread.team == null || spread.spread == null) continue;
        const week = getFootballWeek(official.commenceTime);
        const lockTime = getGameLockTime(official.commenceTime).toISOString();
        const spreadFreezeTime = getSpreadFreezeTime(official.commenceTime).toISOString();
        const isKnownGame = knownGameIds.has(event.id);
        const updateSpread = !isKnownGame || canRefreshSpread(official.commenceTime, now);
        const gameBase = {
          id: event.id,
          week,
          league: sport.league,
          commence_time: official.commenceTime,
          home_team: official.homeTeam,
          away_team: official.awayTeam,
          home_logo_url: scheduleMatch.game.homeTeam.logoUrl || findEspnLogo(official.homeTeam, logoMap),
          away_logo_url: scheduleMatch.game.awayTeam.logoUrl || findEspnLogo(official.awayTeam, logoMap),
          lock_time: lockTime,
          is_locked: now >= new Date(lockTime),
          updated_at: now.toISOString()
        };
        const game = {
          ...gameBase,
          current_spread_team: spread.team,
          current_spread: spread.spread,
          current_bookmaker: spread.bookmaker
        };

        if (updateSpread) {
          spreadGames.push(game);
          snapshots.push({
            game_id: event.id,
            league: sport.league,
            spread_team: spread.team,
            spread: spread.spread,
            bookmaker: spread.bookmaker,
            raw: {
              ...event,
              official_schedule_id: scheduleMatch.game.id,
              official_commence_time: official.commenceTime,
              spread_freeze_time: spreadFreezeTime
            }
          });
        } else {
          frozenGames.push(gameBase);
        }
      }

      return {
        sport: sport.key,
        eventsReturned: returned.length,
        scheduleMatched: data.length,
        spreadGames,
        frozenGames,
        snapshots
      };
    }));

    const spreadGames = preparedSports.flatMap((result) => result.spreadGames);
    const frozenGames = preparedSports.flatMap((result) => result.frozenGames);
    const gameWrites = [
      spreadGames.length
        ? supabase.from("games").upsert(spreadGames, { onConflict: "id" })
        : Promise.resolve({ error: null }),
      frozenGames.length
        ? supabase.from("games").upsert(frozenGames, { onConflict: "id" })
        : Promise.resolve({ error: null })
    ];
    const gameWriteResults = await Promise.all(gameWrites);
    const gameWriteError = gameWriteResults.find((result) => result.error)?.error;
    if (gameWriteError) {
      return NextResponse.json({
        ok: false,
        error: "Supabase upsert into games failed. Did you run supabase/schema.sql?",
        details: gameWriteError.message
      }, { status: 500 });
    }

    const snapshots = preparedSports.flatMap((result) => result.snapshots);
    if (snapshots.length) {
      const { error: snapshotError } = await supabase.from("odds_snapshots").insert(snapshots);
      if (snapshotError) {
        return NextResponse.json({
          ok: false,
          error: "Supabase insert into odds snapshots failed.",
          details: snapshotError.message
        }, { status: 500 });
      }
    }

    const sportResults = preparedSports.map((result) => ({
      sport: result.sport,
      eventsReturned: result.eventsReturned,
      scheduleMatched: result.scheduleMatched,
      eventsImported: result.scheduleMatched,
      spreadsUpdated: result.spreadGames.length
    }));

    return NextResponse.json({
      ok: true,
      gamesUpdated: spreadGames.length,
      creditsEstimated: SPORTS.length,
      durationMs: Date.now() - startedAt,
      sportResults
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return unauthorized();
  return refreshOdds();
}
