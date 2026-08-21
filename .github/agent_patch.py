from pathlib import Path
import re


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one match, found {count}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


def replace_all(path: str, old: str, new: str, minimum: int = 1):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count < minimum:
        raise RuntimeError(f"{path}: expected at least {minimum} matches, found {count}: {old[:100]!r}")
    p.write_text(text.replace(old, new))
    return count


# 1) Push delivery must be scoped to the active Pick'em group.
replace_once(
    "lib/notifications.ts",
    '''  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", userId);
''',
    '''  let subscriptionQuery = supabase
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", userId);
  if (groupId) subscriptionQuery = subscriptionQuery.eq("group_id", groupId);
  const { data: subscriptions, error } = await subscriptionQuery;
'''
)

# 2) Notification subscription CRUD records the group and cannot remove another app's subscription.
replace_once(
    "app/api/notifications/route.ts",
    '''      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: auth.profile.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: body.userAgent || req.headers.get("user-agent"),
        updated_at: new Date().toISOString()
      }, { onConflict: "endpoint" });
''',
    '''      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: auth.profile.id,
        group_id: context.group.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: body.userAgent || req.headers.get("user-agent"),
        updated_at: new Date().toISOString()
      }, { onConflict: "endpoint" });
'''
)
replace_once(
    "app/api/notifications/route.ts",
    '''      const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", auth.profile.id).eq("endpoint", endpoint);
''',
    '''      const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", auth.profile.id).eq("group_id", context.group.id).eq("endpoint", endpoint);
'''
)

# 3) Push controls use a distinct service-worker registration per app and explicit group headers.
p = Path("components/PushNotificationControls.tsx")
text = p.read_text()
text = text.replace('import { Bell, BellOff } from "lucide-react";\n', 'import { Bell, BellOff } from "lucide-react";\nimport type { AppSlug } from "@/lib/rulePresentation";\n')
text = text.replace(
'''function authHeaders() {
  const token = window.localStorage.getItem("pickem_session_token");
  return token ? { Authorization: `Bearer ${token}` } : null;
}
''',
'''function authHeaders(appSlug: AppSlug) {
  const token = window.localStorage.getItem("pickem_session_token");
  return token ? { Authorization: `Bearer ${token}`, "x-pickem-group": appSlug } : null;
}

function workerScope(appSlug: AppSlug) {
  if (appSlug === "friends") return "/friends/";
  if (appSlug === "other-family") return "/caleb-family/";
  return "/";
}

async function appServiceWorkerRegistration(appSlug: AppSlug) {
  const scope = workerScope(appSlug);
  const registration = await navigator.serviceWorker.register("/sw.js", { scope });
  if (registration.active) return registration;
  await navigator.serviceWorker.ready;
  return (await navigator.serviceWorker.getRegistration(scope)) || registration;
}
''')
text = text.replace(
'export default function PushNotificationControls({ onCountsChanged }: { onCountsChanged?: (counts: Record<string, number>) => void }) {',
'export default function PushNotificationControls({ appSlug, onCountsChanged }: { appSlug: AppSlug; onCountsChanged?: (counts: Record<string, number>) => void }) {'
)
text = text.replace('const headers = authHeaders();', 'const headers = authHeaders(appSlug);')
text = text.replace('navigator.serviceWorker.register("/sw.js", { scope: "/" })', 'appServiceWorkerRegistration(appSlug)')
text = text.replace('  }, [onCountsChanged]);', '  }, [appSlug, onCountsChanged]);')
text = text.replace('      const registration = await navigator.serviceWorker.ready;', '      const registration = await appServiceWorkerRegistration(appSlug);')
text = text.replace('      setMessage("Notifications enabled on this device.");', '      setMessage("");')
text = text.replace('      setMessage("Notifications disabled on this device.");', '      setMessage("");')
old_status = '''  const status = state === "enabled" ? "Enabled on this device"
    : state === "denied" ? "Blocked in iPhone Settings"
    : state === "needs-home-screen" ? "Add the app to your Home Screen first"
    : state === "not-configured" ? "Waiting for Vercel push keys"
    : state === "unsupported" ? "Not supported in this browser"
    : state === "checking" ? "Checking this device…"
    : "Off on this device";
'''
new_status = '''  const helper = state === "denied" ? "Blocked in iPhone Settings"
    : state === "needs-home-screen" ? "Add the app to your Home Screen first"
    : state === "not-configured" ? "Waiting for Vercel push keys"
    : state === "unsupported" ? "Not supported in this browser"
    : "";
'''
if old_status not in text:
    raise RuntimeError("PushNotificationControls status block not found")
