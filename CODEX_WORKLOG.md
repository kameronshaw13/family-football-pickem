# Shaw Family Pick'em — Codex Worklog / Source of Truth

**Last updated:** 2026-09-03  
**Current app-code production baseline:** `fddb50759355c9a29c4655d51b5fd2747f3c457d`
**Production status:** Vercel READY

> **Codex / future sessions:** Read this file before changing the app. Treat it as the running source of truth. After a task is completed, update the relevant status here in the same work session. Do not rely only on chat history.

---

## 1. Working rules — do not skip

- The user wants **small, isolated, reversible changes**.
- Before any write, re-check the current `main` SHA because another Codex/ChatGPT session may be working at the same time.
- Do **not** blindly reset or overwrite `main` if it moved after a branch was created.
- Normal flow for app-code changes:
  1. branch from current `main`
  2. make only the requested change
  3. build / preview verify
  4. create a rollback branch from current production
  5. fast-forward `main`
  6. verify production READY
  7. update this worklog
- Preserve existing backup branches. Do not move/delete them.
- Vercel previews currently use production Supabase credentials. **Preview writes affect production data.**
- Manual Pick Lock is a real irreversible write. Never test it by locking a real pick unless the user explicitly authorizes the exact test.
- Do not use screenshot-based audits as the default workflow.
- Do not re-open the old cleanup project unless a regression is reported; cleanup was considered finished.
- Do not make broad layout/CSS changes when a small targeted fix is enough.
- Pinch zoom is intentionally disabled.

---

## 2. Current production state

Current app-code baseline:

- app-code commit: `fddb50759355c9a29c4655d51b5fd2747f3c457d`
- commit message: **Polish card lock states and uncap Shaw side bets**
- Vercel production for that app-code commit: **READY**
- latest implementation branch: `fix/my-card-icons-unlimited-side-bets-2026-09-03`
- latest rollback branch: `backup/pre-my-card-icons-unlimited-side-bets-2026-09-03`
- prior implementation branch: `fix/shared-natural-lineboxes-2026-09-02`
- prior rollback branch: `backup/pre-shared-natural-lineboxes-2026-09-02`
- prior implementation branch: `fix/standings-bank-linebox-2026-09-02`
- prior rollback branch: `backup/pre-standings-bank-linebox-2026-09-02`
- prior implementation branch: `fix/typography-breathing-room-weekly-locks-2026-09-02`
- prior rollback branch: `backup/pre-typography-breathing-room-weekly-locks-2026-09-02`
- prior implementation branch: `fix/standings-shared-numeric-rendering-2026-09-02`
- prior rollback branch: `backup/pre-standings-shared-numeric-rendering-2026-09-02`
- prior implementation branch: `fix/standings-digit-baseline-2026-09-02`
- prior rollback branch: `backup/pre-standings-digit-baseline-2026-09-02`
- prior implementation branch: `fix/standings-text-clipping-2026-09-02`
- prior rollback branch: `backup/pre-standings-text-clipping-2026-09-02`
- prior implementation branch: `fix/league-card-empty-row-2026-09-02`
- prior rollback branch: `backup/pre-league-card-empty-row-2026-09-02`
- prior implementation branch: `fix/app-pass-1-7-2026-09-01`
- prior rollback branches: `backup/pre-app-pass-1-7-2026-09-01` and `backup/pre-app-pass-stabilize-2026-09-01`

A later worklog-only commit may make the literal `main` SHA newer than the app-code baseline above without changing runtime behavior.

New targeted compatibility layer: `components/AppPassFixes.tsx`.

It currently owns the latest seven-item app pass behavior:

- restores the My Card progress/status card when all currently submitted picks are locked but the required card is still incomplete
- removes that fallback once the full required card is locked or the shared Sat–Mon weekend lock has arrived
- renders pending locked picks with a slightly larger closed padlock and pending unlocked picks with an open padlock before the shared weekend lock
- hides both padlock indicators after the shared weekend lock
- tags administrative no-submission rows explicitly and removes any top spacer/banding at the player-header boundary
- expands text paint/clipping room without padding or fixed-row geometry changes
- changes completed-week Side Bets to history-only behavior and a `Week is complete` Make Offer state

