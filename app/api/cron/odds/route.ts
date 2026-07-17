import { NextRequest, NextResponse } from "next/server";
import { findEspnLogo, fetchEspnLogoMap } from "@/lib/espnLogos";
import { getProfileFromRequest } from "@/lib/authServer";
import { getFootballWeek, getGameLockTime } from "@/lib/lockRules";
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
    const sportResults: Array<{ sport: string; eventsReturned: number; eventsImported: number }> = [];

    for (const sport of SPORTS) {
      const logoMap = await fetchEspnLogoMap(sport.league);
      const url = new URL(`https://api.the-odds-api.com/v4/sports/${sport.key}/odds`);
      url.searchParams.set("apiKey", process.env.ODDS_API_KEY);
      url.searchParams.set("regions", "us");
      url.searchParams.set("markets", "spreads");
      url.searchParams.set("oddsFormat", "american");
      url.searchParams.set("dateFormat", "iso");

      const response = await fetch(url.toString(), { cache: "no-store" });
      if (!response.ok) {
        const text = await response.text();
        return NextResponse.json({ ok: false, error: `Odds API failed for ${sport.key}`, details: text }, { status: 502 });
      }

      const returned = (await response.json()) as OddsEvent[];
      const data = returned.filter((event) => isEligibleRegularSeasonGame({
        league: sport.league,
        commence_time: event.commence_time,
        home_team: event.home_team,
        away_team: event.away_team
      }));
      sportResults.push({ sport: sport.key, eventsReturned: returned.length, eventsImported: data.length });
      for (const event of data) {
        const spread = pickSpread(event);
        const week = getFootballWeek(event.commence_time);
        const lockTime = getGameLockTime(event.commence_time).toISOString();
        const game = {
          id: event.id,
          week,
          league: sport.league,
          commence_time: event.commence_time,
          home_team: event.home_team,
          away_team: event.away_team,
          home_logo_url: findEspnLogo(event.home_team, logoMap),
          away_logo_url: findEspnLogo(event.away_team, logoMap),
          current_spread_team: spread.team,
          current_spread: spread.spread,
          current_bookmaker: spread.bookmaker,
          lock_time: lockTime,
          is_locked: new Date() >= new Date(lockTime),
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from("games").upsert(game, { onConflict: "id" });
        if (error) return NextResponse.json({ ok: false, error: "Supabase upsert into games failed. Did you run supabase/schema.sql?", details: error.message }, { status: 500 });

        await supabase.from("odds_snapshots").insert({
          game_id: event.id,
          league: sport.league,
          spread_team: spread.team,
          spread: spread.spread,
          bookmaker: spread.bookmaker,
          raw: event
        });
        inserted.push(game);
      }
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

export async function POST(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  if (!auth.profile.is_admin) return NextResponse.json({ ok: false, error: "Admin only." }, { status: 403 });
  return refreshOdds();
}
