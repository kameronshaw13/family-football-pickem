"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, X } from "lucide-react";
import type { Game } from "@/lib/types";
import { normalizeSpreadForSelectedTeam, spreadText } from "@/lib/spreads";
import { teamDisplayName } from "@/lib/teamNames";

type PreviewTab = "overview" | "advanced" | "recent" | "ats" | "history";

type RecentGame = {
  id: number;
  week: number;
  date: string;
  opponent: string;
  home: boolean;
  teamPoints: number;
  opponentPoints: number;
  margin: number;
  result: "W" | "L" | "T";
};

type AtsGame = {
  id: number;
  week: number;
  date: string;
  opponent: string;
  home: boolean;
  spread: number;
  teamPoints: number;
  opponentPoints: number;
  coverMargin: number;
  result: "W" | "L" | "P";
};

type TeamPreview = {
  name: string;
  record: { wins: number; losses: number };
  scoring: { ppg: number | null; allowedPpg: number | null; margin: number | null };
  regular: {
    yardsPerGame: number | null;
    passYardsPerGame: number | null;
    rushYardsPerGame: number | null;
    turnoversPerGame: number | null;
    thirdDownPct: number | null;
  };
  ats: {
    wins: number;
    losses: number;
    pushes: number;
    avgCoverMargin: number | null;
    recent: AtsGame[];
  };
  advanced: {
    source?: string;
    throughWeek?: number | null;
    offense?: {
      epaPerPlay?: number | null;
      ppaPerPlay?: number | null;
      successRate?: number | null;
      passEpaPerPlay?: number | null;
      rushEpaPerPlay?: number | null;
      passSuccessRate?: number | null;
      rushSuccessRate?: number | null;
      explosiveRate?: number | null;
      yardsPerPlay?: number | null;
      lineYardsPerCarry?: number | null;
      powerSuccessRate?: number | null;
      stuffRate?: number | null;
      earlyDownEpaPerPlay?: number | null;
      lateDownEpaPerPlay?: number | null;
      thirdDownSuccessRate?: number | null;
      redZoneSuccessRate?: number | null;
      pointsPerOpportunity?: number | null;
    };
    defense?: {
      havocRate?: number | null;
      passHavocRate?: number | null;
      rushHavocRate?: number | null;
      frontSevenHavocRate?: number | null;
      dbHavocRate?: number | null;
      sackRate?: number | null;
      tflRate?: number | null;
      driveStoppedRate?: number | null;
      stuffRate?: number | null;
    };
    ranks?: {
      offense?: Record<string, number | null>;
      defense?: Record<string, number | null>;
    };
  } | null;
  power: {
    source?: string;
    throughWeek?: number | null;
    fpi?: number | null;
    fpiRank?: number | null;
    offenseEfficiency?: number | null;
    offenseEfficiencyRank?: number | null;
    defenseEfficiency?: number | null;
    defenseEfficiencyRank?: number | null;
    specialTeamsEfficiency?: number | null;
    specialTeamsEfficiencyRank?: number | null;
    adjustedOffEpa?: number | null;
    adjustedDefEpa?: number | null;
    adjustedNetEpa?: number | null;
    adjustedOffRank?: number | null;
    adjustedDefRank?: number | null;
    adjustedNetRank?: number | null;
  } | null;
  sp: {
    rating: number | null;
    ranking: number | null;
    offense?: { rating?: number | null; ranking?: number | null };
    defense?: { rating?: number | null; ranking?: number | null };
    specialTeams?: { rating?: number | null };
  } | null;
  recent: RecentGame[];
};

type PreviewPayload = {
  season: number;
  throughWeek: number;
  teams: { away: TeamPreview; home: TeamPreview };
  model?: {
    awayScore: number;
    homeScore: number;
    favoriteTeam: string | null;
    spread: number;
    method: string;
  } | null;
  headToHead: {
    team1: string;
    team2: string;
    team1Wins: number;
    team2Wins: number;
    ties: number;
    games: Array<{
      season: number;
      week: number;
      date: string;
      neutralSite: boolean;
      venue: string | null;
      homeTeam: string;
      homeScore: number;
      awayTeam: string;
      awayScore: number;
      winner: string | null;
    }>;
  } | null;
  availability: {
    games: boolean;
    lines: boolean;
    regularStats: boolean;
    advanced: boolean;
    sp: boolean;
    history: boolean;
    baseSource?: string;
    advancedSource?: string | null;
  };
};

function fmt(value: number | null | undefined, digits = 1) {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}