Stabilization note:

- the fallback progress card only creates its internal DOM once and then updates changed text/progress values in place; this avoids MutationObserver churn/re-render loops while preserving the same visual structure

Important effective styling in `components/Batch1bSideBetStyles.tsx` remains:

- gold manual Lock control is 30px tall
- effective Lock font weight is **800**
- Lock icon is 13px
- lock review team/spread row is neutral/white through overrides
- lock review matchup/date uses gray hierarchy text and weight 700
- game time/final/live status use inline-flex + `line-height: 1.3` + `overflow: visible`
- Clear-history cards are explicitly tagged with `has-clear-offer-action` instead of relying on CSS `:has()` for sizing

---

## 3. Immediate UI items — USER VERIFICATION / FIX NEXT

### A. My Card — partial manual-lock progress state

**Status: IMPLEMENTED 2026-09-01; NEEDS USER VERIFICATION.**

Reported problem:

- if the user had only one submitted pick and manually locked it, the large My Card progress/status card disappeared
- root cause: base `cardIsLocked` treats every currently existing pick being locked as a fully locked card, even when the required card is incomplete

Current behavior added in `AppPassFixes.tsx`:

- if the native progress card disappears only because every currently submitted pick is locked, restore the same `card-progress` presentation
- keep it visible while the required card is incomplete
- remove it when all required selections are locked
- also remove it once the shared Sat–Mon weekend lock has occurred
- do not manually test this by locking another real production pick without explicit authorization

### B. My Card / League Cards — locked-pick right-side icon

**Status: IMPLEMENTED 2026-09-01; NEEDS USER VERIFICATION.**

Desired behavior:

Before the shared Saturday 11:00 AM America/Chicago lock:

- a locked pending pick shows a lock icon in the 30px right-side action position
- My Card uses the same position previously occupied by the red X/remove control
- League Cards show the lock icon for locked picks and nothing for unlocked picks
- do not show the old gray dash

After the shared Saturday 11:00 AM lock:

- the pending locked-pick indicator is blank on the right

Implementation notes:

- the shared lock is derived from the selected week's actual Sat–Mon game `lock_time` values rather than the device weekday
- live/final scorebugs and graded result badges are not replaced by the lock icon
- the immediate post-lock `manual-lock-confirmed` state is also normalized to the icon so behavior does not depend on a page refresh
- pending locked picks in expandable Weekly Results now render the same shared lock-state element, so they show the icon before the shared weekend lock and remain blank after it

### C. League Cards — empty / no-submission row

**Status: REBUILT 2026-09-02; NEEDS USER VERIFICATION.**

The user repeatedly saw gray space/banding above the white no-picks row.

Current important distinction:

- normal empty League Cards state in `PickemAppBase.tsx` is `.group-empty-picks` and renders `No visible picks yet.` before CSS presentation changes
- finalized missing-pick rows are a different system using synthetic picks/games and `public/admin-no-submission.svg`, with styling in `app/admin-no-submission.css`
- the desired empty row should remain **thin/compact**, not be expanded to the same height as a normal selected team row merely to hide a gap

Latest targeted pass:

- confirmed every League Card is built from the same complete group-member list and the selected week's picks are returned consistently to each group member
- replaced the League Card's hidden `No visible picks yet.` text plus CSS-generated pseudo-element message with real `No picks submitted.` row content
- removed the `font-size: 0` / `::after` text path so the browser measures the same visible line box it actually renders
- retained the existing compact `group-empty-picks` row geometry, white/panel background, dividers, and normal spacing between player sections
- explicitly tags finalized rows containing `admin-no-submission.svg` as `.admin-no-submission-row`; that separate synthetic finalization path remains unchanged

**Desired visual:**

- compact/thin empty row
- white cell from its top edge downward
- one normal light divider between player name header and white empty row
- no thick gray band / no extra gray spacer
- normal spacing between different players' sections must remain

If the user still sees the band, determine from the live DOM whether it is the normal `.group-empty-picks` state or `.admin-no-submission-row` before making another change.

