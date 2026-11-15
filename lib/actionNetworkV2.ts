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
    (selection.period == null || selection.period === "event") &&
    selection.is_alt_market !== true &&
    (selection.is_live === true) === live
  );
}

function validValue(value: unknown): value is number | string {
  return value != null && String(value).trim() !== "" && Number.isFinite(Number(value));
}

function suspended(selection: Selection | undefined) {
  return selection != null && (
    Number(selection.line_status ?? selection.status) === 2 ||
    ["suspended", "closed", "inactive"].includes(String(selection.line_status ?? selection.status ?? "").toLowerCase())
  );
}

/**
 * Return a single pregame row when v2 has genuine quoted values for this book.
 * V2's event snapshot does not establish a live market, even during a live game.
 */
export function actionV2MarketRows(game: V2MarketGame, bookId: number): V2LegacyMarketRow[] {
  const market = game.markets?.[String(bookId)]?.event;
  if (!market) return [];
  const rows: V2LegacyMarketRow[] = [];
  for (const phase of ["game", "live"] as const) {
    const live = phase === "live";
  const awaySpread = eventSide(market.spread, "away", live);
  const homeSpread = eventSide(market.spread, "home", live);
  const awayMoneyline = eventSide(market.moneyline, "away", live);
  const homeMoneyline = eventSide(market.moneyline, "home", live);
  const over = eventSide(market.total, "over", live);
  const under = eventSide(market.total, "under", live);
  const statuses: Record<string, number> = {};
  for (const [key, value] of [
    ["spread_away", awaySpread], ["spread_home", homeSpread],
    ["ml_away", awayMoneyline], ["ml_home", homeMoneyline],
    ["over", over], ["under", under]
  ] as const) {
    if (suspended(value)) statuses[key] = 2;
  }
  const line = (value: unknown) => validValue(value) ? value : null;
  const total = over && under ? (line(over?.value) ?? line(under?.value)) : null;
  const row: V2LegacyMarketRow = {
    book_id: bookId,
    type: phase,
    spread_away: line(awaySpread?.value),
    spread_home: line(homeSpread?.value),
    spread_away_line: line(awaySpread?.odds),
    spread_home_line: line(homeSpread?.odds),
    ml_away: line(awayMoneyline?.odds),
    ml_home: line(homeMoneyline?.odds),
    total,
    over: line(over?.odds),
    under: line(under?.odds),
    line_status: statuses
  };
  if ([row.spread_away,row.spread_home,row.ml_away,row.ml_home,row.total].some((value)=>value!==null)) rows.push(row);
  }
  return rows;
}
