# Pick'em — Two Full-App Design Studies
**Design review · October 13, 2026**  
**Branches:** `design/full-editorial-app` and `design/full-command-app`

## Purpose and nonnegotiable constraints
This project explores a genuine product-wide redesign of the football Pick'em experience. It is **not** a pitch deck, a standalone mockup, or a redesign of only GameTracker and Matchup Preview. Both branches retain the actual application routes, game APIs, league data presentation, interactions, and existing screens.

- Preserve the four primary navigation destinations: Picks, My Card, Standings, Settings.
- Preserve Pick Board and Side Bets inside Picks, including all betting subviews.
- Preserve My Card and league-card views, progress, winning outcomes, picks and dogs.
- Preserve Standings and Bank, week-by-week history, settlements and payout displays.
- Preserve player profiles and Settings, including appearance, notifications, credentials and rules.
- Preserve CFB/NFL game details, GameTracker, and NFL/CFB Matchup Preview.
- Do not redesign by deleting features or changing important game rules.
- Make the interface **phone-first** and consider 320–430 CSS-pixel widths and safe-area insets.
- Never allow a design experiment to change production picks, side bets, settlements, users or bank accounts.
- Bottom navigation must never shift vertically when the user scrolls the page.
- Respect user's existing light/dark preference, but default Design B to dark when no stored choice exists.
- The **same** app code, component tree and working data sources are used in both variants; visual behavior is altered using scoped CSS and an optional measurement aid.

### Read-only safety
In Vercel *preview* deployments, the request middleware rejects write requests to `/api/*` except normal session login/logout. Users may browse data. **Making or accepting offers, editing picks, changing account password and other state-changing actions are intentionally not functional on these preview URLs.** This is deliberate to avoid changing a real league during design review.

The previews also inherit the Vercel project's deployment authentication: a separate Vercel sign-in may be required.

---

## Design A: Modern Editorial — `design/full-editorial-app`
### Product identity
A contemporary version of the existing app: light neutral background, stronger graphite header and bottom bar, cool blue selection highlights, restrained elevation, and square-ish cards with just enough rounding to feel finished. Keep the appeal of a compact sports information product rather than adopting bulky generic SaaS cards.

**Palette:** near-white content surfaces, slate ink, cool-gray separators, slate-blue interactive accents.  
**Typeface:** preserve a slab-like sports editorial face for display; avoid mixing incompatible styles.  
**Shapes:** 6–10px radii on panels, 7–9px on inputs, clean rectangular data rows.  
**Density:** medium-high; every pixel must earn its space.  
**Primary impression:** premium, dependable, legible, recognizable.

**Global choices**
1. Maintain the existing 4-way navigation; center each icon and its label on the same horizontal axis.
2. Give the week selector a subtle outlined pill-like control without making it overpower the header.
3. Show game days with compact colored date labels and distinct game cards instead of uninterrupted stacked rows.
4. Keep selection and live states obvious using blue, red, gold and gray rather than decorative gradients.
5. Use uniform baseline spacing across Picks, My Card, Standings/Bank and Side Bets.
6. Treat GameTracker and Matchup Preview as focused full-screen content views. The global bottom navigation is intentionally hidden during those overlays.

### Screen-level changes
| Area | What changed | What should be checked visually |
|---|---|---|
| Global header | Cleaner dark header; border-accented week selector | Logo's optical balance with week selector; notch/safe area |
| Bottom navigation | Smaller typography; exact icon center; consistent active indicator | Icon and label horizontal midlines; nav immobile on scroll |
| Pick Board | Self-contained matchup cards; stronger selected-team tone; restrained spacing | Team logo center; spread alignment; 320px width |
| Pick filters | Aligned boxed dropdowns | Equal heights, chevrons aligned, label baselines |
| My Card | More deliberate progress panel; cleaner selected-pick rows | Score bug positions, dog dot spacing, action X |
| League Card | Consistent grouped content and headings | Player names, outcomes, expanding and collapsing content |
| Side Bets board | Same sports card rhythm as Pick Board | Totals vs spreads, team rows, market text, selection |
| Side Bets create slip | Aligned recipients, amount controls, close/clear | 4×2 recipient grid on Friends; red clear X precisely centered |
| Offers and History | Uniform ledger rows, disciplined money typography | Right-side risk/win columns and dates align across rows |
| Standings | Softer panel surfaces with more legible table hierarchy | Rank, record, totals all on consistent baselines |
| Bank | Same card/data patterns and chronological settlement grouping | Weeks 1–7 payout row retained; Week 8 credit state |
| GameTracker | Full-width full-height view; balanced score, field, plays, scoring | X center, timeout dots, 2-score columns, sticky labels |
| Matchup Preview | Full-screen, larger readable team info and comparisons | CFB/NFL parity; metric rank/value alignment |
| Profiles | Clean rounded sheet and standardized close action | Profile heading, year selector, close button |
| Settings | Cohesive cards, leading icons and controlled toggles | Profile, Light/Dark, notifications, rules, password |

