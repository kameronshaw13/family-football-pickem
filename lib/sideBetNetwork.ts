/**
 * Canonical browser-side Side Bet requests. Keep transport concerns separate
 * from app state, refresh sequencing, mutations, and optimistic UI updates.
 * All requests retain the existing auth/group headers and no-store policy.
 */
export type SideBetRequestGroup = "shaw-family" | "other-family" | "friends" | "friends-basketball";

export function sideBetRequestHeaders(token: string, group: SideBetRequestGroup, json = false): HeadersInit {
  return json
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-pickem-group": group }
    : { Authorization: `Bearer ${token}`, "x-pickem-group": group };
}

export function sideBetOffersRequest(week: number, token: string, group: SideBetRequestGroup) {
  return {
    url: `/api/side-bets?week=${week}`,
    init: { headers: sideBetRequestHeaders(token, group), cache: "no-store" as const }
  };
}

export function sideBetLedgerRequest(week: number, token: string, group: SideBetRequestGroup) {
  return {
    url: `/api/side-bet-ledger?week=${week}`,
    init: { headers: sideBetRequestHeaders(token, group), cache: "no-store" as const }
  };
}

export function sideBetMutationRequest(
  body: Record<string, unknown>,
  viewWeek: number | null | undefined,
  token: string,
  group: SideBetRequestGroup
) {
  return {
    url: "/api/side-bets",
    init: {
      method: "POST",
      headers: sideBetRequestHeaders(token, group, true),
      body: JSON.stringify({ ...body, viewWeek })
    }
  };
}
