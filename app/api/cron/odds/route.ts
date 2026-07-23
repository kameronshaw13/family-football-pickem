import { NextRequest, NextResponse } from "next/server";
import { findEspnLogo, fetchEspnLogoMap } from "@/lib/espnLogos";
import { canRefreshSpread, getFootballWeek, getGameLockTime, getSpreadFreezeTime } from "@/lib/lockRules";
import { isEligibleRegularSeasonGame } from "@/lib/seasonRules";
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
    if (!process.env.ODDS_API_KEY) return NextResponse.json({ ok: false, error: "Missing ODDS_API_KEY" }, { status: 500 });

    const supabase = getSupabaseAdmin();
    const inserted: any[] = [];
    const now = new Date();
    const { data: knownGames, error: knownGamesError } = await supabase.from("games").select("id");
    if (knownGamesError) return NextResponse.json({ ok: false, error: "Could not read existing games.", details: knownGamesError.message }, { status: 500 });
    const knownGameIds = new Set((knownGames || []).map((game) => game.id));
    const sportResults: Array<{ sport: string; eventsReturned: number; eventsImported: number; spreadsUpdated: number }> = [];

    for (const sport of SPORTS) {
      const logoMap = await fetchEspnLogoMap(sport.league);
      const oddsUrl = new URL(`https://api.the-odds-api.com/v4/sports/${sport.key}/odds`);
      oddsUrl.searchParams.set("apiKey", process.env.ODDS_API_KEY);
      oddsUrl.searchParams.set("regions", "us");
      oddsUrl.searchParams.set("markets", "spreads");
      oddsUrl.searchParams.set("oddsFormat", "american");
      oddsUrl.searchParams.set("dateFormat", "iso");

      const oddsResponse = await fetch(oddsUrl.toString(), { cache: "no-store" });
      if (!oddsResponse.ok) {
        const text = await oddsResponse.text();
        return NextResponse.json({ ok: false, error: `Odds API failed for ${sport.key}`, details: text }, { status: 502 });
      }

      const returned = (await oddsResponse.json()) as OddsEvent[];
      const data = returned.filter((event) => isEligibleRegularSeasonGame({
        league: sport.league,
        commence_time: event.commence_time,
        home_team: event.home_team,
        away_team: event.away_team
      }));
      let spreadsUpdated = 0;
      for (const event of data) {
        const spread = pickSpread(event);
        if (spread.team == null || spread.spread == null) continue;
        const week = getFootballWeek(event.commence_time);
        const lockTime = getGameLockTime(event.commence_time).toISOString();
        const spreadFreezeTime = getSpreadFreezeTime(event.commence_time).toISOString();
        const isKnownGame = knownGameIds.has(event.id);
        const updateSpread = !isKnownGame || canRefreshSpread(event.commence_time, now);
        const gameBase = {
          id: event.id,
          week,
          league: sport.league,
          commence_time: event.commence_time,
          home_team: event.home_team,
          away_team: event.away_team,
          home_logo_url: findEspnLogo(event.home_team, logoMap),
          away_logo_url: findEspnLogo(event.away_team, logoMap),
          lock_time: lockTime,
          is_locked: now >= new Date(lockTime),
          updated_at: now.toISOString()
        };
        const game = updateSpread || !isKnownGame ? {
          ...gameBase,
          current_spread_team: spread.team,
          current_spread: spread.spread,
          current_bookmaker: spread.bookmaker
        } : gameBase;

        const { error } = updateSpread || !isKnownGame
          ? await supabase.from("games").upsert(game, { onConflict: "id" })
          : await supabase.from("games").update(gameBase).eq("id", event.id);
        if (error) return NextResponse.json({ ok: false, error: "Supabase upsert into games failed. Did you run supabase/schema.sql?", details: error.message }, { status: 500 });
        knownGameIds.add(event.id);

        if (updateSpread) {
          await supabase.from("odds_snapshots").insert({
            game_id: event.id,
            league: sport.league,
            spread_team: spread.team,
            spread: spread.spread,
            bookmaker: spread.bookmaker,
            raw: { ...event, spread_freeze_time: spreadFreezeTime }
          });
          spreadsUpdated++;
          inserted.push(game);
        }
      }
      sportResults.push({ sport: sport.key, eventsReturned: returned.length, eventsImported: data.length, spreadsUpdated });
    }

    return NextResponse.json({ ok: true, gamesUpdated: inserted.length, creditsEstimated: SPORTS.length, sportResults });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return unauthorized();
  return refreshOdds();
}
