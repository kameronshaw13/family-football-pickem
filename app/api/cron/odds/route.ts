import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getFootballWeek, getGameLockTime } from "@/lib/lockRules";

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
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function pickSpread(event: OddsEvent) {
  const preferred = ["draftkings", "fanduel", "betmgm", "caesars", "espnbet", "bovada"];
  const books = [...(event.bookmakers || [])].sort((a, b) => preferred.indexOf(a.key) - preferred.indexOf(b.key));
  for (const book of books) {
    const market = book.markets.find((m) => m.key === "spreads");
    const withPoints = market?.outcomes.filter((o) => typeof o.point === "number") || [];
    if (withPoints.length >= 2) {
      // Store the team whose listed point value came from the book. The opposite team is -point.
      const outcome = withPoints[0];
      return { team: outcome.name, spread: outcome.point as number, bookmaker: book.title };
    }
  }
  return { team: null, spread: null, bookmaker: null };
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return unauthorized();
  if (!process.env.ODDS_API_KEY) return NextResponse.json({ error: "Missing ODDS_API_KEY" }, { status: 500 });

  const supabase = getSupabaseAdmin();
  const inserted: any[] = [];

  for (const sport of SPORTS) {
    const url = new URL(`https://api.the-odds-api.com/v4/sports/${sport.key}/odds`);
    url.searchParams.set("apiKey", process.env.ODDS_API_KEY);
    url.searchParams.set("regions", "us");
    url.searchParams.set("markets", "spreads");
    url.searchParams.set("oddsFormat", "american");
    url.searchParams.set("dateFormat", "iso");

    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: `Odds API failed for ${sport.key}`, details: text }, { status: 502 });
    }

    const data = (await response.json()) as OddsEvent[];
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
        current_spread_team: spread.team,
        current_spread: spread.spread,
        current_bookmaker: spread.bookmaker,
        lock_time: lockTime,
        is_locked: new Date() >= new Date(lockTime),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from("games").upsert(game, { onConflict: "id" });
      if (error) throw error;

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

  return NextResponse.json({ ok: true, gamesUpdated: inserted.length, creditsEstimated: SPORTS.length });
}