function fmtPct(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(1)}%`;
}

function fmtSigned(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  const fixed = value.toFixed(digits);
  return value > 0 ? `+${fixed}` : fixed;
}

function teamLogo(game: Game, side: "away" | "home") {
  return side === "away" ? game.away_logo_url : game.home_logo_url;
}

function espnTeamIdFromLogo(url: string | null | undefined) {
  if (!url) return null;
  return url.match(/\/(\d+)\.(?:png|svg|webp)(?:\?|$)/i)?.[1] || null;
}

const ADVANCED_METRIC_INFO: Record<string, string> = {
  "EPA / Play": "Expected Points Added per play. Positive means the offense creates scoring value; higher is better.",
  "PPA / Play": "Predicted Points Added per play, another measure of scoring value created on each snap.",
  "Success Rate": "The share of plays that gain enough for the down and distance. Higher means the offense stays on schedule more often.",
  "Pass EPA / Play": "Expected Points Added on passing plays. Higher is better.",
  "Rush EPA / Play": "Expected Points Added on rushing plays. Higher is better.",
  "Pass Success Rate": "The percentage of pass plays graded successful for the situation.",
  "Rush Success Rate": "The percentage of run plays graded successful for the situation.",
  "Explosive Play Rate": "How often the offense creates a big-gain play.",
  "Yards / Play": "Average yards gained per offensive snap.",
  "Line Yards / Carry": "An estimate of rushing production created by the offensive line before the runner adds extra yards.",
  "Early Down EPA / Play": "EPA per play on early downs. Strong numbers help avoid obvious passing situations.",
  "Late Down EPA / Play": "EPA per play on later downs, when conversion pressure is higher.",
  "3rd Down Success Rate": "How often the offense succeeds on third down.",
  "Red Zone Success Rate": "How often red-zone plays are graded successful.",
  "Power Success Rate": "Success rate in short-yardage power-running situations.",
  "Stuff Rate": "The share of runs stopped at or behind the line. Lower is better for the offense.",
  "Points / Opportunity": "Average points scored after creating a quality scoring opportunity.",
  "Adjusted Defensive EPA / Play": "Opponent-adjusted defensive EPA per play. Lower allowed EPA is generally better; use the national rank for the fastest comparison.",
  "FPI Defensive Efficiency": "ESPN FPI's defensive efficiency component.",
  "Defense Rank": "National defensive unit rank. #1 is best.",
  "Drive Stop Rate": "How often the defense ends an opponent drive without allowing points.",
  "Adjusted EPA / Play": "Opponent-adjusted EPA per play for the unit shown.",
  "FPI Efficiency": "ESPN FPI unit efficiency. Use it together with the national unit rank.",
  "Unit Rank": "National rank for the offense or defense shown. #1 is best.",
  "Success Rate / Drive Stop Rate": "The away and home values use the metric appropriate to the labeled unit: offensive success rate or defensive drive-stop rate.",
  "Havoc Rate": "How often the defense creates a disruptive play such as a sack, tackle for loss, forced fumble, or interception.",
  "Pass Havoc Rate": "Defensive havoc created specifically against passing plays.",
  "Rush Havoc Rate": "Defensive havoc created specifically against rushing plays.",
  "Sack Rate": "The percentage of opponent pass plays ending in a sack.",
  "TFL Rate": "The percentage of plays where the defense records a tackle for loss.",
  "Front 7 Havoc Rate": "Disruptive-play rate created by defensive linemen and linebackers.",
  "DB Havoc Rate": "Disruptive-play rate created by defensive backs."
}

function MetricInfo({ label, text }: { label: string; text: string }) {
  return <details className="matchup-metric-info">
    <summary aria-label={`Explain ${label}`}><span aria-hidden="true">i</span></summary>
    <span className="matchup-metric-info-popover"><strong>{label}</strong>{text}</span>
  </details>;
}

function MetricValue({ value, rank }: { value: string; rank?: number | null }) {
  return <strong className="matchup-metric-value"><span>{value}</span>{rank ? <small>#{Math.round(rank)}</small> : null}</strong>;
}

function MetricRow({ label, away, home, awayRank, homeRank }: { label: string; away: string; home: string; awayRank?: number | null; homeRank?: number | null }) {
  const info = ADVANCED_METRIC_INFO[label];
  return <div className="matchup-metric-row">
    <MetricValue value={away} rank={awayRank} />
    <span className="matchup-metric-label"><span>{label}</span>{info ? <MetricInfo label={label} text={info} /> : null}</span>
    <MetricValue value={home} rank={homeRank} />
  </div>;
}

function TeamColumnLabel({ game, side, name }: { game: Game; side: "away" | "home"; name: string }) {
  const logo = teamLogo(game, side);
  return <div className="matchup-team-column-label">
    {logo ? <img src={logo} alt="" width={32} height={32} /> : <span className="matchup-logo-fallback" />}
    <strong>{name}</strong>
  </div>;
}

function TeamSectionTitle({ game, side, name, detail }: { game: Game; side: "away" | "home"; name: string; detail?: string }) {
  const logo = teamLogo(game, side);
  return <div className="matchup-team-section-title">
    {logo ? <img src={logo} alt="" width={34} height={34} /> : <span className="matchup-logo-fallback" />}
    <span><strong>{name}</strong>{detail ? <small>{detail}</small> : null}</span>
  </div>;
}

function hasNumber(value: number | null | undefined) {
  return value != null && Number.isFinite(value);
}

function unitTier(rank: number | null | undefined) {
  if (!hasNumber(rank)) return "Unranked";
  const value = Math.round(Number(rank));
  if (value <= 10) return "Elite";
  if (value <= 25) return "Top 25";
  if (value <= 50) return "Strong";
  if (value <= 85) return "Middle";
  return "Lower tier";
}

function unitSummary(name: string, unit: "offense" | "defense", rank: number | null | undefined) {
  if (!hasNumber(rank)) return `${name} ${unit}: no unit rank available`;
  return `${name} ${unit}: ${unitTier(rank)} (#${Math.round(Number(rank))})`;
}

