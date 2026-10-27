export type TorvikValue = { value: number | null; rank?: number | null };
export type TorvikPlayer = { id: string; name: string; games: number; year: number; metrics: Record<string, number | null> };
export type TorvikTeam = { name: string; conference: string; record: string; games: number; metrics: Record<string, TorvikValue>; players: TorvikPlayer[] };
type Metric = { key: string; label: string; column: string; group: string; format?: "percent" | "probability" | "integer" | "signed" | "rating"; rankColumn?: string; preseason?: boolean };
export const TORVIK_METRICS: Metric[] = [
  { key: "rank", label: "T-Rank", column: "rank", group: "Efficiency & tempo", format: "integer", preseason: true },
  { key: "adjoe", label: "Adjusted offense", column: "adjoe", rankColumn: "oe Rank", group: "Efficiency & tempo", preseason: true },
  { key: "adjde", label: "Adjusted defense", column: "adjde", rankColumn: "de Rank", group: "Efficiency & tempo", preseason: true },
  { key: "margin", label: "Adjusted margin", column: "", group: "Efficiency & tempo", format: "signed", preseason: true },
  { key: "barthag", label: "Barthag", column: "barthag", group: "Efficiency & tempo", format: "probability", preseason: true },
  { key: "adjt", label: "Adjusted tempo", column: "adjt", group: "Efficiency & tempo", preseason: true },
  { key: "efg", label: "Effective FG%", column: "eFG%", group: "Four Factors", format: "percent" },
  { key: "defEfg", label: "Opponent effective FG%", column: "eFG% Def", group: "Four Factors", format: "percent" },
  { key: "turnover", label: "Turnover rate", column: "TO%", group: "Four Factors", format: "percent" },
  { key: "forceTurnover", label: "Turnovers forced", column: "TO% Def.", group: "Four Factors", format: "percent" },
  { key: "orb", label: "Offensive rebound rate", column: "OR%", group: "Four Factors", format: "percent" },
  { key: "oppOrb", label: "Opponent offensive rebounds", column: "DR%", group: "Four Factors", format: "percent" },
  { key: "ftr", label: "Free-throw rate", column: "FTR", group: "Four Factors", format: "percent" },
  { key: "oppFtr", label: "Opponent free-throw rate", column: "FTR Def", group: "Four Factors", format: "percent" },
  { key: "two", label: "2-point FG%", column: "2p%", group: "Shooting & assists", format: "percent" },
  { key: "oppTwo", label: "Opponent 2-point FG%", column: "2p%D", group: "Shooting & assists", format: "percent" },
  { key: "three", label: "3-point FG%", column: "3P%", group: "Shooting & assists", format: "percent" },
  { key: "oppThree", label: "Opponent 3-point FG%", column: "3pD%", group: "Shooting & assists", format: "percent" },
  { key: "ft", label: "Free-throw %", column: "ft%", group: "Shooting & assists", format: "percent" },
  { key: "oppFt", label: "Opponent free-throw %", column: "ft%D", group: "Shooting & assists", format: "percent" },
  { key: "threeRate", label: "3-point attempt rate", column: "3P rate", group: "Shooting & assists", format: "percent" },
  { key: "oppThreeRate", label: "Opponent 3-point rate", column: "3P rate D", group: "Shooting & assists", format: "percent" },
  { key: "assist", label: "Assist rate", column: "arate", group: "Shooting & assists", format: "percent" },
  { key: "oppAssist", label: "Opponent assist rate", column: "arateD", group: "Shooting & assists", format: "percent" },
  ...[
    ["projW", "Projected wins", "proj. W"], ["projL", "Projected losses", "Proj. L"],
    ["projSos", "Projected schedule strength", "Proj. SOS"], ["projNcSos", "Projected nonconference SOS", "Proj. Noncon SOS"],
    ["projConfSos", "Projected conference SOS", "Proj. Con SOS"], ["eliteSos", "Elite SOS", "elite SOS"],
    ["eliteNcSos", "Elite nonconference SOS", "elite noncon SOS"], ["sos", "Schedule strength", "sos"],
    ["ncSos", "Nonconference SOS", "ncsos"], ["confSos", "Conference SOS", "consos"],
    ["oppO", "Opponent offense", "Opp OE"], ["oppD", "Opponent defense", "Opp DE"],
    ["oppProjO", "Projected opponent offense", "Opp Proj. OE"], ["oppProjD", "Projected opponent defense", "Opp Proj DE"]
  ].map(([key, label, column]) => ({ key, label, column, group: "Schedule & résumé", preseason: key.startsWith("proj") || key.startsWith("elite") || key.startsWith("oppProj") })),
  { key: "wab", label: "Wins above bubble", column: "WAB", rankColumn: "WAB Rk", group: "Schedule & résumé", format: "signed" },
  ...[
    ["confProjW", "Projected conference wins", "Pro Con W"], ["confProjL", "Projected conference losses", "Pro Con L"],
    ["confO", "Conference adjusted offense", "Con Adj OE"], ["confD", "Conference adjusted defense", "Con Adj DE"],
    ["confPts", "Conference points scored", "ConPF"], ["confOppPts", "Conference points allowed", "ConPA"],
    ["confPoss", "Conference possessions", "ConPoss"], ["confRawO", "Conference raw offense", "ConOE"],
    ["confRawD", "Conference raw defense", "ConDE"], ["confRemainSos", "Remaining conference SOS", "ConSOSRemain"],
    ["confWinPct", "Conference win rate", "Conf Win%"], ["qualO", "Quality offense", "Qual O"],
    ["qualD", "Quality defense", "Qual D"], ["qualBarthag", "Quality Barthag", "Qual Barthag"], ["qualGames", "Quality games", "Qual Games"]
  ].map(([key, label, column]) => ({ key, label, column, group: "Conference & quality", preseason: key.startsWith("confProj") || key === "confRemainSos" }))
];

