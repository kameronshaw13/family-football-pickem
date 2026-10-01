import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const schema = z.object({
  email: z.literal("commissioner.demo@pickem.test"),
  password: z.string().min(8).max(128)
});

export async function POST(req: NextRequest) {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not available in production." }, { status: 404 });
  }

  try {
    const body = schema.parse(await req.json());
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: "Demo Commissioner" }
    });

    if (error && !/already|registered|exists/i.test(error.message)) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, userId: data.user?.id || null });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
