# Pick'em UI Design Contract

Every page (football, basketball, Shaw, Friends and Caleb family) uses the same app-wide design tokens. This is the one source of truth for future styling changes.

## Where rules live
- `app/ui-foundations.css` — canonical variables (font, palette, spacing, page geometry and corner radius), plus base elements
- `app/ui-components.css` — shared controls, cards, rows and tables
- `app/ui-details.css` — game sheets and feature-specific styling, plus deliberate final flat-component overrides

Do not create another `*-polish.css` or `*-fixes.css` file for cosmetic changes. Modify the appropriate existing owner, preferring variables over one-off measurements.

## Spacing
| Token | Size | Use |
|---|---:|---|
| `--ui-space-1` | 4px | icon-to-text and close metadata |
| `--ui-space-2` | 8px | compact row and control internals |
| `--ui-space-3` | 12px | page gutter and standard card inset |
| `--ui-space-4` | 16px | major element grouping |
| `--ui-space-5` | 24px | major vertical separation |

Legacy `--space-1..5` are compatibility aliases, not a competing scale. Page, bank and pick insets use `--ui-space-3` unless a component-specific density requirement is documented. Avoid mixing named tokens and arbitrary 11/14/15px paddings within the same row family.

## Shape
- Main app cards, inputs and buttons have subtle 4px corners, not pill silhouettes. Use `--ui-radius-box` for surfaces and `--ui-radius-control` / `--ui-radius-action` for controls.
- Bet scope and status filter buttons use the pill-shaped `--ui-radius-filter: 999px`.
- Compact badges (including W/L/P) and weekday labels use crisp 2px corners (`--ui-radius-label`).
- Connected pick rows, board edges, table rows and dividers remain flat so the app reads as one organized layout.
- GameTracker and Matchup Preview retain their 6px internal corner treatment. Circular shapes remain reserved for actual dots and avatars.
- Player profiles use a 4px gap below the fixed header and scroll internally above bottom navigation. The period selector belongs above the record, not in the panel header. The side bet sender fills the content area.
- Circular status indicators (e.g. score dots, avatars): `--ui-radius-circle: 50%`, only where meaning requires round shape
- Dividers, rather than individually outlined pill cards, separate rows
- Preserve controlled component interaction and safe-area padding; no sticky-nav movement

## Typography
- `--font-display` references Roboto Slab, loaded once in `app/layout.tsx`
- Maintain tabular numerals and alignment for scores, spreads and money amounts
- No ad-hoc per-screen font family substitutions without an explicit reason

## History data
- NFL and CFB matchup previews share a fourth Line Movement tab. Show recorded spread changes with Central-time timestamps; never invent historical change times from the current line.
- Merge duplicate imported game scores and spreads independently. Read every history page before merging so later weeks cannot disappear behind a row cap.
- For duplicate display rows, preserve explicit overrides, then prefer DraftKings over generic market lines. Keep score and line source timestamps separate; a final-score refresh is not a line update. Keep saved pick and bet terms intact.

## GameTracker
- NFL and CFB share one component and style rules. The header contains logos and scores, with the home logo to the right of its score. Faint team colors fade inward to the themed panel; score weight is 700.
- Final is plain themed text. Box-score selectors use a full outline and subtle selected fill.
- Player tables have one category/stat header row, a 152px name column and centered 44px stat columns. Extra columns scroll within the table.
- A quarter header connects directly to its first drive. Metadata dots align to the text center. Play clocks match description size while keeping muted color.
- Kickoff positions name the kicking yard line, using explicit play text before structured field position. Missing numeric data stays unavailable rather than becoming zero.

## Safeguards
- No changes to betting, scoring, side-bet expiry or banking calculations in a styling pass
- Run `npm run check:code`, `npm run audit:css`, `npm run audit:modules` and production build
- Before changing visual geometry, compare at 320, 360, 375, 390 and 430px plus tablet in light/dark modes
- Never merge overlapping style patches solely because a build passes; visually verify high-touch flows

## Shared game detail controls and basketball views (November 1, 2026)
- `GameDetailClose` is the only close control for CFB/NFL and CBB/NBA detail sheets. Its visible square is 28px and its X is 14px; an invisible extension preserves a 44px touch area. Do not add per-sheet button sizing overrides.
- Basketball pregame previews and live trackers are independent components. Preview has Analytics, Form, History, and Line Movement, while GameTracker has Live/Shot Chart, Scoring, Plays, and Box Score.
- Form result squares use the same `badge pick-result-*` classes as My Card and League Card. ATS results are plain colored letters. Missing saved spreads stay unavailable.
- History shows venue labels once in the team rows; do not restore a second Home/Away label above the score.
- Basketball box-score stat columns are 44px with a 152px player column; horizontal scrolling stays inside the table. Team selectors use provider abbreviations and full team names remain in the body.
- Shot locations come only from valid ESPN field-goal coordinates. Reject missing/sentinel coordinates and do not infer a location from text. Made shots are open circles; misses are X marks. Current-period selection follows quarter/half changes automatically, while All periods retains the full game.
- The shot chart remains accessible after the game ends. Long heaves extend the court instead of being moved or dropped.
