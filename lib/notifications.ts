import "server-only";
import webPush, { WebPushError, type PushSubscription } from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { notificationTeamName } from "@/lib/notificationTeamName";
import { notificationMoney } from "@/lib/notificationMoney";
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

type PushDeliveryResult = {
  sent: number;
  configured: boolean;
  subscriptions: number;
  error: string | null;
};

type NotificationDeliveryRow = {
  id: string;
  user_id: string;
  group_id: string | null;
  title: string;
  body: string;
  url: string;
  dedupe_key: string;
  push_sent_at?: string | null;
  push_attempts?: number | null;
};

function pushErrorText(error: unknown) {
  const value = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return value.slice(0, 1000);
}

async function deliverPush(supabase: SupabaseClient, userId: string, payload: Omit<PushPayload, "badgeCount">, groupId?: string): Promise<PushDeliveryResult> {
  const config = pushConfiguration();
  if (!config.configured) return { sent: 0, configured: false, subscriptions: 0, error: "Push delivery is not configured." };
  let subscriptionQuery = supabase.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", userId);
  if (groupId) subscriptionQuery = subscriptionQuery.eq("group_id", groupId);
  const { data: subscriptions, error } = await subscriptionQuery;
  if (error) throw new Error(error.message);
  if (!subscriptions?.length) return { sent: 0, configured: true, subscriptions: 0, error: "No active push subscription." };
  const counts = await getNotificationCounts(supabase, userId, groupId);
  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  let sent = 0;
  const failures: string[] = [];

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
          failures.push("Push subscription expired and was removed.");
          return;
        }
        if (attempt === 0) {
          await sleep(300);
          continue;
        }
        const message = pushErrorText(error);
        failures.push(message);
        console.error("Push delivery failed after retry", error);
      }
    }
  }));

  return {
    sent,
    configured: true,
    subscriptions: subscriptions.length,
    error: sent > 0 ? null : (failures[0] || "Push provider did not confirm delivery.")
  };
}