function matchupUnitRead(offenseName: string, offenseRank: number | null | undefined, defenseName: string, defenseRank: number | null | undefined) {
  if (!hasNumber(offenseRank) || !hasNumber(defenseRank)) {
    return `${unitSummary(offenseName, "offense", offenseRank)} · ${unitSummary(defenseName, "defense", defenseRank)}`;
  }
  const off = Math.round(Number(offenseRank));
  const def = Math.round(Number(defenseRank));
  const gap = Math.abs(off - def);
  const stronger = off < def ? `${offenseName} offense` : def < off ? `${defenseName} defense` : "The two units";
  const comparison = gap < 8 ? "These units grade very similarly." : `${stronger} grades stronger by unit rank.`;
  return `${unitSummary(offenseName, "offense", off)} · ${unitSummary(defenseName, "defense", def)}. ${comparison}`;
}

function advancedSourceLabel(away: TeamPreview, home: TeamPreview) {
  const source = `${away.advanced?.source || ""} ${home.advanced?.source || ""}`;
  if (source.includes("sportsdataverse") && source.includes("cfbd")) return "SportsDataverse / ESPN + CFBD";
  if (source.includes("sportsdataverse")) return "SportsDataverse / ESPN";
  if (source.includes("cfbd")) return "CFBD";
  return "Advanced data";
}

