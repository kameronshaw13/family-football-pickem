import { NextRequest, NextResponse } from "next/server";
import { lockDuePicks } from "@/lib/lockDuePicks";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized. CRON_SECRET is missing or does not match." }, { status: 401 });
}

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return unauthorized();

    const supabase = getSupabaseAdmin();
    const result = await lockDuePicks(supabase);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Lock route crashed.", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
