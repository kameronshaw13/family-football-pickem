# Arc UI redesign experiment

Branch: `experiment/arc-ui-redesign-2026-10-09`

This is a **visual experiment only**. It preserves existing Supabase data, bet creation, scoring, locking, odds fetching, live tracking, notifications, session, and authentication logic.

## What changed
- Arc-informed system of calm surfaces, rounded cards, readable sans-serif type, subdued elevation, intentional blue accents, and accessible focus.
- Game board, card, standings, side-bet list, menus, and Settings visual restyle via `app/arc-redesign.css`. No data or event handlers changed.
- Local adaptation of Arc UI's MIT-licensed Segmented Control in Settings appearance. Preserves the two choices (Light and Dark); theme persistence remains the app's existing implementation.
- A compact profile initials avatar, grouped settings cards, and simplified controls.
- Existing fixed nav geometry, safe-area height, and no-translate rules are untouched.
- Dark theme tokens and logo outlines remain supported.

## Arc integration
Arc MCP for Claude Code (optional; read-only component discovery): `claude mcp add --transport http arc https://uiarc.dev/api/mcp`.

Arc source: https://github.com/kuratlielia/arc-library
Arc docs: https://uiarc.dev/docs/ai

The segmented control is **adapted** from the Arc UI implementation, not installed verbatim: it replaces Motion with a native CSS animated selection to avoid adding packages and changing the production dependency lockfile. See `components/arc/LICENSE`.

## Review before merging
- Check iPhone widths 320, 375 and 430 px, safe areas and bottom nav during scroll.
- Verify open/locked/live/final game cards and team/odds alignment.
- Check Side Bets offer sheets, pending/accepted/ledger, My Card, League Card, and standings.
- Test light/dark transitions and team-logo legibility.
- Verify accessibility focus, reduced motion, and keyboard arrows on appearance control.
- Leave `main` unchanged unless the entire redesign is explicitly approved.

There is no automatic deploy in this commit; a branch preview depends on the connected Vercel project configuration.