### D. Text clipping / line boxes

**Status: USER VERIFIED 2026-09-03 — clipping is gone.**

User requirement:

- text must never be clipped at top/bottom
- **original vertical spacing/alignment must remain**
- do not fix clipping by adding broad padding that pushes nearby elements around

Known examples from the latest app pass:

- bottoms of standings rank `1 / 2 / 3`
- game time in the top-left of Pick Board games
- matchup/time line in My Card / League Card pick rows

Latest standings replacement in `AppPassFixes.tsx`:

- the earlier forced `1.3` standings line height and 1px numeric bottom inset did not solve the user's visual issue and have been removed
- Season and Weekly Standings numeric cells now use the same natural, unpadded line-box behavior as the working Bank values (`line-height: normal`, inline numeric wrappers, no bottom padding)
- row heights, row padding, columns, and dividers remain unchanged
- the Place header and every place number are explicitly centered within the first grid column
- the Place number and adjacent player name now share the exact same 14px/700/natural line-box metrics, so their visible centers align without a manual pixel translation
- Season Standings player names remain clickable for profiles, but the blue profile-link underline is suppressed inside the standings table
- rank and W/L/P values continue using the shared `NumericText` rendering path already used by Bank values, win percentage, points, spreads, scores, and times

Pending Offers replacement:

- the team/spread line no longer combines a clipped `1.25` parent with a taller `1.3` responsive child
- it now uses the same natural, unpadded single-line treatment as the working pick titles, with a small paint-only clip margin so ellipsis behavior remains without cutting off glyph bottoms
- nested number/spread wrappers inherit that line box and have no manual bottom padding or transform
- Pending Offer row height, logo placement, amount column, and action spacing are unchanged

Weekly Results behavior from the prior pass remains:

- Weekly Results pick titles use clip-margin paint room and `1.3` line height; their spread token also has the real 1px bottom inset
- game time/final/live status and numeric fragments remain overflow-visible
- pick matchup/meta text keeps the existing `1.4` line-height and uses `overflow: clip` plus a small `overflow-clip-margin` so glyph bottoms can paint without padding/margin geometry changes
- no fixed row heights, card spacing, or broad vertical padding were changed

If any clipping remains, fix only the exact remaining selector/line box.

### E. My Card abbreviations / pending lock-state icons

**Status: DEPLOYED 2026-09-03; NEEDS USER VISUAL VERIFICATION.**

- My Card selected-team labels now always use the existing team abbreviation so the name cannot run into the manual Lock control
- full team names remain available to assistive technology, browser title text, and the manual-lock review dialog
- before the shared Saturday 11:00 AM America/Chicago lock, pending locked picks use a closed padlock and pending unlocked picks use an open padlock in League Cards and Weekly Results
- the closed/open padlocks are 18px, slightly larger than the prior 16px closed icon
- after the shared weekend lock, the pending padlock state remains blank; live/final scorebugs and graded results still take precedence
- My Card's editable unlocked row retains its functional Lock and remove controls rather than adding a duplicate open-padlock status icon

### F. Shaw side bets — unlimited weekly count

**Status: DEPLOYED AND LIVE RULE VERIFIED 2026-09-03.**

- the current Shaw season has `rules.sideBets.maxPerWeek = null`, meaning unlimited side bets per week
- the existing per-bet maximum remains `$20`; enabled state and kickoff/acceptance rules are unchanged
- frontend creation, recipient availability, and acceptance checks now use each group's configured `sideBetSettings.maxPerWeek` instead of a hard-coded limit of 3
- `null` is intentionally treated as unlimited; numeric limits remain supported for any group that uses one later
- live Supabase verification confirmed `shaw-family`, `friends`, and `other-family` currently return `maxPerWeek: null`
- rule update is documented in `supabase/shaw_unlimited_side_bets.sql`

### G. Side Bets — completed week behavior

**Status: IMPLEMENTED 2026-09-01; NEEDS USER VERIFICATION ON A COMPLETED WEEK.**

Once every game in the selected week is final:

- hide the **Pending Offers** section entirely
- keep **Offer History**
- Make Offer should not show CFB/NFL/conference game options
- do not show the weekly side-bet-slot-limit message instead
- show a simple **Week is complete** state
- hide any stale bet-slip bar/sheet if one was left selected before the week completed

The completed-week state is derived from the selected week's actual game completion data and recalculates when the selected week/DOM changes.

### H. Manual Lock control / review modal

**Status: mostly complete; verify visually before more changes.**

Current intended state:

- My Card Lock control: gold, dark text/icon, same vertical size as the red X (30px effective height)
- effective Lock label weight: **800** — do not lower it again unless explicitly requested
- manual lock is permanent and only locks the selected pick
- Confirm button is text-only: **no lock icon**
- modal uses the same base confirmation positioning as Side Bet Review & Accept
- team row uses Make Offer-style geometry but neutral/white, no blue selected background
- matchup + full date are shown below the pick row
- matchup/date hierarchy text is gray and weight 700
- bottom explanatory text uses dark app ink
- team display should be school/team display name, not raw nickname string when possible
- spread should remain on the far right

### I. Offer History Clear button

**Status: IMPLEMENTED, BUT USER SHOULD RE-VERIFY declined/canceled cases.**

Current approach:

- expired/declined/canceled offers can surface Clear as appropriate
- Clear is per-user dismissal; it does not delete the underlying side bet
- frontend explicitly marks cards containing Clear with `has-clear-offer-action`
- clear-card reserved height is currently 111px
- this replaced the earlier unreliable `:has()`-dependent sizing behavior

If Clear fails again, trace the status/presentation logic first. Do not add another independent height rule for each status.

---

## 4. HIGH PRIORITY BACKEND SAFETY

### Incomplete-card finalizer Supabase relationship

**Status: NOT FIXED — high priority before the next real weekend lock.**

File: `lib/finalizeIncompleteCards.ts`

Current query still uses:

```ts
.select("group_id,season_year,status,rules,group:pickem_groups(timezone)")
```

This can be ambiguous because there is more than one Supabase relationship path.

Patch to the explicit FK relationship:

```ts
.select("group_id,season_year,status,rules,group:pickem_groups!group_seasons_group_id_fkey(timezone)")
```

Do this as an isolated backend-safety patch, build it, create a rollback, then promote.

The earlier week-switch guard is already present and prevents premature incomplete-card finalization before the actual weekend lock, but the ambiguous relationship can still fail when the finalizer truly runs.

---

## 5. Completed / already shipped — do not redo without a reported regression

### Week / locking behavior

- app defaults to the highest week whose opening time has arrived
- football week opens Tuesday at 8:00 AM America/Chicago under current rules
- Side Bet Offer History is scoped to selected week
- Side Bet Ledger is scoped to selected week
- selected week syncs through `pickem_view_week` cookie for server-side ledger scoping
- manual early Pick Lock endpoint exists at `/api/picks/lock`
- manual lock freezes the current selected-team spread
- manual lock freezes dog bonus value where applicable
- manual lock changes only that pick; other unlocked picks remain editable
- no normal unlock path exists
- automatic Tue–Fri kickoff locks and shared Sat–Mon weekend lock rules remain

### Missing submissions

- missing regular pick becomes an automatic loss after the weekend lock
- missing dog becomes `No Dog Submitted`, zero dog bonus, and does not create an additional regular W/L loss
- synthetic administrative rows use `admin-no-submission.svg`

### Recent visual/UI work

- losing teams use sharper gray hierarchy while logos remain full opacity
- League Rules accordion compact spacing retained
- Side Bet response wording/responsive cleanup retained
- lock review uses full date formatting
- Side Bet Review & Accept full date formatting was also added
- Confirm lock icon was removed
- lock review background is neutral rather than blue selected state
- notification bubbles remain enabled/unchanged unless explicitly requested later

### Auth / loading

- Supabase auth cold-start 401/retry issue was previously fixed; do not disturb the admin-client auth configuration casually

---

## 6. Next product / reliability backlog

These are not all immediate. Work them in small batches.

### Notifications / state