function AdvancedMatchup({ away, home }: { away: TeamPreview; home: TeamPreview }) {
  const awayOffense = away.advanced?.offense;
  const awayDefense = away.advanced?.defense;
  const homeOffense = home.advanced?.offense;
  const homeDefense = home.advanced?.defense;
  const hasDetailedAdvanced = Boolean(awayOffense || awayDefense || homeOffense || homeDefense);

  if (!hasDetailedAdvanced) {
    return <div className="matchup-tab-body">
      <section className="matchup-comparison-block">
        <div className="matchup-comparison-heading"><strong>EFFICIENCY SNAPSHOT</strong><span>ESPN + pick’em data</span></div>
        <MetricRow label="Yards / Game" away={fmt(away.regular.yardsPerGame)} home={fmt(home.regular.yardsPerGame)} />
        <MetricRow label="Pass Yards / Game" away={fmt(away.regular.passYardsPerGame)} home={fmt(home.regular.passYardsPerGame)} />
        <MetricRow label="Rush Yards / Game" away={fmt(away.regular.rushYardsPerGame)} home={fmt(home.regular.rushYardsPerGame)} />
        <MetricRow label="3rd Down" away={fmtPct(away.regular.thirdDownPct)} home={fmtPct(home.regular.thirdDownPct)} />
        <MetricRow label="Turnovers / Game" away={fmt(away.regular.turnoversPerGame)} home={fmt(home.regular.turnoversPerGame)} />
        <MetricRow label="Avg Scoring Margin" away={fmtSigned(away.scoring.margin)} home={fmtSigned(home.scoring.margin)} />
      </section>
      <p className="matchup-data-note">Advanced season data is not available for this historical point in the schedule yet.</p>
    </div>;
  }

  const sourceLabel = advancedSourceLabel(away, home);
  const useEpa = hasNumber(awayOffense?.epaPerPlay) || hasNumber(homeOffense?.epaPerPlay);
  const efficiencyLabel = useEpa ? "EPA / Play" : "PPA / Play";
  const efficiencyAway = useEpa ? awayOffense?.epaPerPlay : awayOffense?.ppaPerPlay;
  const efficiencyHome = useEpa ? homeOffense?.epaPerPlay : homeOffense?.ppaPerPlay;
  const awayOffRank = away.power?.adjustedOffRank ?? away.power?.offenseEfficiencyRank ?? away.sp?.offense?.ranking ?? null;
  const homeOffRank = home.power?.adjustedOffRank ?? home.power?.offenseEfficiencyRank ?? home.sp?.offense?.ranking ?? null;
  const awayDefRank = away.power?.adjustedDefRank ?? away.power?.defenseEfficiencyRank ?? away.sp?.defense?.ranking ?? null;
  const homeDefRank = home.power?.adjustedDefRank ?? home.power?.defenseEfficiencyRank ?? home.sp?.defense?.ranking ?? null;
  const awayOffEfficiency = away.power?.offenseEfficiency ?? away.sp?.offense?.rating ?? null;
  const homeOffEfficiency = home.power?.offenseEfficiency ?? home.sp?.offense?.rating ?? null;
  const awayDefEfficiency = away.power?.defenseEfficiency ?? away.sp?.defense?.rating ?? null;
  const homeDefEfficiency = home.power?.defenseEfficiency ?? home.sp?.defense?.rating ?? null;
  const rank = (value: number | null | undefined) => hasNumber(value) ? `#${Math.round(Number(value))}` : "—";
  const awayVsHome = matchupUnitRead(away.name, awayOffRank, home.name, homeDefRank);
  const homeVsAway = matchupUnitRead(home.name, homeOffRank, away.name, awayDefRank);

  return <div className="matchup-tab-body">
    <section className="matchup-advanced-guide">
      <div className="matchup-advanced-guide-head">
        <strong>QUICK MATCHUP READ</strong>
        <span>#1 is best</span>
      </div>
      <div className="matchup-advanced-read">
        <span>WHEN {away.name.toUpperCase()} HAS THE BALL</span>
        <strong>{awayVsHome}</strong>
      </div>
      <div className="matchup-advanced-read">
        <span>WHEN {home.name.toUpperCase()} HAS THE BALL</span>
        <strong>{homeVsAway}</strong>
      </div>
    </section>
    <section className="matchup-comparison-block">
      <div className="matchup-comparison-heading matchup-explained-heading"><div><strong>OFFENSIVE EFFICIENCY</strong><small>Efficiency and consistency on every snap.</small></div><span>{sourceLabel}</span></div>
      <MetricRow label={useEpa ? "EPA / Play" : "PPA / Play"} away={fmtSigned(efficiencyAway, 3)} home={fmtSigned(efficiencyHome, 3)} awayRank={useEpa ? away.advanced?.ranks?.offense?.epaPerPlay : null} homeRank={useEpa ? home.advanced?.ranks?.offense?.epaPerPlay : null} />
      <MetricRow label="Success Rate" away={fmtPct(awayOffense?.successRate)} home={fmtPct(homeOffense?.successRate)} awayRank={away.advanced?.ranks?.offense?.successRate} homeRank={home.advanced?.ranks?.offense?.successRate} />
      <MetricRow label="Pass EPA / Play" away={fmtSigned(awayOffense?.passEpaPerPlay, 3)} home={fmtSigned(homeOffense?.passEpaPerPlay, 3)} awayRank={away.advanced?.ranks?.offense?.passEpaPerPlay} homeRank={home.advanced?.ranks?.offense?.passEpaPerPlay} />
      <MetricRow label="Rush EPA / Play" away={fmtSigned(awayOffense?.rushEpaPerPlay, 3)} home={fmtSigned(homeOffense?.rushEpaPerPlay, 3)} awayRank={away.advanced?.ranks?.offense?.rushEpaPerPlay} homeRank={home.advanced?.ranks?.offense?.rushEpaPerPlay} />
      <MetricRow label="Pass Success Rate" away={fmtPct(awayOffense?.passSuccessRate)} home={fmtPct(homeOffense?.passSuccessRate)} awayRank={away.advanced?.ranks?.offense?.passSuccessRate} homeRank={home.advanced?.ranks?.offense?.passSuccessRate} />
      <MetricRow label="Rush Success Rate" away={fmtPct(awayOffense?.rushSuccessRate)} home={fmtPct(homeOffense?.rushSuccessRate)} awayRank={away.advanced?.ranks?.offense?.rushSuccessRate} homeRank={home.advanced?.ranks?.offense?.rushSuccessRate} />
      <MetricRow label="Explosive Play Rate" away={fmtPct(awayOffense?.explosiveRate)} home={fmtPct(homeOffense?.explosiveRate)} awayRank={away.advanced?.ranks?.offense?.explosiveRate} homeRank={home.advanced?.ranks?.offense?.explosiveRate} />
      <MetricRow label="Yards / Play" away={fmt(awayOffense?.yardsPerPlay, 2)} home={fmt(homeOffense?.yardsPerPlay, 2)} awayRank={away.advanced?.ranks?.offense?.yardsPerPlay} homeRank={home.advanced?.ranks?.offense?.yardsPerPlay} />
      <MetricRow label="Line Yards / Carry" away={fmt(awayOffense?.lineYardsPerCarry, 2)} home={fmt(homeOffense?.lineYardsPerCarry, 2)} awayRank={away.advanced?.ranks?.offense?.lineYardsPerCarry} homeRank={home.advanced?.ranks?.offense?.lineYardsPerCarry} />
    </section>

    <section className="matchup-comparison-block">
      <div className="matchup-comparison-heading matchup-explained-heading"><div><strong>SITUATIONAL OFFENSE</strong><small>Performance in high-leverage situations.</small></div></div>
      <MetricRow label="Early Down EPA / Play" away={fmtSigned(awayOffense?.earlyDownEpaPerPlay, 3)} home={fmtSigned(homeOffense?.earlyDownEpaPerPlay, 3)} awayRank={away.advanced?.ranks?.offense?.earlyDownEpaPerPlay} homeRank={home.advanced?.ranks?.offense?.earlyDownEpaPerPlay} />
      <MetricRow label="Late Down EPA / Play" away={fmtSigned(awayOffense?.lateDownEpaPerPlay, 3)} home={fmtSigned(homeOffense?.lateDownEpaPerPlay, 3)} awayRank={away.advanced?.ranks?.offense?.lateDownEpaPerPlay} homeRank={home.advanced?.ranks?.offense?.lateDownEpaPerPlay} />
      <MetricRow label="3rd Down Success Rate" away={fmtPct(awayOffense?.thirdDownSuccessRate)} home={fmtPct(homeOffense?.thirdDownSuccessRate)} awayRank={away.advanced?.ranks?.offense?.thirdDownSuccessRate} homeRank={home.advanced?.ranks?.offense?.thirdDownSuccessRate} />
      <MetricRow label="Red Zone Success Rate" away={fmtPct(awayOffense?.redZoneSuccessRate)} home={fmtPct(homeOffense?.redZoneSuccessRate)} awayRank={away.advanced?.ranks?.offense?.redZoneSuccessRate} homeRank={home.advanced?.ranks?.offense?.redZoneSuccessRate} />
      <MetricRow label="Power Success Rate" away={fmtPct(awayOffense?.powerSuccessRate)} home={fmtPct(homeOffense?.powerSuccessRate)} awayRank={away.advanced?.ranks?.offense?.powerSuccessRate} homeRank={home.advanced?.ranks?.offense?.powerSuccessRate} />
      <MetricRow label="Stuff Rate" away={fmtPct(awayOffense?.stuffRate)} home={fmtPct(homeOffense?.stuffRate)} awayRank={away.advanced?.ranks?.offense?.stuffRate} homeRank={home.advanced?.ranks?.offense?.stuffRate} />
      {(hasNumber(awayOffense?.pointsPerOpportunity) || hasNumber(homeOffense?.pointsPerOpportunity)) &&
        <MetricRow label="Points / Opportunity" away={fmt(awayOffense?.pointsPerOpportunity, 2)} home={fmt(homeOffense?.pointsPerOpportunity, 2)} />}
    </section>

    <section className="matchup-comparison-block">
      <div className="matchup-comparison-heading matchup-explained-heading"><div><strong>DEFENSIVE EFFICIENCY</strong><small>Overall opponent-adjusted defensive strength.</small></div></div>
      <MetricRow label="Adjusted Defensive EPA / Play" away={fmtSigned(away.power?.adjustedDefEpa, 3)} home={fmtSigned(home.power?.adjustedDefEpa, 3)} awayRank={awayDefRank} homeRank={homeDefRank} />
      <MetricRow label="FPI Defensive Efficiency" away={fmt(awayDefEfficiency, 1)} home={fmt(homeDefEfficiency, 1)} awayRank={away.power?.defenseEfficiencyRank} homeRank={home.power?.defenseEfficiencyRank} />
      <MetricRow label="Defense Rank" away={rank(awayDefRank)} home={rank(homeDefRank)} />
      <MetricRow label="Drive Stop Rate" away={fmtPct(awayDefense?.driveStoppedRate)} home={fmtPct(homeDefense?.driveStoppedRate)} awayRank={away.advanced?.ranks?.defense?.driveStoppedRate} homeRank={home.advanced?.ranks?.defense?.driveStoppedRate} />
    </section>

    <section className="matchup-comparison-block matchup-unit-comparison">
      <div className="matchup-comparison-heading matchup-explained-heading"><div><strong>{away.name.toUpperCase()} OFFENSE vs {home.name.toUpperCase()} DEFENSE</strong><small>{awayVsHome}</small></div></div>
      <MetricRow label="Adjusted EPA / Play" away={fmtSigned(away.power?.adjustedOffEpa, 3)} home={fmtSigned(home.power?.adjustedDefEpa, 3)} awayRank={awayOffRank} homeRank={homeDefRank} />
      <MetricRow label="FPI Efficiency" away={fmt(awayOffEfficiency, 1)} home={fmt(homeDefEfficiency, 1)} awayRank={away.power?.offenseEfficiencyRank} homeRank={home.power?.defenseEfficiencyRank} />
      <MetricRow label="Unit Rank" away={rank(awayOffRank)} home={rank(homeDefRank)} />
      <MetricRow label="Success Rate / Drive Stop Rate" away={fmtPct(awayOffense?.successRate)} home={fmtPct(homeDefense?.driveStoppedRate)} awayRank={away.advanced?.ranks?.offense?.successRate} homeRank={home.advanced?.ranks?.defense?.driveStoppedRate} />
    </section>

    <section className="matchup-comparison-block matchup-unit-comparison">
      <div className="matchup-comparison-heading matchup-explained-heading"><div><strong>{away.name.toUpperCase()} DEFENSE vs {home.name.toUpperCase()} OFFENSE</strong><small>{homeVsAway}</small></div></div>
      <MetricRow label="Adjusted EPA / Play" away={fmtSigned(away.power?.adjustedDefEpa, 3)} home={fmtSigned(home.power?.adjustedOffEpa, 3)} awayRank={awayDefRank} homeRank={homeOffRank} />
      <MetricRow label="FPI Efficiency" away={fmt(awayDefEfficiency, 1)} home={fmt(homeOffEfficiency, 1)} awayRank={away.power?.defenseEfficiencyRank} homeRank={home.power?.offenseEfficiencyRank} />
      <MetricRow label="Unit Rank" away={rank(awayDefRank)} home={rank(homeOffRank)} />
      <MetricRow label="Success Rate / Drive Stop Rate" away={fmtPct(awayDefense?.driveStoppedRate)} home={fmtPct(homeOffense?.successRate)} awayRank={away.advanced?.ranks?.defense?.driveStoppedRate} homeRank={home.advanced?.ranks?.offense?.successRate} />
    </section>

    <section className="matchup-comparison-block">
      <div className="matchup-comparison-heading matchup-explained-heading"><div><strong>DEFENSIVE DISRUPTION</strong><small>Pressure, negative plays and drive-ending ability.</small></div></div>
      <MetricRow label="Havoc Rate" away={fmtPct(awayDefense?.havocRate)} home={fmtPct(homeDefense?.havocRate)} awayRank={away.advanced?.ranks?.defense?.havocRate} homeRank={home.advanced?.ranks?.defense?.havocRate} />
      <MetricRow label="Pass Havoc Rate" away={fmtPct(awayDefense?.passHavocRate)} home={fmtPct(homeDefense?.passHavocRate)} awayRank={away.advanced?.ranks?.defense?.passHavocRate} homeRank={home.advanced?.ranks?.defense?.passHavocRate} />
      <MetricRow label="Rush Havoc Rate" away={fmtPct(awayDefense?.rushHavocRate)} home={fmtPct(homeDefense?.rushHavocRate)} awayRank={away.advanced?.ranks?.defense?.rushHavocRate} homeRank={home.advanced?.ranks?.defense?.rushHavocRate} />
      <MetricRow label="Sack Rate" away={fmtPct(awayDefense?.sackRate)} home={fmtPct(homeDefense?.sackRate)} awayRank={away.advanced?.ranks?.defense?.sackRate} homeRank={home.advanced?.ranks?.defense?.sackRate} />
      <MetricRow label="TFL Rate" away={fmtPct(awayDefense?.tflRate)} home={fmtPct(homeDefense?.tflRate)} awayRank={away.advanced?.ranks?.defense?.tflRate} homeRank={home.advanced?.ranks?.defense?.tflRate} />
      <MetricRow label="Drive Stop Rate" away={fmtPct(awayDefense?.driveStoppedRate)} home={fmtPct(homeDefense?.driveStoppedRate)} />
      {(hasNumber(awayDefense?.frontSevenHavocRate) || hasNumber(homeDefense?.frontSevenHavocRate)) &&
        <MetricRow label="Front 7 Havoc Rate" away={fmtPct(awayDefense?.frontSevenHavocRate)} home={fmtPct(homeDefense?.frontSevenHavocRate)} />}
      {(hasNumber(awayDefense?.dbHavocRate) || hasNumber(homeDefense?.dbHavocRate)) &&
        <MetricRow label="DB Havoc Rate" away={fmtPct(awayDefense?.dbHavocRate)} home={fmtPct(homeDefense?.dbHavocRate)} />}
    </section>

    <p className="matchup-data-note">Quick rule: higher is generally better for offensive value, success and defensive disruption. For unit strength, use the rank first — #1 is best. Runs stopped at the line is better when lower for the offense.</p>
  </div>;
}

