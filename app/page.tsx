import PickemApp from "@/components/PickemApp";
import { demoGames, demoProfiles, demoPicks } from "@/lib/demoData";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export default async function Home() {
  let games = demoGames;
  let profiles = demoProfiles;
  let picks = demoPicks;
  let productionMode = false;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = getSupabaseAdmin();
      const [{ data: dbGames }, { data: dbProfiles }, { data: dbPicks }] = await Promise.all([
        supabase.from("games").select("*").order("commence_time", { ascending: true }),
        supabase.from("profiles").select("*").order("display_name", { ascending: true }),
        supabase.from("picks").select("*, game:games(*), profile:profiles(*)")
      ]);
      if (dbGames?.length) games = dbGames as any;
      if (dbProfiles?.length) profiles = dbProfiles as any;
      if (dbPicks) picks = dbPicks as any;
      productionMode = true;
    } catch {
      productionMode = false;
    }
  }

  return <PickemApp initialGames={games} initialProfiles={profiles} initialPicks={picks} productionMode={productionMode} />;
}
