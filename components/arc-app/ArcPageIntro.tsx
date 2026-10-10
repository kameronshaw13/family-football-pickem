import { Activity, ArrowUpRight, CheckCheck, CircleDot, Settings2, Trophy, type LucideIcon } from "lucide-react";

type Section = "picks" | "card" | "standings" | "settings";
type Metric = { label: string; value: string; detail?: string; live?: boolean };
type Props = { section: Section; subview: string; week: number; league: string; user: string; metrics: Metric[] };
const scenes: Record<Section, { eyebrow: string; title: string; description: string; icon: LucideIcon }> = {
  picks: { eyebrow: "THE GAME ROOM", title: "Find your edge.", description: "One slate. Better decisions. Every matchup in its place.", icon: Activity },
  card: { eyebrow: "YOUR WEEK", title: "Own your picks.", description: "Every selection, one clear view.", icon: CheckCheck },
  standings: { eyebrow: "LEAGUE PULSE", title: "The race is on.", description: "Every point and every place, in real time.", icon: Trophy },
  settings: { eyebrow: "YOUR SPACE", title: "Make it yours.", description: "The details that make the experience feel right.", icon: Settings2 }
};

export default function ArcPageIntro({ section, subview, week, league, user, metrics }: Props) {
  const scene = scenes[section];
  const Icon = scene.icon;
  const context = section === "picks" && subview === "sideBets" ? "SIDE BETS" : section === "standings" && subview === "bank" ? "BANK & LEDGER" : scene.eyebrow;
  return (
    <section className="arc-page-intro" aria-label={scene.title}>
      <div className="arc-intro-kicker"><CircleDot size={11} aria-hidden="true" /><span>{context}</span><span className="arc-intro-sep" aria-hidden="true">/</span><span>WEEK {week}</span></div>
      <div className="arc-intro-title-row">
        <div className="arc-intro-headline"><h1>{scene.title}</h1><p>{scene.description}</p></div>
        <span className="arc-intro-symbol" aria-hidden="true"><Icon size={23} strokeWidth={1.65} /></span>
      </div>
      <div className="arc-intro-context"><span className="arc-intro-avatar" aria-hidden="true">{user.trim().slice(0,1).toUpperCase() || "P"}</span><span className="arc-intro-user">{user}</span><span className="arc-intro-sep">·</span><span className="arc-intro-league">{league}</span><ArrowUpRight size={13} aria-hidden="true" /></div>
      {metrics.length > 0 && <div className="arc-metric-grid" aria-label="Weekly overview">
        {metrics.map((metric) => (
          <div className="arc-metric" key={metric.label}>
            <div className="arc-metric-label">{metric.live && <span className="arc-live-dot" aria-hidden="true" />}{metric.label}</div>
            <div className="arc-metric-value">{metric.value}</div>
            <div className="arc-metric-detail">{metric.detail}</div>
          </div>
        ))}
      </div>}
    </section>
  );
}
