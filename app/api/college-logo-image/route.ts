import { NextRequest, NextResponse } from "next/server";
import { isCollegeHistoricalImage } from "@/lib/collegeLogoImage";

export const dynamic = "force-dynamic";
const MAX_IMAGE_BYTES = 850_000;

// Public image endpoint, but it only forwards a narrowly validated NCAA archive path.
// Never proxy arbitrary hosts, redirects, oversized media, HTML, or SVG scripts.
export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("src") || "";
  if (!isCollegeHistoricalImage(src)) return new NextResponse(null, { status: 400 });
  try {
    const result = await fetch(src, {
      headers: {
        "Accept": "image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8",
        "Referer": "https://www.sportslogos.net/",
        "User-Agent": "Mozilla/5.0 (compatible; FamilyPickemLogoStudio/1.0)"
      },
      redirect: "manual",
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(6500)
    });
    if (!result.ok || Number(result.headers.get("content-length") || 0) > MAX_IMAGE_BYTES)
      return new NextResponse(null, { status: 404 });
    const bytes = new Uint8Array(await result.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return new NextResponse(null, { status: 404 });
    let kind = "";
    if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
      kind = "image/png";
    else if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
      kind = "image/jpeg";
    else if (bytes.length > 6 && String.fromCharCode(...bytes.slice(0, 3)) === "GIF")
      kind = "image/gif";
    else if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP")
      kind = "image/webp";
    if (!kind) return new NextResponse(null, { status: 404 });
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": kind,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800"
      }
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
