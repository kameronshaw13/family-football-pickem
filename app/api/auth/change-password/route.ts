import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfileFromRequest } from "@/lib/authServer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { hashPassword, verifyPassword } from "@/lib/passwords";

export const maxDuration = 15;

const schema = z.object({
  currentPassword: z.string().min(6).max(128),
  newPassword: z.string().min(6).max(128)
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const supabase = getSupabaseAdmin();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id,password_hash")
      .eq("id", auth.profile.id)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!profile?.password_hash || !verifyPassword(body.currentPassword, profile.password_hash)) {
      return NextResponse.json({ ok: false, error: "Current password is incorrect." }, { status: 401 });
    }
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
      return NextResponse.json({ ok: false, error: "Enter your current password and a new password with at least 6 characters." }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
