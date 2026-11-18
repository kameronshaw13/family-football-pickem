import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PUT(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  let payload: { era?: string };
  try { payload = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 }); }
  if (payload.era !== "modern" && payload.era !== "vintage")
    return NextResponse.json({ ok: false, error: "Invalid logo style." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("profiles")
    .update({ logo_era: payload.era })
    .eq("id", auth.profile.id);
  if (error) return NextResponse.json({ ok: false, error: "Could not save your logo style." }, { status: 503 });
  return NextResponse.json({ ok: true, era: payload.era }, { headers: { "Cache-Control": "private, no-store" } });
}
