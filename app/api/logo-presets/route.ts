import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { validLogoUrl, type LogoEra } from "@/lib/logoStudio";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PRESETS: LogoEra[] = ["modern", "vintage"];
const safeKey = /^(?:cbs|ncaa|nba|nfl|guid):[a-z0-9_-]{1,90}$/i;
type Logos = Record<string, string>;
function validatedLogos(input: unknown): Logos | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const entries = Object.entries(input);
  if (entries.length > 3000) return null;
  const result: Logos = Object.create(null);
  for (const [key, value] of entries) {
    if (!safeKey.test(key) || typeof value !== "string" || !validLogoUrl(value)) return null;
    result[key] = value;
  }
  return result;
}
const canPublish = (username: unknown) => String(username || "").trim().toLowerCase() === "kameron";

export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const admin = getSupabaseAdmin();
  const [rows, profile] = await Promise.all([
    admin.from("logo_studio_presets").select("era,logos,updated_at"),
    admin.from("profiles").select("logo_era").eq("id", auth.profile.id).maybeSingle()
  ]);
  if (rows.error || profile.error)
    return NextResponse.json({ ok: false, error: "Logo preferences unavailable." }, { status: 503 });
  const presets: Record<LogoEra, Logos> = { modern: {}, vintage: {} };
  for (const row of rows.data || []) {
    if (!PRESETS.includes(row.era)) continue;
    presets[row.era as LogoEra] = validatedLogos(row.logos) || {};
  }
  return NextResponse.json({
    ok: true, presets, era: profile.data?.logo_era === "vintage" ? "vintage" : "modern",
    canEdit: canPublish(auth.profile.username)
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  if (!canPublish(auth.profile.username))
    return NextResponse.json({ ok: false, error: "Only the logo collection editor can publish team artwork." }, { status: 403 });

  let payload: { era?: string; logos?: unknown };
  try { payload = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 }); }
  if (!PRESETS.includes(payload.era as LogoEra))
    return NextResponse.json({ ok: false, error: "Invalid logo collection." }, { status: 400 });
  const logos = validatedLogos(payload.logos);
  if (!logos) return NextResponse.json({ ok: false, error: "Invalid team logo selection." }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("logo_studio_presets").upsert({
    era: payload.era, logos, updated_by: auth.profile.id, updated_at: new Date().toISOString()
  }, { onConflict: "era" });
  if (error)
    return NextResponse.json({ ok: false, error: "Could not save logos. Please retry." }, { status: 503 });
  return NextResponse.json({ ok: true, era: payload.era, logos, count: Object.keys(logos).length }, {
    headers: { "Cache-Control": "private, no-store" }
  });
}
