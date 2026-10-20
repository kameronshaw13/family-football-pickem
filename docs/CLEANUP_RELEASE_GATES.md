# Full-scale cleanup status & merge gates
Updated: October 19, 2026.

## PR organization
One codebase maintenance PR (#72), not individual PRs for each extraction.
Design experiments are separate and must not be merged into this PR.

## Verified from repository inspection
- Application styles are loaded from three CSS imports, preserving previous cascade order.
- Several legacy stylesheet files have been removed; **consolidation does not prove duplicate selectors have been eliminated**.
- Core React component has shrunk from ~226KB to ~206KB by extraction of pure formatting, sorting, standings and fixtures.
- Regression tests have been added for some extracted helpers.
- Roboto Slab remains the requested font on this branch.
- The side-bets API and remaining page-sized components still need modularization.
- Branch may be behind main; resolve before merge without overwriting production font changes.

## Required merge gates (added GitHub Actions workflow)
- npm ci; npm run audit:css; npm run typecheck; npm run lint; npm run test; npm run build
- Confirm all flows in phone-sized mobile browser, including login, pick locks, dogs,
  live score changes, offers, canceled and expired offers, banks and payouts.
- No changes to pick/bet records, odds providers, settlement formulas or existing balances.

## Remaining actual work, not completed by this audit
- Split main app state and sections into dedicated components/hooks while avoiding changed fetch cadence.
- Break apart oversized side-bet API route by pure, testable domain logic.
- Reduce conflicting legacy CSS selectors *after* baseline screenshots compare identically.
- Remove stale unused React code only with reference analysis and green CI.
- Validate full regression on 320–430px mobile widths and both appearances.

This audit records factual progress and blockers and should not be interpreted as a completed full codebase cleanup.
