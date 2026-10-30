"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientSessionToken, clearClientSession } from "@/lib/clientSession";
import { lastVisitedLeague } from "@/lib/lastLeague";
import { appHomePath } from "@/lib/appIdentity";
import { preferredLeagueForLaunch, type LeagueMembership } from "@/lib/leagueAccess";

type LeagueLookup = {
  ok: boolean;
  leagues?: LeagueMembership[];
  error?: string;
};

/** Launch resolver only: league selection now lives entirely inside Settings. */
export default function LeagueHub() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getClientSessionToken();
    if (!token) {
      router.replace("/leagues/login");
      return;
    }

    // Existing installs may have the last league in localStorage but not yet
    // in the server redirect cookie. Respect that before doing a fresh lookup.
    try {
      const profile = JSON.parse(window.localStorage.getItem("pickem_profile") || "null") as { id?: string } | null;
      const remembered = profile?.id ? lastVisitedLeague(profile.id) : null;
      if (remembered) {
        router.replace(appHomePath(remembered));
        return;
      }
    } catch {
      // Fall back to current membership order.
    }

    const controller = new AbortController();
    void fetch("/api/my-leagues", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal
    }).then(async (response) => {
      if (controller.signal.aborted) return;
      if (response.status === 401) {
        clearClientSession();
        router.replace("/leagues/login");
        return;
      }
      const payload = await response.json() as LeagueLookup;
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not load your leagues.");
      const destination = preferredLeagueForLaunch(payload.leagues || [], null);
      if (destination) router.replace(destination.homePath);
      else setError("No active leagues are assigned to this account.");
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not open your league.");
    });
    return () => controller.abort();
  }, [router]);

  return <main className="league-launch" role="status" aria-label="Opening your league">
    {error && <div className="league-launch-error"><p>{error}</p><a href="/leagues/login">Return to sign in</a></div>}
  </main>;
}