function ResultsTeam({ game, side, team, season }: { game: Game; side: "away" | "home"; team: TeamPreview; season: number }) {
  return <section className="matchup-list-section">
    <TeamSectionTitle game={game} side={side} name={team.name} detail={`${season} results`} />
    {!team.recent.length ? <p className="matchup-empty-copy">No results available.</p> : team.recent.map((row) => <div className="matchup-result-row" key={row.id}>
      <span className={row.result === "W" ? "matchup-result-win" : row.result === "L" ? "matchup-result-loss" : ""}>{row.result}</span>
      <div><strong>{row.home ? "vs" : "at"} {teamDisplayName("CFB", row.opponent)}</strong><small>Week {row.week}</small></div>
      <strong>{row.teamPoints}-{row.opponentPoints}</strong>
    </div>)}
  </section>;
}

function AtsTeam({ game, side, team }: { game: Game; side: "away" | "home"; team: TeamPreview }) {
  return <section className="matchup-list-section">
    <TeamSectionTitle game={game} side={side} name={team.name} detail={`${team.ats.wins}-${team.ats.losses}-${team.ats.pushes} ATS · Avg cover ${fmtSigned(team.ats.avgCoverMargin)}`} />
    {!team.ats.recent.length ? <p className="matchup-empty-copy">No prior spread results available.</p> : team.ats.recent.map((row) => <div className="matchup-result-row matchup-ats-result-row" key={row.id}>
      <span className={row.result === "W" ? "matchup-result-win" : row.result === "L" ? "matchup-result-loss" : ""}>{row.result}</span>
      <div><strong>{row.home ? "vs" : "at"} {teamDisplayName("CFB", row.opponent)} {spreadText(row.spread)}</strong><small>Cover margin {fmtSigned(row.coverMargin)}</small></div>
      <strong>{row.teamPoints}-{row.opponentPoints}</strong>
    </div>)}
  </section>;
}