text = text.replace(old_status, new_status, 1)
text = text.replace('      <p>{status}</p>\n', '      {helper && <p>{helper}</p>}\n')
p.write_text(text)

# 4) Service worker immediately tells an already-open app that data changed and focuses only the matching app on click.
replace_once(
    "public/sw.js",
    '''  const tasks = [self.registration.showNotification(title, options)];
  if ("setAppBadge" in self.navigator) {
    tasks.push(payload.badgeCount > 0 ? self.navigator.setAppBadge(payload.badgeCount) : self.navigator.clearAppBadge());
  }
  event.waitUntil(Promise.all(tasks));
});
''',
    '''  const tasks = [self.registration.showNotification(title, options)];
  tasks.push(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    windows.forEach((client) => client.postMessage({ type: "notification-push", url: payload.url || "/" }));
  }));
  if ("setAppBadge" in self.navigator) {
    tasks.push(payload.badgeCount > 0 ? self.navigator.setAppBadge(payload.badgeCount) : self.navigator.clearAppBadge());
  }
  event.waitUntil(Promise.all(tasks));
});

function appPath(pathname) {
  if (pathname === "/friends" || pathname.startsWith("/friends/")) return "/friends";
  if (pathname === "/caleb-family" || pathname.startsWith("/caleb-family/")) return "/caleb-family";
  return "/";
}
'''
)
replace_once(
    "public/sw.js",
    '''    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
''',
    '''    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const targetApp = appPath(new URL(targetUrl).pathname);
    const existing = windows.find((client) => {
      const clientUrl = new URL(client.url);
      return clientUrl.origin === self.location.origin && appPath(clientUrl.pathname) === targetApp;
    });
'''
)

# 5) Side-bet GET snapshot for live in-app synchronization + idempotent accept/decline.
p = Path("app/api/side-bets/route.ts")
text = p.read_text()
insert_anchor = 'const BodySchema = z.discriminatedUnion("action", [\n'
if insert_anchor not in text:
    raise RuntimeError("side-bets schema anchor missing")
# Add GET after schema closes, using the existing snapshot helper defined below. Locate first occurrence before POST export.
post_anchor = 'export async function POST(req: NextRequest) {'
if post_anchor not in text:
    raise RuntimeError("side-bets POST anchor missing")
get_code = '''export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    const requestedWeek = Number(req.nextUrl.searchParams.get("week"));
    if (!Number.isInteger(requestedWeek) || requestedWeek < 0) {
      return NextResponse.json({ ok: false, error: "A valid week is required." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...(await sideBetSnapshot(supabase, context.group.id, context.seasonYear, requestedWeek)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

'''
text = text.replace(post_anchor, get_code + post_anchor, 1)
# Make accept/decline repeats successful instead of a 409 error screen.
old_guard = '''    if (!target) return NextResponse.json({ ok: false, error: "This offer was not sent to you." }, { status: 403 });
    if (target.response !== "pending" || sideBet.status !== "open") {
      return NextResponse.json({ ok: false, error: "This offer is no longer available." }, { status: 409 });
    }
'''
new_guard = '''    if (!target) return NextResponse.json({ ok: false, error: "This offer was not sent to you." }, { status: 403 });
    if (body.action === "accept" && sideBet.status === "accepted" && sideBet.accepted_by === auth.profile.id) {
      return NextResponse.json({ ok: true, ...(await sideBetSnapshot(supabase, context.group.id, context.seasonYear, viewWeek)) });
    }
    if (body.action === "decline" && target.response === "declined") {
      return NextResponse.json({ ok: true, ...(await sideBetSnapshot(supabase, context.group.id, context.seasonYear, viewWeek)) });
    }
    if (target.response !== "pending" || sideBet.status !== "open") {
      return NextResponse.json({ ok: false, error: "This offer is no longer available." }, { status: 409 });
    }
'''
if old_guard not in text:
    raise RuntimeError("side-bets target guard missing")
