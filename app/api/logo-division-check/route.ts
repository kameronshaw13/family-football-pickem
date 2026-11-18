import { NextResponse } from "next/server";
import { parseDivisionOneTeams } from "@/lib/d1LogoDirectory";
export const dynamic = "force-dynamic";
export async function GET() {
  const probes = [
    ["mbb groups=50","https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?groups=50&limit=500"],
    ["mbb group=50","https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?group=50&limit=500"],
    ["mbb groups=1","https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?groups=1&limit=500"],
    ["cfb groups=90","https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams?groups=90&limit=500"],
    ["cfb group=90","https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams?group=90&limit=500"],
    ["mbb group=50 max=400","https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?groups=50&limit=400"]
  ];
  const results = await Promise.all(probes.map(async ([label, url]) => {
    try {
      const response = await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(8500)});
      const json = await response.json();
      const entries = parseDivisionOneTeams(json);
      return {label,status:response.status,count:entries.length,
        includesAdams:entries.some(t=>t.name.includes("Adams State")),
        includesAdrian:entries.some(t=>t.name.includes("Adrian Bulldogs")),
        includesWichita:entries.some(t=>t.name.includes("Wichita State")),
        keys:Object.keys(json),sample:entries.slice(0,2).map(t=>t.name)
      };
    } catch(e) { return {label,error:e instanceof Error?e.message:String(e)}; }
  }));
  return NextResponse.json({results});
}
