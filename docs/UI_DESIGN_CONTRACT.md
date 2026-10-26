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
- Bet scope and status filter buttons use the slightly softer `--ui-radius-filter: 6px`.
- Compact badges (including W/L/P) and weekday labels use crisp 2px corners (`--ui-radius-label`).
- Connected pick rows, board edges, table rows and dividers remain flat so the app reads as one organized layout.
- GameTracker and Matchup Preview retain their 6px internal corner treatment. Circular shapes remain reserved for actual dots and avatars.
- Player profiles and the side bet sender fill the app content area from the fixed header to the fixed bottom navigation, with internal scrolling.
- Circular status indicators (e.g. score dots, avatars): `--ui-radius-circle: 50%`, only where meaning requires round shape
- Dividers, rather than individually outlined pill cards, separate rows
- Preserve controlled component interaction and safe-area padding; no sticky-nav movement

## Typography
- `--font-display` references Roboto Slab, loaded once in `app/layout.tsx`
- Maintain tabular numerals and alignment for scores, spreads and money amounts
- No ad-hoc per-screen font family substitutions without an explicit reason

## Safeguards
- No changes to betting, scoring, side-bet expiry or banking calculations in a styling pass
- Run `npm run check:code`, `npm run audit:css`, `npm run audit:modules` and production build
- Before changing visual geometry, compare at 320, 360, 375, 390 and 430px plus tablet in light/dark modes
- Never merge overlapping style patches solely because a build passes; visually verify high-touch flows