async function deliverNotificationPush(supabase: SupabaseClient, row: NotificationDeliveryRow) {
  if (row.push_sent_at) return { sent: 0, alreadySent: true, error: null as string | null };
  const attemptAt = new Date().toISOString();
  const nextAttempts = Number(row.push_attempts || 0) + 1;
  const attemptUpdate = await supabase.from("notifications").update({
    push_attempts: nextAttempts,
    push_last_attempt_at: attemptAt
  }).eq("id", row.id);
  if (attemptUpdate.error) throw new Error(attemptUpdate.error.message);

  const delivery = await deliverPush(
    supabase,
    row.user_id,
    { title: row.title, body: row.body, url: row.url, tag: row.dedupe_key.slice(0, 64) },
    row.group_id || undefined
  );

  const deliveryUpdate: Record<string, unknown> = {
    push_last_error: delivery.sent > 0 ? null : delivery.error
  };
  if (delivery.sent > 0) deliveryUpdate.push_sent_at = new Date().toISOString();
  const update = await supabase.from("notifications").update(deliveryUpdate).eq("id", row.id);
  if (update.error) throw new Error(update.error.message);

  return { sent: delivery.sent, alreadySent: false, error: delivery.error };
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

function normalizeSideBetMoneySegment(segment: string) {
  const standalone = segment.match(/^(\d+(?:\.\d{1,2})?)$/);
  if (standalone) return notificationMoney(Number(standalone[1]));
  return segment
    .replace(/\bRisk\s+\$?(\d+(?:\.\d{1,2})?)/g, (_match, value) => `Risk ${notificationMoney(Number(value))}`)
    .replace(/\bto win\s+\$?(\d+(?:\.\d{1,2})?)/g, (_match, value) => `to win ${notificationMoney(Number(value))}`)
    .replace(/\b(Won|Lost|Pushed)\s+\$?(\d+(?:\.\d{1,2})?)/g, (_match, label, value) => `${label} ${notificationMoney(Number(value))}`);
}

function normalizeSideBetMarketSegment(segment: string, league?: string) {
  const trimmed = segment.trim();
  const marketPrefix = trimmed.startsWith("Market ") ? "Market " : "";
  const core = marketPrefix ? trimmed.slice("Market ".length) : trimmed;
  const match = core.match(/^(.*?)\s+(ML|Pick'em|[+-]\d+(?:\.\d+)?)(?:\s+([+-]\d+))?$/);
  if (!match) return trimmed;
  const [, team, line, odds] = match;
  const oddsText = odds && Math.abs(Number(odds)) !== 100 ? ` ${odds}` : "";
  return `${marketPrefix}${notificationTeamName(team.trim(), league)} ${line}${oddsText}`;
}

async function normalizedBody(supabase: SupabaseClient, input: NotificationInput) {
  if (!["side_bet_offer", "side_bet_response", "side_bet_final"].includes(input.type)) return input.body;
  const { data } = await supabase.from("side_bets").select("game:games(league)").eq("id", input.entityId).maybeSingle();
  const league = (data as any)?.game?.league as string | undefined;
  const parts = input.body.split(" · ").map((part) => part.trim()).filter(Boolean);
  const normalized: string[] = [];

  for (const rawPart of parts) {
    const part = normalizeSideBetMoneySegment(rawPart);
    const standaloneOdds = part.match(/^[+-]\d+$/);
    const previous = normalized.at(-1);
    const previousIsMarket = Boolean(previous && /(?:ML|Pick'em|[+-]\d+(?:\.\d+)?)(?:\s+[+-]\d+)?$/.test(previous));
    if (standaloneOdds && previousIsMarket) {
      if (Math.abs(Number(part)) !== 100) normalized[normalized.length - 1] = `${previous} ${part}`;
      continue;
    }
    normalized.push(normalizeSideBetMarketSegment(part, league));
  }

  return normalized.join(" · ");
}

export async function createNotification(supabase: SupabaseClient, input: NotificationInput) {
  const groupId = await inferGroupId(supabase, input);
  const body = await normalizedBody(supabase, input);
  const selectFields = "id,user_id,group_id,title,body,url,dedupe_key,push_sent_at,push_attempts";
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
  }, { onConflict: "group_id,user_id,dedupe_key", ignoreDuplicates: true }).select(selectFields).maybeSingle();
  if (error) throw new Error(error.message);

  let row = data as NotificationDeliveryRow | null;
  const created = Boolean(row);
  if (!row) {
    const existing = await supabase.from("notifications")
      .select(selectFields)
      .eq("group_id", groupId)
      .eq("user_id", input.userId)
      .eq("dedupe_key", input.dedupeKey)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    row = existing.data as NotificationDeliveryRow | null;
  }
  if (!row) return { created: false, sent: 0 };
  if (row.push_sent_at) return { created, sent: 0 };

  const delivery = await deliverNotificationPush(supabase, row);
  return { created, sent: delivery.sent };
}

export async function createNotificationSafely(supabase: SupabaseClient, input: NotificationInput) {
  try { return await createNotification(supabase, input); }
  catch (error) { console.error("Notification creation failed", error); return { created: false, sent: 0 }; }
}

export function createNotificationInBackground(supabase: SupabaseClient, input: NotificationInput) {
  waitUntil(createNotificationSafely(supabase, input).then(() => undefined));
}

export async function retryPendingPushNotifications(supabase: SupabaseClient, limit = 40) {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from("notifications")
    .select("id,user_id,group_id,title,body,url,dedupe_key,push_sent_at,push_attempts")
    .is("push_sent_at", null)
    .is("read_at", null)
    .is("resolved_at", null)
    .lt("push_attempts", 5)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = (data || []) as NotificationDeliveryRow[];
  let sent = 0;
  let failed = 0;
  for (let index = 0; index < rows.length; index += 8) {
    const batch = rows.slice(index, index + 8);
    const outcomes = await Promise.all(batch.map(async (row) => {
      try {
        return await deliverNotificationPush(supabase, row);
      } catch (error) {
        console.error("Push retry failed", error);
        return { sent: 0, alreadySent: false, error: pushErrorText(error) };
      }
    }));
    sent += outcomes.reduce((sum, outcome) => sum + Number(outcome.sent || 0), 0);
    failed += outcomes.filter((outcome) => !outcome.sent && !outcome.alreadySent).length;
  }

  return { attempted: rows.length, sent, failed };
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
