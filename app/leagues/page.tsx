import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LeagueHub from "@/components/LeagueHub";
import { appHomePath, isPickemAppSlug } from "@/lib/appIdentity";

export default async function MyLeaguesPage() {
  // Redirect before sending HTML: no intermediate league home or loading splash.
  const jar = await cookies();
  const session = jar.get("pickem_session")?.value;
  const lastLeague = jar.get("pickem_last_league")?.value;
  if (session && isPickemAppSlug(lastLeague)) redirect(appHomePath(lastLeague));
  // First sign-ins and older installs resolve the first accessible league here.
  return <LeagueHub />;
}
