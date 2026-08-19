import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfileFromRequest } from "@/lib/authServer";
import { GROUP_COOKIE, listActiveGroupsForProfile, requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const switchSchema = z.object({ group: z.string().min(1) });

function groupResponse(groups: Awaited<ReturnType<typeof listActiveGroupsForProfile>>, context: Awaited<ReturnType<typeof resolveGroupContext>>) {
  return {
    ok: true,
    groups,
    activeGroup: context.group,
    activeSeason: { year: context.seasonYear, status: context.seasonStatus, rules: context.rules }
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const supabase = getSupabaseAdmin();
    const [groups, context] = await Promise.all([
      listActiveGroupsForProfile(supabase, auth.profile.id),
      resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req))
    ]);
    return NextResponse.json(groupResponse(groups, context), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const body = switchSchema.parse(await req.json());
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, body.group);
    const groups = await listActiveGroupsForProfile(supabase, auth.profile.id);
    const response = NextResponse.json(groupResponse(groups, context), { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(GROUP_COOKIE, context.group.slug, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365
    });
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