- [ ] persist notification read state correctly across devices/re-login
- [ ] notification tap should navigate to the correct destination and stay there during refresh
- [ ] disable live win-% notifications until real probability/model outputs exist
- [ ] dog-change notifications should work across multiple groups without duplicate notifications inside one group
- [ ] cold open should remove/resolve an invalid dog before showing the alert
- [ ] keep toast / navigation spacing normal

### Live state / refreshing

- [ ] once a game is known live/final, do not regress visually to pregame during background refresh/reopen
- [ ] pull-to-refresh should keep current scores/cards visible while loading and swap in updated data only when ready
- [ ] investigate quick logo flash/remount after app sits for a while; no redesign
- [ ] minor initial header/hydration flicker
- [ ] live scorebug vertical spacing polish only if still needed; avoid horizontal/size changes unless requested

### Bank

- [ ] expandable Bank Balance history by player
- [ ] week-grouped transactions such as weekly finish and side-bet results
- [ ] all-season history

---

## 7. Longer-term product roadmap — not immediate cleanup

- Settings tab after login
- football-focused matchup previews
- advanced team/player stats and recent-history context
- CFB/NFL prediction models
- weekly win probability projections
- live weekly win probability during games
- monetization / subscriptions if product expands
- marketing / acquisition plan
- possible native/Capacitor app later
- live data and odds-provider strategy

Keep the product football-focused and simple before broadening into too many sports/features.

---

## 8. UX / design guardrails

The app should stay:

- clean and compact
- football-first
- simple rather than feature-bloated
- minimal boxes/pills
- straight lines and simple separators
- dynamically centered rather than fixed-offset where practical
- consistent with current right-side spread spacing; do not casually alter mobile spacing
- careful with font clipping; no text should be cut off
- careful with row height changes; compactness matters

Small visual regressions matter. Do not make broad CSS changes to solve one row.

---

## 9. Important rollback refs to preserve

Do not move/delete existing backups. Key recent examples include:

- `backup/pre-my-card-icons-unlimited-side-bets-2026-09-03`
- `backup/pre-typography-breathing-room-weekly-locks-2026-09-02`
- `backup/pre-shared-natural-lineboxes-2026-09-02`
- `backup/pre-standings-bank-linebox-2026-09-02`
- `backup/pre-standings-shared-numeric-rendering-2026-09-02`
- `backup/pre-standings-digit-baseline-2026-09-02`
- `backup/pre-standings-text-clipping-2026-09-02`
- `backup/pre-league-card-empty-row-2026-09-02`
- `backup/pre-app-pass-stabilize-2026-09-01`
- `backup/pre-app-pass-1-7-2026-09-01`
- `backup/pre-white-empty-row-layout-neutral-text-2026-09-01`
- `backup/pre-text-clipping-divider-polish-2026-09-01`
- `backup/pre-lock-review-card-spacing-text-safety-2026-09-01`
- `backup/pre-lock-review-make-offer-row-2026-09-01`
- `backup/pre-lock-review-neutral-row-position-2026-09-01`
- `backup/pre-clear-card-lock-date-row-2026-09-01`
- `backup/pre-clear-default-lock-polish-2026-09-01`
- `backup/pre-manual-lock-review-cell-2026-09-01`
- `backup/pre-simplified-manual-lock-modal-2026-09-01`
- `backup/pre-manual-lock-review-ui-2026-09-01`
- `backup/pre-week-scope-manual-lock-2026-09-01`
- `backup/pre-cleanup-2026-08-27`

There may be additional backups. Search refs before creating a similarly named one.

---

## 10. How to update this file after work

After each completed task, update at least:

1. **Current production state** with the new app-code SHA if production behavior changed.
2. The relevant item under **Immediate UI items** or **Backlog**.
3. Move truly finished items to **Completed / already shipped** only after build/production verification and, for visual issues, ideally after user verification.
4. Add any new rollback branch that is important to preserve.
5. Add newly reported user issues verbatim enough that another session understands the desired visual/behavioral result.

If the user says something is still wrong, change its status back to **NEEDS FIX** instead of stacking another “completed” note on top.
