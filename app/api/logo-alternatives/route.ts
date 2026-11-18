import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** A school-specific source is returned only after the provider page identifies the exact school. */
export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const sport = req.nextUrl.searchParams.get("league") || "";
  const name = req.nextUrl.searchParams.get("name")?.slice(0, 90) || "";
  if (!["CFB", "CBB", "NBA", "NFL"].includes(sport) || !/^[\w \-'.&()]+$/.test(name))
    return NextResponse.json({ ok: false, options: [] }, { status: 400 });
  const slug = slugify(name);
  if (!slug) return NextResponse.json({ ok: true, options: [] });

  try {
    const url = "https://www.footylogos.com/logos/" + slug;
    const page = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(6500) });
    if (!page.ok) return NextResponse.json({ ok: true, options: [] });
    const html = await page.text();
    const title = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]*>/g, "").trim() || "";
    // Do not treat a generic error/search page as a matching logo.
    const normalizedTitle = normalize(title).replace(/^la(?=[a-z])/, "losangeles");
    const normalizedName = normalize(name).replace(/^la(?=[a-z])/, "losangeles");
    if (!normalizedTitle.startsWith(normalizedName + "logo"))
      return NextResponse.json({ ok: true, options: [] });
    const asset = "https://www.footylogos.com/sports-assets/logos/" + slug + "/" + slug + "-logo-footylogos.svg";
    const options = [{ label: "FootyLogos vector", url: asset, source: "FootyLogos" }];
    const paths = [...html.matchAll(/(?:href|src)=["'](\/sports-assets\/variants\/[a-z0-9-]+\/[a-z0-9-]+\.svg)["']/gi)];
    for (const found of paths) {
      const pathname = found[1];
      if (!pathname.startsWith("/sports-assets/variants/" + slug + "/")) continue;
      const url = "https://www.footylogos.com" + pathname;
      if (!options.some(option => option.url === url)) {
        options.push({ label: "FootyLogos alternate " + options.length, url, source: "FootyLogos" });
      }
      if (options.length >= 7) break;
    }
    return NextResponse.json({ ok: true, options }, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch {
    return NextResponse.json({ ok: true, options: [] });
  }
}