text = text.replace(old_guard, new_guard, 1)
p.write_text(text)

# 6) Shared app: explicit group headers, immediate side-bet refresh, correct ordering, push row below rules.
p = Path("components/PickemApp.tsx")
text = p.read_text()
# ordering helper
anchor = '''function pickCardSignature(card: Pick[]) {
  return card
    .map((pick) => `${pick.game_id}:${pick.selected_team}:${pick.pick_type}`)
    .sort()
    .join("|");
}
'''
helper = anchor + '''
function sortCardPicks(picks: Pick[], games: Game[], pointsMode: boolean) {
  return [...picks].sort((a, b) => {
    const dogOrder = Number(a.pick_type === "underdog") - Number(b.pick_type === "underdog");
    if (dogOrder !== 0) return dogOrder;
    if (pointsMode) {
      const confidenceOrder = Number(b.confidence_points || 0) - Number(a.confidence_points || 0);
      if (confidenceOrder !== 0) return confidenceOrder;
    }
    const gameA = games.find((game) => game.id === a.game_id) || a.game;
    const gameB = games.find((game) => game.id === b.game_id) || b.game;
    return new Date(gameA?.commence_time || 0).getTime() - new Date(gameB?.commence_time || 0).getTime();
  });
}
'''
if anchor not in text:
    raise RuntimeError("PickemApp pickCardSignature anchor missing")
text = text.replace(anchor, helper, 1)

# explicit API group header in known shared fetches
text = text.replace('{ headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }', '{ headers: { Authorization: `Bearer ${token}`, "x-pickem-group": appSlug }, cache: "no-store" }')
text = text.replace('headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },', 'headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-pickem-group": appSlug },')
# worker scope
text = text.replace('if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);', 'if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: appSlug === "friends" ? "/friends/" : appSlug === "other-family" ? "/caleb-family/" : "/" }).catch(() => undefined);')

# add lightweight side-bet refresh callback after notification counts callback
counts_anchor = '''  const refreshNotificationCounts = useCallback(async () => {
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) return;
    try {
      const response = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}`, "x-pickem-group": appSlug }, cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      updateNotificationCounts(payload.counts || {});
    } catch {
      // Preserve the last known counts through brief network interruptions.
    }
  }, [updateNotificationCounts]);
'''
refresh_code = counts_anchor.replace('  }, [updateNotificationCounts]);', '  }, [appSlug, updateNotificationCounts]);') + '''
  const refreshSideBets = useCallback(async () => {
    const token = window.localStorage.getItem("pickem_session_token");
    const current = dataRef.current;
    if (!token || !current) return;
    try {
      const response = await fetch(`/api/side-bets?week=${current.week}`, {
        headers: { Authorization: `Bearer ${token}`, "x-pickem-group": appSlug },
        cache: "no-store"
      });
      if (!response.ok) return;
      const payload = await response.json();
      if (!Array.isArray(payload.sideBets)) return;
      setData((latest) => {
        if (!latest || latest.week !== current.week) return latest;
        const nextData = {
          ...latest,
          sideBets: payload.sideBets.map((bet: SideBet) => ({
            ...bet,
            game: latest.games.find((game) => game.id === bet.game_id) || bet.game
          })),
          sideBetSlotCounts: payload.sideBetSlotCounts || latest.sideBetSlotCounts
        };
        dataRef.current = nextData;
        return nextData;
      });
    } catch {
      // Keep current side-bet data through brief network interruptions.
    }
  }, [appSlug]);
'''
if counts_anchor not in text:
    raise RuntimeError("PickemApp refreshNotificationCounts anchor missing")
