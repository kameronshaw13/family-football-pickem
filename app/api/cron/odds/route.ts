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
  return NextResponse.json({ ok: false, error: "Unauthorized. CRON_SECRET is missing or does not match." }, { status: 401 });
}

function pickSpread(event: OddsEvent) {
  const preferred = ["draftkings", "fanduel", "betmgm", "caesars", "espnbet", "bovada"];
  const books = [...(event.bookmakers || [])].sort((a, b) => {
    const ai = preferred.indexOf(a.key);
    const bi = preferred.indexOf(b.key);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
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

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return unauthorized();
    if (!process.env.ODDS_API_KEY) return NextResponse.json({ ok: false, error: "Missing ODDS_API_KEY" }, { status: 500 });

    const supabase = getSupabaseAdmin();
    const inserted: any[] = [];
    const sportResults: any[] = [];

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
        return NextResponse.json({ ok: false, error: `Odds API failed for ${sport.key}`, status: response.status, details: text }, { status: 502 });
      }

      const data = (await response.json()) as OddsEvent[];
      sportResults.push({ sport: sport.key, eventsReturned: data.length });

      for (const event of data) {
        const spread = pickSpread(event);
        const week = getFootballWeek(event.commence_time);
        const lockTime = getGameLockTime(event.commence_time).toISOString();
        const now = new Date();
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
          is_locked: now >= new Date(lockTime),
          updated_at: now.toISOString()
        };

        const { error } = await supabase.from("games").upsert(game, { onConflict: "id" });
        if (error) return NextResponse.json({ ok: false, error: "Supabase upsert into games failed. Did you run the latest supabase/schema.sql?", details: error.message }, { status: 500 });

        const { error: snapshotError } = await supabase.from("odds_snapshots").insert({
          game_id: event.id,
          league: sport.league,
          spread_team: spread.team,
          spread: spread.spread,
          bookmaker: spread.bookmaker,
          raw: event
        });
        if (snapshotError) return NextResponse.json({ ok: false, error: "Supabase insert into odds_snapshots failed.", details: snapshotError.message }, { status: 500 });

        inserted.push(game);
      }
    }

    return NextResponse.json({ ok: true, gamesUpdated: inserted.length, creditsEstimated: SPORTS.length, sportResults });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Odds route crashed.", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
