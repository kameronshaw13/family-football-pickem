import "server-only";
import webPush, { WebPushError, type PushSubscription } from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { notificationTeamName } from "@/lib/notificationTeamName";
import { countUnreadNotifications, type NotificationCounts, type NotificationDestination } from "@/lib/notificationCounts";

export type { NotificationCounts, NotificationDestination } from "@/lib/notificationCounts";
export type NotificationType = "side_bet_offer" | "side_bet_response" | "pick_final" | "league_pick_final" | "side_bet_final" | "big_play" | "dog_pick_adjustment";

type NotificationInput = {
  userId: string;
  groupId?: string;
  type: NotificationType;
  destination: NotificationDestination;
  entityId: string;
  dedupeKey: string;
  title: string;
  body: string;
  url: string;
  actionRequired?: boolean;
};

type PushPayload = { title: string; body: string; url: string; tag: string; badgeCount: number };

export function pushConfiguration() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || "";
  const subject = process.env.VAPID_SUBJECT?.trim() || "";
  return { publicKey, privateKey, subject, configured: Boolean(publicKey && privateKey && subject) };
}

export async function getNotificationCounts(supabase: SupabaseClient, userId: string, groupId?: string): Promise<NotificationCounts> {
  let query = supabase.from("notifications").select("destination,action_required,read_at,resolved_at").eq("user_id", userId).is("resolved_at", null);
  if (groupId) query = query.eq("group_id", groupId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return countUnreadNotifications(data || []);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deliverPush(supabase: SupabaseClient, userId: string, payload: Omit<PushPayload, "badgeCount">, groupId?: string) {
  const config = pushConfiguration();
  if (!config.configured) return { sent: 0, configured: false };
  let subscriptionQuery = supabase.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", userId);
  if (groupId) subscriptionQuery = subscriptionQuery.eq("group_id", groupId);
  const { data: subscriptions, error } = await subscriptionQuery;
  if (error) throw new Error(error.message);
  if (!subscriptions?.length) return { sent: 0, configured: true };
  const counts = await getNotificationCounts(supabase, userId, groupId);
  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  let sent = 0;
  await Promise.all(subscriptions.map(async (row) => {
    const subscription: PushSubscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await webPush.sendNotification(subscription, JSON.stringify({ ...payload, badgeCount: counts.total }), { TTL: 60 * 60 * 24, urgency: "high", timeout: 10_000 });
        sent += 1;
        return;
      } catch (error) {
        if (error instanceof WebPushError && [404, 410].includes(error.statusCode)) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
          return;
        }
        if (attempt === 0) {
          await sleep(300);
          continue;
        }
        console.error("Push delivery failed after retry", error);
      }
    }
  }));
  return { sent, configured: true };
}

async function inferGroupId(supabase: SupabaseClient, input: NotificationInput) {
  if (input.groupId) return input.groupId;
  if (["pick_final", "league_pick_final", "dog_pick_adjustment"].includes(input.type)) {
    const { data } = await supabase.from("picks").select("group_id").eq("id", input.entityId).maybeSingle();
    if (data?.group_id) return data.group_id as string;
  }
  if (["side_bet_offer", "side_bet_response", "side_bet_final"].includes(input.type)) {
    const { data } = await supabase.from("side_bets").select("group_id").eq("id", input.entityId).maybeSingle();
    if (data?.group_id) return data.group_id as string;
  }
  const { data } = await supabase.from("pickem_groups").select("id").eq("is_default", true).maybeSingle();
  if (!data?.id) throw new Error("No Pick'em group is available for this notification.");
  return data.id as string;
}

async function normalizedBody(supabase: SupabaseClient, input: NotificationInput) {
  if (!["side_bet_offer", "side_bet_response", "side_bet_final"].includes(input.type)) return input.body;
  const { data } = await supabase.from("side_bets").select("game:games(league)").eq("id", input.entityId).maybeSingle();
  const league = (data as any)?.game?.league as string | undefined;
  const match = input.body.match(/^(.*?)(Pick'em|[+-]\d+(?:\.\d+)?)$/);
  if (!match) return input.body;
  const left = match[1].trimEnd();
  const spread = match[2];
  const dividerIndex = left.lastIndexOf("·");
  const prefix = dividerIndex >= 0 ? `${left.slice(0, dividerIndex + 1)} ` : "";
  const team = (dividerIndex >= 0 ? left.slice(dividerIndex + 1) : left).trim();
  return `${prefix}${notificationTeamName(team, league)} ${spread}`;
}

export async function createNotification(supabase: SupabaseClient, input: NotificationInput) {
  const groupId = await inferGroupId(supabase, input);
  const body = await normalizedBody(supabase, input);
  const { data, error } = await supabase.from("notifications").upsert({
    group_id: groupId,
    user_id: input.userId,
    type: input.type,
    destination: input.destination,
    entity_id: input.entityId,
    dedupe_key: input.dedupeKey,
    title: input.title,
    body,
    url: input.url,
    action_required: Boolean(input.actionRequired)
  }, { onConflict: "group_id,user_id,dedupe_key", ignoreDuplicates: true }).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { created: false, sent: 0 };
  const delivery = await deliverPush(supabase, input.userId, { title: input.title, body, url: input.url, tag: input.dedupeKey.slice(0, 64) }, groupId);
  return { created: true, sent: delivery.sent };
}

export async function createNotificationSafely(supabase: SupabaseClient, input: NotificationInput) {
  try { return await createNotification(supabase, input); }
  catch (error) { console.error("Notification creation failed", error); return { created: false, sent: 0 }; }
}

export function createNotificationInBackground(supabase: SupabaseClient, input: NotificationInput) {
  waitUntil(createNotificationSafely(supabase, input).then(() => undefined));
}

export async function resolveSideBetOfferNotifications(supabase: SupabaseClient, sideBetIds: string[], userId?: string, groupId?: string) {
  if (!sideBetIds.length) return;
  let query = supabase.from("notifications").update({ resolved_at: new Date().toISOString() }).eq("type", "side_bet_offer").in("entity_id", sideBetIds).is("resolved_at", null);
  if (userId) query = query.eq("user_id", userId);
  if (groupId) query = query.eq("group_id", groupId);
  const { error } = await query;
  if (error) console.error("Could not resolve side bet notifications", error);
}

export async function sendTestPush(supabase: SupabaseClient, userId: string, groupId?: string) {
  return deliverPush(supabase, userId, { title: "Family Pick'em notifications are live", body: "You will receive pick and side-bet updates even when the app is closed.", url: "/?notification=my_card", tag: `test-${Date.now()}` }, groupId);
}
