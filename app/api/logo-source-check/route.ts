import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const urls = [
    "https://www.sportslogos.net/teams/list_by_league/35/NCAA-Division-I-u-z-Logos/NCAA-u-z-Logos/",
    "https://www.sportslogos.net/logos/list_by_team/911/Wichita-State-Shockers-Logos/",
    "https://www.sportslogos.net/logos/view/91183601948/Wichita-State-Shockers-Logo/1948/Primary-Logo",
    "https://content.sportslogos.net/logos/35/911/full/wichita_state_shockers_logo_primary_1948_sportslogosnet-8360.png",
    "https://content.sportslogos.net/logos/35/911/full/wichita_state_shockers_logo_primary_19641336.png"
  ];
  const checks = await Promise.all(urls.map(async url => {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; FamilyPickemLogoStudio/1.0)", Referer: "https://www.sportslogos.net/" },
        redirect: "manual", signal: AbortSignal.timeout(4500), cache: "no-store"
      });
      const type = response.headers.get("content-type");
      const body = (await response.text()).slice(0, 200000);
      return {
        url, status: response.status, type, length: body.length,
        teamLinks: [...body.matchAll(/\/logos\/list_by_team\/\d+\/[a-z0-9-]+/gi)].slice(0, 3).map(x => x[0]),
        detailLinks: [...body.matchAll(/\/logos\/view\/[a-z0-9]+\/[a-z0-9-]+\/(?:19|20)\d{2}\/[a-z-]+/gi)].slice(0, 3).map(x => x[0]),
        logoAssets: [...body.matchAll(/https:\/\/content\.sportslogos\.net\/logos\/\d+\/\d+\/full\/[^\s"']+\.(?:png|gif|webp|jpg)/gi)].slice(0, 4).map(x=>x[0])
      };
    } catch(e) { return { url, error: e instanceof Error ? e.name + ": " + e.message : "fetch failed" }; }
  }));
  return NextResponse.json({ checks }, { headers: { "Cache-Control": "no-store" } });
}
