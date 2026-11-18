import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";

const SAFE_HOSTS = new Set([
  "sports.cbsimg.net", "www.ncaa.com", "a.espncdn.com", "secure.espncdn.com",
  "cdn.nba.com", "raw.githubusercontent.com", "www.footylogos.com",
  "content.sportslogos.net", "assets.logocdn.com"
]);
const MAX_BYTES = 750_000;

function allowed(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && SAFE_HOSTS.has(u.hostname)
      && !u.username && !u.password && u.port === "" && url.length < 1300;
  } catch { return false; }
}
function hash(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}
function signature(bytes: Uint8Array, mime: string) {
  if (!mime.includes("svg") && !Buffer.from(bytes).subarray(0, 256).toString().includes("<svg")) return hash(bytes);
  const xml = Buffer.from(bytes).toString("utf8");
  // Same SVG geometry with a different fill/palette is still one design choice.
  const shapes = [...xml.matchAll(/<(path|polygon|polyline|rect|circle|ellipse|line)\b([^>]*?)\/?>/gi)]
    .map(match => {
      const attrs = [...match[2].matchAll(/\b(d|points|x|y|x1|y1|x2|y2|cx|cy|rx|ry|r|width|height)\s*=\s*(["'])(.*?)\2/gi)]
        .map(a => [a[1].toLowerCase(), a[3].replace(/[\s,]+/g, " ").trim()])
        .sort(([a], [b]) => a.localeCompare(b));
      return match[1].toLowerCase() + ":" + JSON.stringify(attrs);
    });
  if (!shapes.length) return hash(bytes);
  const viewBox = xml.match(/\bviewBox\s*=\s*(["'])(.*?)\1/i)?.[2] || "";
  return hash("svg:" + viewBox.replace(/[\s,]+/g, " ").trim() + ":" + shapes.join("|"));
}

export async function POST(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  let urls: unknown;
  try { urls = (await req.json()).urls; } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (!Array.isArray(urls) || urls.length > 25 || urls.some(x => typeof x !== "string" || !allowed(x)))
    return NextResponse.json({ ok: false }, { status: 400 });
  const fingerprints: Record<string, string> = {};
  // Bounded concurrency; only HTTPS paths on explicit logo provider hosts.
  const unique = [...new Set(urls)] as string[];
  for (let i = 0; i < unique.length; i += 5) {
    await Promise.all(unique.slice(i, i + 5).map(async url => {
      try {
        const response = await fetch(url, {
          redirect: "manual", signal: AbortSignal.timeout(4000), next: { revalidate: 86400 }
        });
        if (!response.ok || Number(response.headers.get("content-length") || 0) > MAX_BYTES) return;
        const mime = response.headers.get("content-type")?.toLowerCase() || "";
        if (!mime.startsWith("image/") && !mime.includes("svg") && !mime.includes("octet-stream")) return;
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!bytes.length || bytes.length > MAX_BYTES) return;
        fingerprints[url] = signature(bytes, mime);
      } catch { /* Unavailable artwork remains in the picker as a fallback. */ }
    }));
  }
  return NextResponse.json({ ok: true, fingerprints }, { headers: { "Cache-Control": "private, no-store" } });
}