---

## Design B: Night Game — `design/full-command-app`
### Product identity
A substantially different UI, still recognizably a **football** product. Inspired by sports broadcast scoreboards and live-data dashboards: dark navy surfaces, cyan signal/accent color, deep card edges, brighter winning/losing states, and fast scanning of score, time and action.

**Palette:** dark midnight-navy canvas, layered slate-navy cards, cyan information signal, gold highlights, green wins and coral-red losses.  
**Typeface:** modern compact sans with heavier metric/score weights and tabular numerals.  
**Shapes:** 10–16px panel radii, rounded controls, subtle layered elevation.  
**Density:** dense enough for real Saturday slates, but with larger separation between independent game cards.  
**Primary impression:** modern live sports dashboard—not a sportsbook clone.

**Global choices**
1. Distinct **screen masthead** on each primary destination, showing current league/week and a visible screen title. It should immediately feel different from the original app.
2. Keep a dark nav bar with cyan selected state. Keep nav fixed at all times and use sufficiently large, centered touch targets.
3. Arrange individual games and activity groups as distinct rounded panels on a deep background.
4. Use title/metric hierarchy rather than decorative boxes everywhere.
5. Dark surfaces get stronger layering; critical numbers use tabular numerals.
6. Preserve full-screen game details for this first full-app version, because the GameTracker field and scoring lists are information-dense. The earlier docked-panel experiment remains separately available for reconsideration.

### Screen-level changes
| Area | What changed | What should be checked visually |
|---|---|---|
| Global header | Dark navy with cyan accent; week control in rounded frame | Logo contrast; no clipping or crunched header |
| Screen masthead | New screen identity with context, title, subtitle and icon | Consistent icon centering and short-screen space cost |
| Bottom navigation | Dark selected-tab capsule with cyan line icons | Active state, fixed viewport height, no bounce |
| Pick Board | Rounded game pods, high-contrast status lines | Matchup hierarchy, scores and spreads in one glance |
| Pick filters | Rounded dark controls, stronger selection color | All filter combinations; dropdown overlay contrast |
| My Card | More prominent completion/status cards, larger row rhythm | Pick/win/locked state readability |
| League Card | Contained round-corner cards with cyan-highlighted headings | Comparison vs My Card on same visual grid |
| Side Bets board | Dark odds/market canvas with visible active tabs | Spread/ML/O-U variants and recipients |
| Side Bets slip | Premium floating ticket styling, dark content, consistent actions | Field alignment, disabled actions, no overflows |
| Offers/History | Dark transaction cards and prominent outcomes | The $ symbol, amount, odds, dates and potential summary |
| Standings | Dark, grid-like scoreboard with highlighted headers | Tight rankings, player order, season numbers |
| Bank | Legible accounting in dark theme, no unwanted deposit UI | Positive/negative colors, history dividers, payout row |
| GameTracker | Higher contrast full-screen game view, brighter live labels | Large scores, central time, tab heights, field inset |
| Matchup Preview | Stats-first darker comparisons with modern sans typography | Every metric, record, logo and rank centered |
| Profiles | Dark modal/sheet with clearer hierarchy | Year dropdown, close button, per-player totals |
| Settings | Dark setting cards with legible toggles and notification states | Profile actions, reset password and theme switch |

---

## Pixel-level alignment specification — BOTH variants