text = text.replace(counts_anchor, refresh_code, 1)

old_effect = '''  useEffect(() => {
    void refreshNotificationCounts();
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: appSlug === "friends" ? "/friends/" : appSlug === "other-family" ? "/caleb-family/" : "/" }).catch(() => undefined);
    openNotificationDestination(window.location.href);
    const refresh = () => { if (document.visibilityState === "visible") void refreshNotificationCounts(); };
    const receiveClick = (event: MessageEvent<{ type?: string; url?: string }>) => {
      if (event.data?.type === "notification-click" && event.data.url) openNotificationDestination(event.data.url);
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    navigator.serviceWorker?.addEventListener("message", receiveClick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      navigator.serviceWorker?.removeEventListener("message", receiveClick);
    };
  }, [openNotificationDestination, refreshNotificationCounts]);
'''
new_effect = '''  useEffect(() => {
    void refreshNotificationCounts();
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: appSlug === "friends" ? "/friends/" : appSlug === "other-family" ? "/caleb-family/" : "/" }).catch(() => undefined);
    openNotificationDestination(window.location.href);
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void refreshNotificationCounts();
      void refreshSideBets();
    };
    const receiveClick = (event: MessageEvent<{ type?: string; url?: string }>) => {
      if (event.data?.type === "notification-click" && event.data.url) openNotificationDestination(event.data.url);
      if (event.data?.type === "notification-push") refresh();
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    navigator.serviceWorker?.addEventListener("message", receiveClick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      navigator.serviceWorker?.removeEventListener("message", receiveClick);
    };
  }, [appSlug, openNotificationDestination, refreshNotificationCounts, refreshSideBets]);
'''
if old_effect not in text:
    raise RuntimeError("PickemApp notification effect missing")
text = text.replace(old_effect, new_effect, 1)

text = text.replace(
'  const myRegular = cardPicks.filter((p) => p.pick_type === "regular").sort((a, b) => Number(b.confidence_points || 0) - Number(a.confidence_points || 0));',
'  const myRegular = sortCardPicks(cardPicks.filter((p) => p.pick_type === "regular"), viewedGames, pointsMode);'
)
old_league_sort = '''            const playerPicks = viewedPicks
              .filter((pick) => pick.user_id === profile.id)
              .sort((a, b) => Number(a.pick_type === "underdog") - Number(b.pick_type === "underdog") || Number(b.confidence_points || 0) - Number(a.confidence_points || 0));
'''
new_league_sort = '''            const playerPicks = sortCardPicks(
              viewedPicks.filter((pick) => pick.user_id === profile.id),
              viewedGames,
              pointsMode
            );
'''
if old_league_sort not in text:
    raise RuntimeError("PickemApp league card sort missing")
text = text.replace(old_league_sort, new_league_sort, 1)
old_bank_sort = '''    const playerPicks = picks
      .filter((pick) => pick.user_id === row.user_id)
      .sort((a, b) => {
        const typeOrder = Number(a.pick_type === "underdog") - Number(b.pick_type === "underdog");
        if (typeOrder !== 0) return typeOrder;
        const gameA = games.find((game) => game.id === a.game_id) || a.game;
        const gameB = games.find((game) => game.id === b.game_id) || b.game;
        return new Date(gameA?.commence_time || 0).getTime() - new Date(gameB?.commence_time || 0).getTime();
      });
'''
new_bank_sort = '''    const playerPicks = sortCardPicks(
      picks.filter((pick) => pick.user_id === row.user_id),
      games,
      pointsMode
    );
'''
if old_bank_sort not in text:
    raise RuntimeError("PickemApp bank sort missing")
text = text.replace(old_bank_sort, new_bank_sort, 1)

