import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfileFromRequest } from "@/lib/authServer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { passwordResetSchema } from "@/lib/passwordReset";
import { hashPassword, verifyPassword } from "@/lib/passwords";

export const maxDuration = 15;

export async function POST(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const body = passwordResetSchema.parse(await req.json());
    const supabase = getSupabaseAdmin();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id,password_hash")
      .eq("id", auth.profile.id)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!profile) return NextResponse.json({ ok: false, error: "Profile not found." }, { status: 404 });
    if (verifyPassword(body.newPassword, profile.password_hash)) {
      return NextResponse.json({ ok: false, error: "Choose a different password." }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ password_hash: hashPassword(body.newPassword), updated_at: new Date().toISOString() })
      .eq("id", auth.profile.id);

    if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "Choose a new password between 6 and 128 characters." }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
