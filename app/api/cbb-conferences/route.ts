import { NextResponse } from "next/server";
import { cbbConferenceName, cbbConferenceTier, type CbbConferenceMap } from "@/lib/cbbConferences";

export const dynamic = "force-dynamic";
export const revalidate = 0;

let cached: { at: number; data: CbbConferenceMap } | null = null;
let inflight: Promise<CbbConferenceMap> | null = null;
const TTL = 12 * 60 * 60 * 1000;

async function fetchJson(url: string) {
  const response = await fetch(url, {
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(7000)
  });
  if (!response.ok) throw new Error("ESPN college conference lookup unavailable");
  return response.json();
}
function hrefOf(item: any) {
  return String(item?.$ref || item?.href || item?.url || item?.team?.$ref || "");
}
function idFromReference(href: string, resource: "groups" | "teams"): string | null {
  return href.match(new RegExp("/" + resource + "/(\\d+)(?:[/?#]|$)"))?.[1] || null;
}
async function build() {
  const year = new Date().getUTCMonth() >= 7 ? new Date().getUTCFullYear() + 1 : new Date().getUTCFullYear();
  const base = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/seasons/${year}/types/2/groups`;
  const groups = await fetchJson(`${base}/50/children?limit=100&lang=en&region=us`);
  const ids = Array.from(new Set<string>((Array.isArray(groups?.items) ? groups.items : [])
    .map((item: any) => idFromReference(hrefOf(item), "groups"))
    .filter((id: unknown): id is string => typeof id === "string" && !!id)));
  if (!ids.length) throw new Error("No current ESPN basketball conferences");
  const teamConference: Record<string, string> = {};
  const conferenceOptions: CbbConferenceMap["conferences"] = [];
  // Keep requests bounded. One ESPN group and one membership list per conference,
  // cached at the edge for a day; changing league does not trigger this lookup.
  for (let start = 0; start < ids.length; start += 8) {
    const batch = ids.slice(start, start + 8);
    const results = await Promise.allSettled(batch.map(async (id) => {
      const [group, teams] = await Promise.all([
        fetchJson(`${base}/${id}?lang=en&region=us`),
        fetchJson(`${base}/${id}/teams?limit=200&lang=en&region=us`)
      ]);
      const name = String(group?.name || group?.shortName || group?.abbreviation || "").trim();
      if (!name) return null;
      const conference = cbbConferenceName(name);
      const members = (Array.isArray(teams?.items) ? teams.items : [])
        .map((item: any) => idFromReference(hrefOf(item), "teams"))
        .filter((member: unknown): member is string => typeof member === "string" && !!member);
      return { conference, members };
    }));
    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const { conference, members } = result.value;
      conferenceOptions.push({ value: conference, label: conference, category: cbbConferenceTier(conference) });
      for (const member of members) teamConference[member] = conference;
    }
  }
  if (Object.keys(teamConference).length < 80) throw new Error("Incomplete ESPN college conference directory");
  return { teams: teamConference, conferences: conferenceOptions.sort((a, b) => a.label.localeCompare(b.label)) };
}

export async function GET() {
  try {
    if (cached && Date.now() - cached.at < TTL) return NextResponse.json({ ...cached.data, available: true });
    if (!inflight) inflight = build().finally(() => { inflight = null; });
    const data = await inflight;
    cached = { at: Date.now(), data };
    return NextResponse.json({ ...data, available: true });
  } catch {
    if (cached) return NextResponse.json({ ...cached.data, available: true, stale: true });
    return NextResponse.json({ teams: {}, conferences: [], available: false }, { status: 503 });
  }
}