old_rules = '''      {tab === "rules" && <section className="panel rules-panel">
        <div className="section-title"><div><h2>League Rules</h2></div></div>
        <PushNotificationControls onCountsChanged={updateNotificationCounts} />
        <div className="rules-list">
          {displayedRules.map((section) => <RuleItem title={section.title} key={section.title}><ul>{section.items.map((item) => <li key={item}><NumericText text={item} /></li>)}</ul></RuleItem>)}
        </div>
      </section>}
'''
new_rules = '''      {tab === "rules" && <section className="panel rules-panel">
        <div className="section-title"><div><h2>League Rules</h2></div></div>
        <div className="rules-list">
          {displayedRules.map((section) => <RuleItem title={section.title} key={section.title}><ul>{section.items.map((item) => <li key={item}><NumericText text={item} /></li>)}</ul></RuleItem>)}
        </div>
        <PushNotificationControls appSlug={appSlug} onCountsChanged={updateNotificationCounts} />
      </section>}
'''
if old_rules not in text:
    raise RuntimeError("PickemApp rules block missing")
text = text.replace(old_rules, new_rules, 1)

p.write_text(text)

# 7) Make Push Notifications visually match rule headers and sit cleanly after the rule list.
p = Path("app/globals.css")
text = p.read_text()
old_css = '''.notification-settings { display: flex; min-height: 70px; align-items: center; justify-content: space-between; gap: 12px; margin: 0 calc(var(--page-gutter) * -1) var(--space-3); padding: 10px var(--pick-content-inset); border-block: 1px solid var(--line-strong); background: var(--panel); }
.notification-settings-copy { min-width: 0; flex: 1 1 auto; }
.notification-settings-heading { display: flex; align-items: center; gap: 7px; color: var(--ink); font-size: 13px; font-weight: 800; }
.notification-settings-heading svg { flex: 0 0 auto; color: var(--blue-dark); }
.notification-settings-copy p { margin-top: 3px; color: var(--muted); font-size: 10px; font-weight: 600; line-height: 1.25; }
.notification-settings-copy small { display: block; margin-top: 3px; color: var(--blue-dark); font-size: 9px; font-weight: 700; line-height: 1.25; }
.notification-settings-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 6px; }
.notification-settings-actions .btn { min-height: 34px; padding: 6px 8px; font-size: 10px; }
'''
new_css = '''.notification-settings { display: flex; min-height: 55px; align-items: center; justify-content: space-between; gap: 12px; margin: 0; padding: 6px var(--page-gutter) 6px calc(var(--page-gutter) + 12px); border-bottom: 1px solid var(--line-strong); background: transparent; }
.notification-settings-copy { min-width: 0; flex: 1 1 auto; }
.notification-settings-heading { display: flex; min-height: 30px; align-items: center; gap: 7px; color: var(--ink); font-family: var(--font-display); font-size: 14px; font-weight: 700; line-height: 1.2; }
.notification-settings-heading svg { flex: 0 0 auto; color: var(--blue-dark); }
.notification-settings-copy p { margin-top: 2px; color: var(--muted); font-size: 10px; font-weight: 600; line-height: 1.25; }
.notification-settings-copy small { display: block; margin-top: 2px; color: var(--blue-dark); font-size: 9px; font-weight: 700; line-height: 1.25; }
.notification-settings-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 6px; }
.notification-settings-actions .btn { min-height: 34px; padding: 6px 8px; font-size: 10px; }
'''
if old_css not in text:
    raise RuntimeError("notification CSS block missing")
text = text.replace(old_css, new_css, 1)
p.write_text(text)

# 8) Record the production schema migration in the repo.
Path("supabase/scope-push-subscriptions-by-group.sql").write_text('''-- Applied to production on 2026-08-21.\n-- Each installed Pick'em app now owns a group-scoped push subscription.\n\nalter table public.push_subscriptions\n  add column if not exists group_id uuid references public.pickem_groups(id) on delete cascade;\n\nupdate public.push_subscriptions\nset group_id = (\n  select id from public.pickem_groups where is_default = true limit 1\n)\nwhere group_id is null;\n\nalter table public.push_subscriptions\n  alter column group_id set not null;\n\ncreate index if not exists idx_push_subscriptions_group_user\n  on public.push_subscriptions(group_id, user_id);\n''')

print("Patch applied successfully")
