/**
 * Action Network's v2 scoreboard provides book markets under
 * games[].markets[bookId].event, rather than the v1 games[].odds array.
 * Keep this adapter pure so feed-shape changes can be tested without network calls.
 */
type Selection = {
  side?: string | null;
  period?: string | null;
  value?: number | string | null;
  odds?: number | string | null;
  status?: string | number | null;
  line_status?: string | number | null;
  is_live?: boolean | null;
  is_alt_market?: boolean | null;
};
type EventMarkets = {
  spread?: Selection[] | null;
  moneyline?: Selection[] | null;
  total?: Selection[] | null;
};
type BookMarkets = { event?: EventMarkets | null };
export type V2MarketGame = {
  markets?: Record<string, BookMarkets | null> | null;
};
export type V2LegacyMarketRow = {
  book_id: number;
  inserted?: string;
  type: "game" | "live";
  spread_home: number | string | null;
  spread_away: number | string | null;
  spread_home_line: number | string | null;
  spread_away_line: number | string | null;
  ml_home: number | string | null;
  ml_away: number | string | null;
  total: number | string | null;
  over: number | string | null;
  under: number | string | null;
  line_status: Record<string, number>;
};

function eventSide(selections: Selection[] | null | undefined, side: string, live: boolean) {
  return (Array.isArray(selections) ? selections : []).find((selection) =>
    selection?.side === side &&
    (selection.period == null || selection.period === "event¶»§q«^