### Grid/spacing baseline
Use a 4px underlying spacing grid for major layout spacing, with small 1–2px optical adjustments only when actual glyph geometry requires them. Horizontal dividers and dot separators must be visually centered, not simply left to text baseline variation.

- **Close-button square:** minimum consistent 32–36px visible button, SVG centered with CSS Grid `place-items:center`; no inherited padding or font line height. The goal is `<1px` center deviation between its *element boxes*. The visual X shape still needs an optical review.
- **Top headers:** logo / week selector share a common vertical middle; safe-area offset applies to the header as a unit.
- **Nav controls:** icon and text centered horizontally within equal-width columns; active style must not change the geometry of the selected column.
- **Matchup rows:** team-logo centerlines, team-text centerlines and spread/score number columns align identically across home and away.
- **Score numbers:** tabular figures for equal column widths (e.g., 7 vs 17), avoiding visual right-side jumps.
- **GameTracker scoreboard:** left and right score blocks use symmetric space; center period/clock/situation remains in the middle column.
- **Scoring plays:** away and home score columns fixed, vertically aligned on scoring play and quarter header.
- **Plays:** down/distance/time positioned immediately above play text; drive totals (plays, yards, possession) form a stable readable row.
- **Tabs:** each tab text centered in its hit area; active underline or card never changes height.
- **Odds row:** market baseline and separator dots visually aligned; all prices remain on one line when possible.
- **Amount summary:** right column amount and risk/win labels share baseline, are numeric-width-stable, and always include dollar symbols when appropriate.
- **Recipient grid:** equal cell heights and widths; the restored Friends 'All' recipient appears in the same grid as every player.
- **Profile:** year selector and close square vertically centered with heading.
- **Settings:** leading icon and row copy aligned; arrow chevron does not drift up/down relative to the touch target.
- **Interaction states:** hover, pressed, pending, disabled and active must not cause size shifts.
- **Viewport:** content remains scrollable, but header/footer do not drift on overscroll or keyboard appearance.

### Optional measurement helper
Both branches include the optional **Design Alignment Audit**. Add `?alignmentAudit=1` to the Friends URL after logging in. It measures bounding-box centers of visible controls and reports horizontal/vertical deviations in CSS pixels. It automatically remeasures after opening an overlay or switching screens.

Example: `/friends?alignmentAudit=1`

**Limitation:** a zero-pixel box-center deviation does *not* prove that an SVG's stroke mass or a font glyph is optically centered. That requires a screenshot/real-device pass.

---

## Navigation, flow and interaction acceptance checklist

### Main navigation and app shell
- [ ] Four navigation destinations always appear on the main app, with correct active state.
- [ ] No vertical movement of bottom nav while scrolling Picks, Offers, Standings or Settings.
- [ ] Safe-area correct on iPhone with notch/dynamic island and home indicator.
- [ ] Week selector and league header never overlap on a 320px viewport.
- [ ] Loading, empty, locked and error states retain the same general layout.

### Pick Board
- [ ] Open/Locked/Final show correct statuses, score/market if available and correct game times.
- [ ] Changing CFB/NFL/DOGS filter does not shift/clip controls.
- [ ] Player selection and visible locked/outcome styling remain visually coherent.
- [ ] Early and late games with very long team names display without overflow.
- [ ] Multiple odds, dog values and rankings fit or gracefully truncate with full accessible labels.
- [ ] Live game GameTracker and pregame Matchup Preview open consistently.

### My Card / League Card
- [ ] Empty selection, partly filled, complete, saved and unsaved states remain distinct.
- [ ] Correct regular picks, dogs and outcomes.
- [ ] Team logos, dog dots and pick meta line share horizontal baselines.
- [ ] Score bug remains inside row and aligns at each viewport width.
- [ ] Player switch/expand controls line up with heading and do not resize surrounding content.

### Side Bets
- [ ] Offers, Make Offer, All/My Bets and other tabs remain available and obvious.
- [ ] Pregame/Live and Spreads/O-U controls share consistent touch sizes.
- [ ] Recipient grid has restored All button on Friends and still supports individual selection.
- [ ] Multi-game selection and submitting remains logically identical in real app.
- [ ] Every odds/amount/spread field aligns; no wrap that obscures the submit button.
- [ ] Offer history, pending and accepted/settled states have clear hierarchy and amount formatting.
- [ ] Nonuser bets remain visually quieter than the viewer's wins and losses.
- [ ] No "Available / Pending" cash gate appears in Friends credit-based Side Bets.

