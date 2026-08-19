import "server-only";
import webPush, { WebPushError, type PushSubscription } from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationDestination = "side_bets_received" | "side_bets_sent" | "my_card" | "league_cards" | "side_bet_ledger";
export type NotificationType = "side_bet_offer" | "side_bet_response" | "pick_final" | "league_pick_final" | "side_bet_final" | "big_play";

export type NotificationCounts = Record<NotificationDestination, number> & { total: number };

type NotificationInput = {
  userId: string;
  type: NotificationType;
  destination: NotificationDestination;
  entityId: string;
  dedupeKey: string;
  title: string;
  body: string;
  url: string;
  actionRequired?: boolean;
};

type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
  badgeCount: number;
};

const EMPTY_COUNTS: NotificationCounts = {
  side_bets_received: 0,
  side_bets_sent: 0,
  my_card: 0,
  league_cards: 0,
  side_bet_ledger: 0,
  total: 0
};

export function pushConfiguration() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || "";
  const subject = process.env.VAPID_SUBJECT?.trim() || "";
  return { publicKey, privateKey, subject, configured: Boolean(publicKey && privateKey && subject) };
}

export async function getNotificationCounts(supabase: SupabaseClient, userId: string): Promise<NotificationCounts> {
  const { data, error } = await supabase
    .from("notifications")
    .select("destination,action_required,read_at,resolved_at")
    .eq("user_id", userId)
    .is("resolved_at", null);
  if (error) throw new Error(error.message);

  const counts = { ...EMPTY_COUNTS };
  for (const notification of data || []) {
    if (!notification.action_required && notification.read_at) continue;
    const destination = notification.destination as NotificationDestination;
    if (!(destination in counts)) continue;
    counts[destination] += 1;
    counts.total += 1;
  }
  return counts;
}

async function deliverPush(supabase: SupabaseClient, userId: string, payload: Omit<PushPayload, "badgeCount">) {
  const config = pushConfiguration();
  if (!config.configured) return { sent: 0, configured: false };

  // Most league members will not have every browser/device subscribed. Avoid the
  // unread-count query entirely when there is nowhere to deliver a push.
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!subscriptions?.length) return { sent: 0, configured: true };

  const counts = await getNotificationCounts(supabase, userId);
  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  let sent = 0;
  await Promise.all(subscriptions.map(async (row) => {
    const subscription: PushSubscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth }
    };
    try {
      await webPush.sendNotification(subscription, JSON.stringify({ ...payload, badgeCount: counts.total }), {
        TTL: 60 * 60 * 24,
        urgency: "high",
        timeout: 5_000
      });
      sent += 1;
    } catch (error) {
      if (error instanceof WebPushError && [404, 410].includes(error.statusCode)) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
        return;
      }
      console.error("Push delivery failed", error);
    }
  }));
  return { sent, configured: true };
}

export async function createNotification(supabase: SupabaseClient, input: NotificationInput) {
  const { data, error } = await supabase.from("notifications").upsert({
    user_id: input.userId,
    type: input.type,
    destination: input.destination,
    entity_id: input.entityId,
    dedupe_key: input.dedupeKey,
    title: input.title,
    body: input.body,
    url: input.url,
    action_required: Boolean(input.actionRequired)
  }, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { created: false, sent: 0 };

  const delivery = await deliverPush(supabase, input.userId, {
    title: input.title,
    body: input.body,
    url: input.url,
    tag: input.dedupeKey.slice(0, 64)
  });
  return { created: true, sent: delivery.sent };
}

export async function createNotificationSafely(supabase: SupabaseClient, input: NotificationInput) {
  try {
    return await createNotification(supabase, input);
  } catch (error) {
    console.error("Notification creation failed", error);
    return { created: false, sent: 0 };
  }
}

export async function resolveSideBetOfferNotifications(supabase: SupabaseClient, sideBetIds: string[], userId?: string) {
  if (!sideBetIds.length) return;
  let query = supabase
    .from("notifications")
    .update({ resolved_at: new Date().toISOString() })
    .eq("type", "side_bet_offer")
    .in("entity_id", sideBetIds)
    .is("resolved_at", null);
  if (userId) query = query.eq("user_id", userId);
  const { error } = await query;
  if (error) console.error("Could not resolve side bet notifications", error);
}

export async function sendTestPush(supabase: SupabaseClient, userId: string) {
  return deliverPush(supabase, userId, {
    title: "Family Pick'em notifications are live",
    body: "You will receive pick and side-bet updates even when the app is closed.",
    url: "/?notification=my_card",
    tag: `test-${Date.now()}`
  });
}
