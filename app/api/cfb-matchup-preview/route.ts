import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { loadMatchup, loadMatchupHistory, type MatchupGame } from "@/lib/cfbMatchup";

const requests = new Map<string, { count: number; resetsAt: number }>();
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const auth = await getProfileFromRequest(request);
  if (!auth.profile) return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status });
  const now = Date.now();
  for (const [id, entry] of requests) if (entry.resetsAt <= now) requests.delete(id);
  const userId = String(auth.profile.id);
  const entry = requests.get(userId) || { count: 0, resetsAt: now + 60_000 };
  if (entry.count >= 30) return NextResponse.json({ error: "Please wait a moment before opening another preview." }, { status: 429, headers: { "Retry-After": "60" } });
  entry.count += 1;
  if (requests.size >= 1000 && !requests.has(userId)) requests.delete(requests.keys().next().value!);
  requests.set(userId, entry);
  const gameId = request.nextUrl.searchParams.get("gameId");
  const section = request.nextUrl.searchParams.get("section") || "matchup";
  if (!gameId || gameId.length > 120 || !["matchup", "history"].includes(section)) {
    return NextResponse.json({ error: "A valid game and preview section are required." }, { status: 400 });
  }
  try {
    const { data: game, error } = await getSupabaseAdmin().from("games")
      .select("id,league,week,commence_time,home_team,away_team,home_logo_url,away_logo_url,current_spread_team,current_spread,final_home_score,final_away_score")
      .eq("id", gameId).eq("league", "CFB").abortSignal(AbortSignal.timeout(5_000)).maybeSingle();
    if (error) throw error;
    if (!game) return NextResponse.json({ error: "This college football matchup could not be found." }, { status: 404 });
    const payload = section === "history" ? await loadMatchupHistory(game as MatchupGame) : await loadMatchup(game as MatchupGame);
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Matchup data is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
