# Shaw Family Pick'em — Codex Worklog / Source of Truth

**Last updated:** 2026-09-03  
**Current production baseline when this file was created:** `79ef0c88b7377cbf1fc9ae3d3f0c93a854791885`  
**Production status at creation:** Vercel READY

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

Current live baseline at the time this file was created:

- `main`: `79ef0c88b7377cbf1fc9ae3d3f0c93a854791885`
- Commit message: **Restore base league empty row styling and lock weight**
- Vercel production: **READY**

Important effective styling in `components/Batch1bSideBetStyles.tsx`:

- gold manual Lock control is 30px tall
- effective Lock font weight is **800**
- Lock icon is 13px
- lock review team/spread row is neutral/white through overrides
- lock review matchup/date uses gray hierarchy text and weight 700
- game time/final/live status currently use inline-flex + `line-height: 1.3` + `overflow: visible` to avoid clipping without padding-based spacing changes
- Clear-history cards are explicitly tagged with `has-clear-offer-action` instead of relying on CSS `:has()` for sizing

---

## 3. Immediate UI items — USER VERIFICATION / FIX NEXT

### Root-cause UI regression batch

**Status: IMPLEMENTED ON `fix/root-cause-ui-regressions`; NEEDS USER VERIFICATION.**

- removed the full-document font measurement/translation loop that ran after every DOM mutation
- moved Roboto Slab from a runtime Google stylesheet to `next/font` so its metrics are available without a late network font swap
- removed client-rendered style strings that caused React to discard and rebuild the server-rendered page during hydration
- moved clear-offer state into React markup and removed two DOM/style patch components
- standardized all notification bubbles at 17px with 10px centered numerals
- changed side-bet offer badges to clear when Offers is viewed while leaving the offer actionable
- moved push delivery into Vercel background work so Accept/Decline responses do not wait on push retries
- switched shared team logos to `next/image` with explicit high-resolution sizing and ESPN image configuration

No row heights or broad padding values were changed for the text-clipping fix. The shared runtime translations that moved glyphs into clipped containers were removed instead.

### A. League Cards — empty / no-submission row

**Status: NEEDS USER VERIFICATION. Do not assume fixed.**

The user repeatedly saw gray space/banding above the white no-picks row.

Current important distinction:

- normal empty League Cards state in `PickemAppBase.tsx` is `.group-empty-picks` and renders `No visible picks yet.` before CSS presentation changes
- finalized missing-pick rows are a different system using synthetic picks/games and `public/admin-no-submission.svg`, with styling in `app/admin-no-submission.css`
- the user clarified that the desired empty row should remain **thin/compact**, not be the same height as a normal selected team row

Latest production commit `79ef0c88...` removed the added 39px `.group-empty-picks` override and restored the base League Cards empty-row styling.

**Desired visual:**

- compact/thin empty row
- white cell from its top edge downward
- one normal light divider between player name header and white empty row
- no thick gray band / no extra gray spacer
- normal spacing between different players' sections must remain

**Before changing this again:** identify whether the visible row the user is pointing to is:

1. `.group-empty-picks`, or
2. a synthetic admin `No Pick Submitted` row using `admin-no-submission.svg`.

Do not keep layering CSS on the wrong one.

### B. Text clipping / line boxes

**Status: NEEDS USER VERIFICATION / likely more targeted cleanup.**

User has seen text barely clipped at the bottom in multiple places, especially compact game-time/status text.

User requirement:

- text must never be clipped at top/bottom
- **but original vertical spacing/alignment must remain**
- do not fix clipping by adding broad padding that pushes nearby elements around

Current production reverted the broad padding/margin experiments and now only has a targeted game-time/status rule:

`display:inline-flex; align-items:center; line-height:1.3; overflow:visible`

If more clipping is reported, fix the exact selector/line box rather than applying one large global padding rule.

### C. Manual Lock control / review modal

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

### D. Offer History Clear button

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

**Status: FIXED in `aee7bc0`.**

File: `lib/finalizeIncompleteCards.ts`

The query now uses the explicit relationship:

```ts
.select("group_id,season_year,status,rules,group:pickem_groups!group_seasons_group_id_fkey(timezone)")
```

This can be ambiguous because there is more than one Supabase relationship path.

The earlier week-switch guard remains in place to prevent premature incomplete-card finalization before the actual weekend lock.

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

- college odds imports require both teams to match ESPN, preventing Northern Iowa from being confused with Iowa at a shared kickoff time
- locked picks use the smaller gray lock icon
- expired side-bet offers expose the same per-user Clear action as declined/cancelled offers
- side-bet acceptance and manual-lock popup matchup/date cells share height, size, and weight
- Next.js 14 was updated to 14.2.35; lint is configured and the full 32-test suite passes
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

1. **Current production state** with the new `main` SHA if production changed.
2. The relevant item under **Immediate UI items** or **Backlog**.
3. Move truly finished items to **Completed / already shipped** only after build/production verification and, for visual issues, ideally after user verification.
4. Add any new rollback branch that is important to preserve.
5. Add newly reported user issues verbatim enough that another session understands the desired visual/behavioral result.

If the user says something is still wrong, change its status back to **NEEDS FIX** instead of stacking another “completed” note on top.
