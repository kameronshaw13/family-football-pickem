import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfileFromRequest } from "@/lib/authServer";
import { requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { getNotificationCounts, pushConfiguration, sendTestPush, type NotificationDestination } from "@/lib/notifications";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

const destinationSchema = z.enum(["side_bets_received", "side_bets_sent", "my_card", "league_cards", "side_bet_ledger"]);
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("subscribe"), subscription: z.object({ endpoint: z.string().url(), expirationTime: z.number().nullable().optional(), keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }) }), userAgent: z.string().max(500).optional() }),
  z.object({ action: z.literal("unsubscribe"), endpoint: z.string().url() }),
  z.object({ action: z.literal("read"), destination: destinationSchema }),
  z.object({ action: z.literal("resolveDogAdjustments"), ids: z.array(z.string().uuid()).min(1).max(20) }),
  z.object({ action: z.literal("test") })
]);
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

async function pendingDogAdjustments(supabase: ReturnType<typeof getSupabaseAdmin>, userId: string, groupId: string) {
  const { data, error } = await supabase.from("notifications").select("id,title,body,created_at").eq("group_id", groupId).eq("user_id", userId).eq("type", "dog_pick_adjustment").eq("action_required", true).is("resolved_at", null).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

async function responseState(supabase: ReturnType<typeof getSupabaseAdmin>, userId: string, groupId: string) {
  const [counts, dogAdjustments] = await Promise.all([getNotificationCounts(supabase, userId, groupId), pendingDogAdjustments(supabase, userId, groupId)]);
  const config = pushConfiguration();
  return { counts, dogAdjustments, configured: config.configured, publicKey: config.configured ? config.publicKey : "" };
}

export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status, headers: NO_STORE_HEADERS });
  try {
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    return NextResponse.json({ ok: true, ...(await responseState(supabase, auth.profile.id, context.group.id)) }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function POST(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status, headers: NO_STORE_HEADERS });
  try {
    const body = bodySchema.parse(await req.json());
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));

    if (body.action === "subscribe") {
      const now = new Date().toISOString();
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: auth.profile.id,
        group_id: context.group.id,
        endpoint: body.subscription.endpoint,
        p256dh: body.subscription.keys.p256dh,
        auth: body.subscription.keys.auth,
        user_agent: body.userAgent || null,
        updated_at: now
      }, { onConflict: "endpoint" });
      if (error) throw new Error(error.message);

      // One installed subscription per user per Pick'em app. Re-enabling notifications
      // replaces any stale endpoint rather than accumulating another delivery target.
      const { error: pruneError } = await supabase.from("push_subscriptions")
        .delete()
        .eq("user_id", auth.profile.id)
        .eq("group_id", context.group.id)
        .neq("endpoint", body.subscription.endpoint);
      if (pruneError) throw new Error(pruneError.message);
    }
    if (body.action === "unsubscribe") {
      // Turning notifications off clears every stored endpoint for this user/app so a
      // later re-enable always starts clean with exactly one subscription.
      const { error } = await supabase.from("push_subscriptions")
        .delete()
        .eq("user_id", auth.profile.id)
        .eq("group_id", context.group.id);
      if (error) throw new Error(error.message);
    }
    if (body.action === "read") {
      const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("group_id", context.group.id).eq("user_id", auth.profile.id).eq("destination", body.destination as NotificationDestination).is("read_at", null).is("resolved_at", null);
      if (error) throw new Error(error.message);
    }
    if (body.action === "resolveDogAdjustments") {
      const now = new Date().toISOString();
      const { error } = await supabase.from("notifications").update({ read_at: now, resolved_at: now }).eq("group_id", context.group.id).eq("user_id", auth.profile.id).eq("type", "dog_pick_adjustment").in("id", body.ids).is("resolved_at", null);
      if (error) throw new Error(error.message);
    }
    let testResult: Awaited<ReturnType<typeof sendTestPush>> | null = null;
    if (body.action === "test") testResult = await sendTestPush(supabase, auth.profile.id, context.group.id);
    return NextResponse.json({ ok: true, ...(await responseState(supabase, auth.profile.id, context.group.id)), testResult }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