### Standings and Bank
- [ ] Rankings, score columns, percentages and records align from row to row.
- [ ] All player expand/collapse states have stable dividers.
- [ ] Bank weeks maintain ordered weekly results and correct payout semantics.
- [ ] "Weeks 1–7 Payout" remains in between weeks; no Week 8 deposit required.
- [ ] Strong positive/negative money colors without confusing settled-to-zero amounts.

### GameTracker
- [ ] Live / Scoring / Plays / Box tabs retain the correct content.
- [ ] Scoreboard two team logos, scores, timeouts and clock centered.
- [ ] Football field, line of scrimmage, first-down line and end zones appear correctly.
- [ ] Scoring-play metadata and result do not have asymmetrical top/bottom space.
- [ ] Quarter score columns and play-by-play time stay aligned, including long text.
- [ ] Expandable drive rows and horizontally scrollable box score remain usable.
- [ ] X icon centrally aligned in its colored close square and clickable without accidental backdrop closes.

### Matchup Preview
- [ ] Same design quality and structure for both CFB and NFL.
- [ ] Analytics, Form, History and Model (where permitted) are readable.
- [ ] Different rank number lengths and signed spreads do not shift metric columns.
- [ ] Long team names remain readable, with full title visible in header or accessible title.
- [ ] Dates and kickoff times use familiar legible grouping.
- [ ] Back/close flow returns to the correct prior Pick Board state.

### Profiles & Settings
- [ ] Profiles open from every supported player link; year selection works.
- [ ] Appearance Light and Dark toggles remain available (A light default, B dark default).
- [ ] Notification controls, reset password and rules remain discoverable.
- [ ] All leading/close/caret SVGs remain geometrically centered.
- [ ] Long usernames and league names do not collide with icons.

---

## Verification status and limitations
The two full-app designs were implemented as isolated CSS and selective UI changes to the original components and routing, not as image mockups. Vercel is configured to auto-build nonproduction branches.

**Verified so far:** code stored in two separate branches; Vercel production app left untouched; both preliminary app designs compiled and deployed successfully; read-only middleware present; both variants include common geometry specifications and optional CSS-box alignment inspector.

**NOT yet verified:** final latest commits' build status until checking Vercel; authenticated browser navigation through every screen; visual pixel-diff screenshot suite; user-provided iPhone device tests; backend mutation behaviors (blocked intentionally); exact optical centering of every SVG and typeface. Never imply these tests passed without evidence.

### Real-device QA to perform before selecting a winner
Test on iPhone at minimum: 320px, ~375–390px and 430px CSS widths; light and dark modes; long/short team names; in-progress, scheduled, final games; open and empty markets; offer history with many recipients; expanded bank histories; GameTracker tabs; CFB/NFL analytics; and Settings. Capture full-screen screenshots of each state and compare centerlines (not only padding numbers).

### Selection rubric (100 points)
| Dimension | Weight |
|---|---:|
| Pixel-level centering and consistent vertical rhythm | 30 |
| Football information hierarchy and data density | 20 |
| Navigation and ease of moving between tasks | 15 |
| Side Bet creation/review usability | 15 |
| GameTracker and Matchup Preview quality | 15 |
| Distinctive brand identity | 5 |

A winner should not be picked until we review actual iPhone screenshots. A hybrid of A and B is entirely valid: for example A's dense Pick Board with B's scoreboard emphasis and iconography.

---

## How to inspect
1. Open the isolated Vercel Preview URL for each branch, under `/friends`; Vercel may require deployment authentication.
2. Sign in as a normal league member. Preview mutation attempts are rejected by middleware.
3. Browse **every** tab, not just the initial Pick Board.
4. Open a live game for GameTracker and a pregame match for Matchup Preview.
5. Repeat in both variants with the same game/week for a fair comparison.
6. For geometry diagnostics, use `/friends?alignmentAudit=1`.
7. Record visual differences, clipping, uncentered labels, or controls that should change behavior.
8. Do not merge into `main` until the visual/functional review is complete.