export function torvikNumber(value: unknown): number | null {
  if (value == null || String(value).trim() === "" || !["number", "string"].includes(typeof value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Preserve positional rank columns and quoted player/team names. */
export function torvikCsv(text: string): string[][] {
  if (/^\s*</.test(text)) throw new Error("The stats source did not return a data file.");
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && char === ",") { row.push(cell); cell = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("Incomplete stats download.");
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  return rows;
}

function columnKey(value: string) { return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9%]/g, ""); }
function rank(value: unknown) { const n = torvikNumber(value); return n != null && n >= 1 && Number.isInteger(n) ? n : null; }

export function parseTorvikRatings(text: string): TorvikTeam[] {
  const [headers, ...rows] = torvikCsv(text);
  if (!headers || !["team", "adjoe", "adjde", "record", "adjt"].every(key => headers.some(h => columnKey(h) === key))) throw new Error("Unsupported ratings columns.");
  const index = (name: string) => headers.findIndex(h => columnKey(h) === columnKey(name));
  return rows.flatMap(row => {
    const name = row[index("team")]?.trim();
    const record = row[index("record")]?.trim() || "";
    const result = record.match(/^(\d+)-(\d+)$/);
    if (!name || !result || torvikNumber(row[index("adjoe")]) == null || torvikNumber(row[index("adjde")]) == null) return [];
    const games = Number(result[1]) + Number(result[2]);
    const confRecord = row[index("Con Rec.")]?.match(/^(\d+)-(\d+)$/);
    const conferenceGames = confRecord ? Number(confRecord[1]) + Number(confRecord[2]) : 0;
    const metrics: TorvikTeam["metrics"] = {};
    for (const metric of TORVIK_METRICS.filter(m => !["Four Factors", "Shooting & assists"].includes(m.group))) {
      const value = metric.key === "margin" ? Number(row[index("adjoe")]) - Number(row[index("adjde")]) : torvikNumber(row[index(metric.column)]);
      const unavailable = (!games && !metric.preseason) || (!conferenceGames && metric.key.startsWith("conf") && !metric.preseason) ||
        (metric.key.startsWith("qual") && metric.key !== "qualGames" && !torvikNumber(row[index("Qual Games")]));
      metrics[metric.key] = { value: unavailable ? null : value, rank: !unavailable && metric.rankColumn ? rank(row[index(metric.rankColumn)]) : null };
    }
    return [{ name, conference: row[index("conf")] || "", record, games, metrics, players: [] }];
  });
}

export function parseTorvikFactors(text: string) {
  const [headers, ...rows] = torvikCsv(text);
  if (!headers || columnKey(headers[0]) !== "teamname" || !headers.some(h => columnKey(h) === "efg%")) throw new Error("Unsupported Four Factors columns.");
  return rows.map(row => {
    const metrics: TorvikTeam["metrics"] = {};
    for (const metric of TORVIK_METRICS.filter(m => ["Four Factors", "Shooting & assists"].includes(m.group))) {
      const index = headers.findIndex(h => columnKey(h) === columnKey(metric.column));
      metrics[metric.key] = { value: index < 0 ? null : torvikNumber(row[index]), rank: index >= 0 && /^r(?:an)?k$/i.test(headers[index + 1]?.trim() || "") ? rank(row[index + 1]) : null };
    }
    return { name: row[0], metrics };
  });
}

export const TORVIK_PLAYER_COLUMNS = [
  [4, "Minutes %"], [5, "ORtg"], [6, "Usage %"], [7, "eFG%"], [8, "TS%"], [9, "ORB%"], [10, "DRB%"], [11, "AST%"], [12, "TO%"],
  [15, "FT%"], [18, "2P%"], [21, "3P%"], [22, "BLK%"], [23, "STL%"], [24, "FTR"], [28, "PORPAG"], [29, "Adj. offense"],
  [30, "Fouls / 40"], [35, "AST/TO"], [40, "Rim FG%"], [41, "Midrange FG%"], [44, "Dunk FG%"], [46, "DRtg"],
  [47, "Adj. defense"], [48, "DPORPAG"], [49, "Stops"], [50, "BPM"], [51, "OBPM"], [52, "DBPM"]
] as const;
export function parseTorvikPlayers(text: string, year: number): Array<TorvikPlayer & { team: string }> {
  return torvikCsv(text).flatMap(row => {
    // A changed positional schema must not silently shift stats into other labels.
    if (row.length !== 67 || Number(row[31]) !== year || !row[0] || !row[1] || !row[32]) return [];
    const games = torvikNumber(row[3]);
    if (games == null || games <= 0) return [];
    return [{ id: row[32], name: row[0], team: row[1], games, year, metrics: Object.fromEntries(TORVIK_PLAYER_COLUMNS.map(([index, key]) => {
      const value = torvikNumber(row[index]);
      return [key, value != null && [15, 18, 21, 40, 41, 44].includes(index) ? value * 100 : value];
    })) }];
  });
}

export function torvikSeason(commenceTime: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit" }).formatToParts(new Date(commenceTime));
  const year = Number(parts.find(part => part.type === "year")?.value);
  const month = Number(parts.find(part => part.type === "month")?.value);
  return month >= 7 ? year + 1 : year;
}

export function torvikTeamKey(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim()
    .replace(/^st /, "saint ").replace(/ st$/, " state")
    .replace(/^connecticut\b/, "uconn").replace(/^miami fl\b/, "miami").replace(/^miami oh\b/, "miami ohio")
    .replace(/^southern mississippi\b/, "southern miss").replace(/^mississippi(?=$| rebels\b)/, "ole miss")
    .replace(/^nc state\b/, "north carolina state").replace(/^pennsylvania\b/, "penn")
    .replace(/^ut rio grande valley\b/, "utrgv").replace(/^texas rio grande valley\b/, "utrgv")
    .replace(/^california baptist\b/, "cal baptist").replace(/^cal state\b/, "csu")
    .replace(/^southeast missouri state\b/, "southeast missouri")
    .replace(/^app state\b/, "appalachian state").replace(/^cal st /, "csu ")
    .replace(/^(grambling|mcneese|nicholls|sam houston) state\b/, "$1")
    .replace(/^iu (indianapolis|indy)\b/, "iupui").replace(/^long island university\b/, "liu")
    .replace(/^loyola md\b/, "loyola maryland").replace(/^n c state\b/, "north carolina state")
    .replace(/^nebraska omaha\b/, "omaha").replace(/^southeastern louisiana\b/, "se louisiana")
    .replace(/^ualbany\b/, "albany").replace(/^uic\b/, "illinois chicago")
    .replace(/^ul monroe\b/, "louisiana monroe").replace(/^ut martin\b/, "tennessee martin");

}

export function findTorvikTeam(teams: TorvikTeam[], name: string): TorvikTeam | null {
  const key = torvikTeamKey(name);
  const exact = teams.filter(team => torvikTeamKey(team.name) === key);
  if (exact.length === 1) return exact[0];
  const candidates = teams.filter(team => {
    const school = torvikTeamKey(team.name);
    return key.startsWith(`${school} `) && !/^(state|tech|andm|aandm|a m)\b/.test(key.slice(school.length).trim());
  }).sort((a, b) => torvikTeamKey(b.name).length - torvikTeamKey(a.name).length);
  return candidates.length && (!candidates[1] || torvikTeamKey(candidates[0].name).length > torvikTeamKey(candidates[1].name).length) ? candidates[0] : null;
}