export default function MatchupPreview({ game, onClose }: { game: Game; onClose: () => void }) {
  const [tab, setTab] = useState<PreviewTab>("overview");
  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  const awayName = teamDisplayName("CFB", game.away_team);
  const homeName = teamDisplayName("CFB", game.home_team);
  const awaySpread = normalizeSpreadForSelectedTeam(game.away_team, game.current_spread_team, game.current_spread);
  const homeSpread = normalizeSpreadForSelectedTeam(game.home_team, game.current_spread_team, game.current_spread);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const priorBodyOverflow = document.body.style.overflow;
    const priorHtmlOverflow = document.documentElement.style.overflow;
    const priorBodyOverscroll = document.body.style.overscrollBehavior;
    const priorHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = priorBodyOverflow;
      document.documentElement.style.overflow = priorHtmlOverflow;
      document.body.style.overscrollBehavior = priorBodyOverscroll;
      document.documentElement.style.overscrollBehavior = priorHtmlOverscroll;
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      try {
        const token = window.localStorage.getItem("pickem_session_token");
        const params = new URLSearchParams({
          away: game.away_team,
          home: game.home_team,
          date: game.commence_time,
          week: String(game.week),
          year: String(new Date(game.commence_time).getUTCFullYear())
        });
        const awayId = espnTeamIdFromLogo(game.away_logo_url);
        const homeId = espnTeamIdFromLogo(game.home_logo_url);
        if (awayId) params.set("awayId", awayId);
        if (homeId) params.set("homeId", homeId);
        const response = await fetch(`/api/cfb-matchup-preview?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
          signal: controller.signal
        });
        const next = await response.json();
        if (!response.ok) throw new Error(next.code === "CFBD_NOT_CONFIGURED" ? "Matchup analytics are being connected." : next.error || "Matchup preview could not load.");
        if (!cancelled) setPayload(next);
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) {
          setError(err instanceof Error ? err.message : "Matchup preview could not load.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [game.away_team, game.home_team, game.away_logo_url, game.home_logo_url, game.commence_time, game.week]);

  const tabs = useMemo(() => ([
    ["overview", "Overview"],
    ["advanced", "Advanced"],
    ["recent", "Results"],
    ["ats", "ATS"],
    ["history", "History"]
  ] as Array<[PreviewTab, string]>), []);

  if (!mounted) return null;

  return createPortal(<div className="matchup-preview-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="matchup-preview-sheet" role="dialog" aria-modal="true" aria-label={`${awayName} at ${homeName} matchup preview`} onClick={(event) => event.stopPropagation()}>
      <header className="matchup-preview-header">
        <div><span>MATCHUP PREVIEW</span></div>
        <button type="button" className="matchup-preview-close" onClick={onClose} aria-label="Close matchup preview"><X size={20} /></button>
      </header>

      <div className="matchup-preview-hero">
        <div className="matchup-preview-team">
          {game.away_logo_url ? <img src={game.away_logo_url} alt="" width={52} height={52} /> : <span className="matchup-logo-fallback" />}
          <span className="matchup-preview-team-name">{game.away_rank ? <small>#{game.away_rank}</small> : null}<strong>{awayName}</strong></span>
          <span className="matchup-preview-team-spread">{spreadText(awaySpread)}</span>
        </div>
        <div className="matchup-preview-at"><span>AT</span></div>
        <div className="matchup-preview-team">
          {game.home_logo_url ? <img src={game.home_logo_url} alt="" width={52} height={52} /> : <span className="matchup-logo-fallback" />}
          <span className="matchup-preview-team-name">{game.home_rank ? <small>#{game.home_rank}</small> : null}<strong>{homeName}</strong></span>
          <span className="matchup-preview-team-spread">{spreadText(homeSpread)}</span>
        </div>
      </div>

      <nav className="matchup-preview-tabs" aria-label="Matchup preview sections">
        {tabs.map(([id, label]) => <button type="button" key={id} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>{label}</button>)}
      </nav>

      <div className="matchup-preview-scroll">
        {loading && <div className="matchup-preview-loading"><LoaderCircle size={21} /><span>Loading matchup data…</span></div>}
        {!loading && error && <div className="matchup-preview-unavailable"><strong>Preview foundation is ready.</strong><p>{error}</p><small>The pick board and spread are unchanged.</small></div>}

        {!loading && payload && tab === "overview" && <div className="matchup-tab-body">
          {payload.model && <section className="matchup-model-card">
            <div className="matchup-model-head"><strong>K MODEL</strong><span>{payload.model.method}</span></div>
            <div className="matchup-model-score">
              <span>{awayName}<strong>{payload.model.awayScore}</strong></span>
              <small>PROJECTED</small>
              <span>{homeName}<strong>{payload.model.homeScore}</strong></span>
            </div>
            <div className="matchup-model-line"><span>Model spread</span><strong>{payload.model.favoriteTeam ? `${teamDisplayName("CFB", payload.model.favoriteTeam)} ${spreadText(payload.model.spread)}` : "Pick 'em"}</strong></div>
          </section>}
          <div className="matchup-columns-header">
            <TeamColumnLabel game={game} side="away" name={payload.teams.away.name} />
            <span>TEAM COMPARISON</span>
            <TeamColumnLabel game={game} side="home" name={payload.teams.home.name} />
          </div>
          <section className="matchup-comparison-block">
            <MetricRow label="Record" away={`${payload.teams.away.record.wins}-${payload.teams.away.record.losses}`} home={`${payload.teams.home.record.wins}-${payload.teams.home.record.losses}`} />
            <MetricRow label="Points / Game" away={fmt(payload.teams.away.scoring.ppg)} home={fmt(payload.teams.home.scoring.ppg)} />
            <MetricRow label="Points Allowed" away={fmt(payload.teams.away.scoring.allowedPpg)} home={fmt(payload.teams.home.scoring.allowedPpg)} />
            <MetricRow label="Avg Margin" away={fmtSigned(payload.teams.away.scoring.margin)} home={fmtSigned(payload.teams.home.scoring.margin)} />
            <MetricRow label="Yards / Game" away={fmt(payload.teams.away.regular.yardsPerGame)} home={fmt(payload.teams.home.regular.yardsPerGame)} />
            <MetricRow label="Pass Yards / Game" away={fmt(payload.teams.away.regular.passYardsPerGame)} home={fmt(payload.teams.home.regular.passYardsPerGame)} />
            <MetricRow label="Rush Yards / Game" away={fmt(payload.teams.away.regular.rushYardsPerGame)} home={fmt(payload.teams.home.regular.rushYardsPerGame)} />
            <MetricRow label="3rd Down" away={fmtPct(payload.teams.away.regular.thirdDownPct)} home={fmtPct(payload.teams.home.regular.thirdDownPct)} />
          </section>
          <section className="matchup-comparison-block">
            <div className="matchup-comparison-heading"><strong>POWER RATINGS</strong></div>
            <MetricRow label="FPI Rank" away={payload.teams.away.power?.fpiRank ? `#${payload.teams.away.power.fpiRank}` : "—"} home={payload.teams.home.power?.fpiRank ? `#${payload.teams.home.power.fpiRank}` : "—"} />
            <MetricRow label="FPI" away={fmtSigned(payload.teams.away.power?.fpi)} home={fmtSigned(payload.teams.home.power?.fpi)} />
            <MetricRow label="Adj EPA Rank" away={payload.teams.away.power?.adjustedNetRank ? `#${payload.teams.away.power.adjustedNetRank}` : "—"} home={payload.teams.home.power?.adjustedNetRank ? `#${payload.teams.home.power.adjustedNetRank}` : "—"} />
            <MetricRow label="Adj EPA / Play" away={fmtSigned(payload.teams.away.power?.adjustedNetEpa, 3)} home={fmtSigned(payload.teams.home.power?.adjustedNetEpa, 3)} />
            <MetricRow label="Offense Rank" away={payload.teams.away.power?.adjustedOffRank ? `#${payload.teams.away.power.adjustedOffRank}` : (payload.teams.away.power?.offenseEfficiencyRank ? `#${payload.teams.away.power.offenseEfficiencyRank}` : "—")} home={payload.teams.home.power?.adjustedOffRank ? `#${payload.teams.home.power.adjustedOffRank}` : (payload.teams.home.power?.offenseEfficiencyRank ? `#${payload.teams.home.power.offenseEfficiencyRank}` : "—")} />
            <MetricRow label="Defense Rank" away={payload.teams.away.power?.adjustedDefRank ? `#${payload.teams.away.power.adjustedDefRank}` : (payload.teams.away.power?.defenseEfficiencyRank ? `#${payload.teams.away.power.defenseEfficiencyRank}` : "—")} home={payload.teams.home.power?.adjustedDefRank ? `#${payload.teams.home.power.adjustedDefRank}` : (payload.teams.home.power?.defenseEfficiencyRank ? `#${payload.teams.home.power.defenseEfficiencyRank}` : "—")} />
          </section>
          <section className="matchup-comparison-block">
            <div className="matchup-comparison-heading"><strong>AGAINST THE SPREAD</strong></div>
            <MetricRow label="ATS Record" away={`${payload.teams.away.ats.wins}-${payload.teams.away.ats.losses}-${payload.teams.away.ats.pushes}`} home={`${payload.teams.home.ats.wins}-${payload.teams.home.ats.losses}-${payload.teams.home.ats.pushes}`} />
            <MetricRow label="Avg Cover Margin" away={fmtSigned(payload.teams.away.ats.avgCoverMargin)} home={fmtSigned(payload.teams.home.ats.avgCoverMargin)} />
          </section>
        </div>}

        {!loading && payload && tab === "advanced" && <AdvancedMatchup away={payload.teams.away} home={payload.teams.home} />}

        {!loading && payload && tab === "recent" && <div className="matchup-tab-body matchup-split-lists">
          <ResultsTeam game={game} side="away" team={payload.teams.away} season={payload.season} />
          <ResultsTeam game={game} side="home" team={payload.teams.home} season={payload.season} />
        </div>}

        {!loading && payload && tab === "ats" && <div className="matchup-tab-body matchup-split-lists">
          <AtsTeam game={game} side="away" team={payload.teams.away} />
          <AtsTeam game={game} side="home" team={payload.teams.home} />
        </div>}

        {!loading && payload && tab === "history" && <div className="matchup-tab-body">
          {!payload.headToHead ? <p className="matchup-empty-copy">Head-to-head history is unavailable.</p> : <>
            <section className="matchup-series-summary">
              <strong>{payload.headToHead.team1Wins}-{payload.headToHead.team2Wins}{payload.headToHead.ties ? `-${payload.headToHead.ties}` : ""}</strong>
              <span>{payload.headToHead.team1} vs {payload.headToHead.team2}</span>
            </section>
            <section className="matchup-list-section">
              {!payload.headToHead.games.length ? <p className="matchup-empty-copy">No prior meetings found.</p> : payload.headToHead.games.map((row) => <div className="matchup-history-row" key={`${row.season}-${row.week}-${row.date}`}>
                <span>{row.season}</span>
                <div><strong>{teamDisplayName("CFB", row.awayTeam)} {row.awayScore} · {teamDisplayName("CFB", row.homeTeam)} {row.homeScore}</strong><small>{row.venue || (row.neutralSite ? "Neutral site" : "Previous meeting")}</small></div>
              </div>)}
            </section>
          </>}
        </div>}
      </div>
    </section>
  </div>, document.body);
}
