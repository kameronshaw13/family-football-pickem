import { NextResponse } from "next/server";
import { loadHistoricCollegeImages } from "@/lib/collegeVintageLogos";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (new URL(request.url).searchParams.has("sample")) {
    const examples = await Promise.all(["Wichita State Shockers", "UC Riverside Highlanders", "Kansas Jayhawks", "Indiana Hoosiers", "Tulsa Golden Hurricane"].map(async team => {
      try {
        const logos = await loadHistoricCollegeImages(team);
        return { team, found: logos.length, examples: logos.slice(0, 5) };
      } catch(error) { return { team, error: error instanceof Error ? error.message : "unknown" }; }
    }));
    return NextResponse.json({ examples });
  }
  const urls = [
    "https://sportslogohistory.com/wichita-state-shockers-primary-logo/",
    "https://sportslogohistory.com/uc-riverside-highlanders-primary-logo/",
    "https://commons.wikimedia.org/w/api.php?action=query%26generator=search%26gsrsearch=old%20UC%20Riverside%20Highlanders%20logo%26gsrnamespace=6%26gsrlimit=5%26prop=imageinfo%26iiprop=url%26format=json",
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
      const body = (await response.text()).slice(0, 650000);
      return {
        url, status: response.status, type, length: body.length,
        wpImages: [...body.matchAll(/https?:[^"'<>\s]+wp-content\/uploads\/[^"'<>\s]+\.(?:png|webp|jpg|jpeg)/gi)].slice(0,20).map(x=>x[0].slice(0,260)),
        htmlImg: [...body.matchAll(/<img\b[^>]*>/gi)].slice(0,25).map(x=>x[0].slice(0,400)),
        around1948: body.includes("1948") ? body.slice(Math.max(0,body.indexOf("1948")-500),body.indexOf("1948")+600) : null,
        teamLinks: [...body.matchAll(/\/logos\/list_by_team\/\d+\/[a-z0-9-]+/gi)].slice(0, 3).map(x => x[0]),
        detailLinks: [...body.matchAll(/\/logos\/view\/[a-z0-9]+\/[a-z0-9-]+\/(?:19|20)\d{2}\/[a-z-]+/gi)].slice(0, 3).map(x => x[0]),
        logoAssets: [...body.matchAll(/https:\/\/content\.sportslogos\.net\/logos\/\d+\/\d+\/full\/[^\s"']+\.(?:png|gif|webp|jpg)/gi)].slice(0, 4).map(x=>x[0])
      };
    } catch(e) { return { url, error: e instanceof Error ? e.name + ": " + e.message : "fetch failed" }; }
  }));
  return NextResponse.json({ checks }, { headers: { "Cache-Control": "no-store" } });
}
