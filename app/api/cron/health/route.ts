import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

function masked(value?: string) {
  if (!value) return { present: false };
  return { present: true, startsWith: value.slice(0, 8), length: value.length };
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized. CRON_SECRET is missing or does not match." }, { status: 401 });
  }

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: masked(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: masked(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: masked(process.env.SUPABASE_SERVICE_ROLE_KEY),
    ODDS_API_KEY: masked(process.env.ODDS_API_KEY),
    CRON_SECRET: masked(process.env.CRON_SECRET),
    APP_TIMEZONE: process.env.APP_TIMEZONE || null
  };

  const checks: any = { env };

  try {
    const supabase = getSupabaseAdmin();
    const { error: gamesError, count: gamesCount } = await supabase.from("games").select("id", { count: "exact", head: true });
    const { error: snapshotsError, count: snapshotsCount } = await supabase.from("odds_snapshots").select("id", { count: "exact", head: true });
    const { error: picksError, count: picksCount } = await supabase.from("picks").select("id", { count: "exact", head: true });

    checks.supabase = {
      connected: !gamesError && !snapshotsError && !picksError,
      games: gamesError ? { ok: false, error: gamesError.message } : { ok: true, count: gamesCount },
      odds_snapshots: snapshotsError ? { ok: false, error: snapshotsError.message } : { ok: true, count: snapshotsCount },
      picks: picksError ? { ok: false, error: picksError.message } : { ok: true, count: picksCount }
    };
  } catch (error) {
    checks.supabase = {
      connected: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }

  const ok =
    env.NEXT_PUBLIC_SUPABASE_URL.present &&
    env.SUPABASE_SERVICE_ROLE_KEY.present &&
    env.ODDS_API_KEY.present &&
    checks.supabase?.connected;

  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 500 });
}
