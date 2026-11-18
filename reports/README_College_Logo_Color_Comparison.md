# Division I logo color audit — ESPN vs CBS (November 18, 2026)

**All 365 current Division I schools** were compared with a published school-color reference. Download the [ZIP report](./Division_I_365_College_Logo_Color_Comparison.zip) for the complete CSV, summary counts and methodology. It includes every team's ESPN ID, CBS asset ID, palette, reference URL, three source image scores and school-by-school source comparison. Actual logo asset URLs can be assembled from the documented ESPN/CBS templates in the README.

## One-to-one result (ESPN primary PNG versus CBS standard SVG)

| Result | Teams |
|---|---:|
| Nearly identical color-reference scores | 176 |
| CBS closer | 61 |
| CBS slight edge | 44 |
| ESPN closer | 56 |
| ESPN slight edge | 25 |
| Could not score both reliably | 3 |
| **Total** | **365** |

A second, separate test allows either CBS standard or alternate asset; this gives CBS a small inherent advantage. This dataset has 105 CBS leads, 81 ESPN leads, 176 near ties, and 3 unscorable in the fair comparison.

**Critical caveat:** The color reference was compiled from [Tightknit's school dataset](https://tightknit.ai/team-colors.json), checked November 14, 2026, whose per-school links usually lead to TeamColorCodes. It does not certify institutional athletics' official licensed images. This is a color-only proxy, not a final determination of legal/brand correctness. Institutional university and athletics palette versions sometimes differ.

**Why manual exceptions remain:** ESPN's metadata primary color disagrees substantially with the independently compiled primary color at 126 schools (RGB-distance threshold 50), and six schools were spot-checked against first-party school brand guides. Examples include [Michigan State](https://brand.msu.edu/visual/color-palette), [Ohio State](https://bux.osu.edu/color/primary-colors/), [Oregon](https://communications.uoregon.edu/uo-brand/visual-identity/colors), [Duke](https://brand.duke.edu/colors/), [Clemson](https://www.clemson.edu/brand/color/) and [Wichita State](https://goshockers.com/sports/2015/5/27/Branding.aspx).

**Please do not bulk-publish this file as if it had verified all 365 institutional assets.** It is intended to dramatically narrow which schools need official-athletics checks.

Source identifiers: [current ESPN D1 list](https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?groups=50&limit=500), [CBS logo mapping](https://github.com/kameronshaw13/family-football-pickem/blob/main/lib/cbsLogos.ts). No active app settings or user data were changed.
