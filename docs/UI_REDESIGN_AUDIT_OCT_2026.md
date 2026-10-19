# Pick'em — full UI audit and professional redesign

## Scope
Phone-first UI for football and basketball league routes, with the current
scoring, dog picks, odds data, bank, league logic, API and persistence untouched.

## Findings in the inspected repository (October 19, 2026)
- 20+ stylesheets imported in `app/layout.tsx`, including multiple named
  enhancement, refresh, polish and fix layers. This creates cascade dependence.
- `app/globals.css` alone is ~76 KB; the additional presentation and game
  detail stylesheets add substantial overlapping surface styling.
- `components/PickemAppBase.tsx` is ~226 KB and combines many functional UI
  areas; this makes isolated visual changes risky and slows review.
- Earlier font changes were followed by app-wide overrides rather than a
  shared, explicit typography system.
- Small-width responsive rules appear across multiple sheets, increasing
  opportunities for contradictory spacing and overflow.
- The fixed header and bottom navigation are behavioral constraints; the
  redesign must not destabilize their positions.

## First experimental pass delivered
- `app/ui-system-redesign.css`: a single, last-imported design layer with
  shared typography, spacing, surface, state, and mobile conventions.
- `app/layout.tsx`: Manrope display/interface family on this branch instead
  of Inter. No image, data, score, API, routing or financial code changed.
- Preserved flat, dense sports tables and feed rows rather than introducing
  decorative bubbles on every item.
- Preserved app wordmark and existing light/dark-theme mechanism.

## Cleanup plan
1. **Visual inventory** — capture at 320, 360, 375, 390, 430 and 768 px.
   Validate long team names, large money values, notifications, 4-player
   versus 8-player leagues, CFB/NFL/CBB/NBA, live/final/pregame.
2. **Per-screen design system** — check Pick Board, My Card, Side Bets
   (offers, offer history, ledger and make-offer sheet), Standings/Bank,
   Matchup Preview, GameTracker, Login/Profile/Settings and commissioner setup.
3. **Component extraction** — break `PickemAppBase.tsx` into independently
   tested screen/view components without moving business rules.
4. **Cascade consolidation** — migrate verified rules out of legacy override
   sheets; remove duplicates only when visual comparisons show equivalence.
5. **Quality gates** — run typecheck, lint, unit/integration tests and
   production build; verify mobile Safari scrolling, keyboard overlays,
   safe areas and stable fixed bottom navigation.
6. **Release** — use preview deployment and screenshot review, then merge
   into main only after acceptance.

## Acceptance criteria
- Consistent typographic hierarchy, row baselines, grid gutters and spacing.
- No clipped scores, names, money, market lines or buttons on supported phones.
- No page-width horizontal scrolling in the main app.
- Accessible focus indicators, adequate touch-target sizes.
- Fixed bottom nav does not shift when scrolling, opening keyboard or sheets.
- No changed picks, bet records, odds, scoring, notifications or balances.

## Current limitations
This branch contains an initial visual-system implementation and repository
audit, **not** a completed screen-by-screen visual QA or major component
refactor. Those require rendered-device verification before production use.
