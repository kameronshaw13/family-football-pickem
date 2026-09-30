"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type LeagueTier = "1–10" | "11–24" | "25–39" | "40+";
type ProductMode = "Pick'em" | "Pick'em + Side Bets" | "Side Bets Only";
type FootballSlate = "College Football" | "NFL" | "College + NFL";
type ScoringMode = "Winning Percentage" | "Total Wins" | "Confidence Points";
type LedgerUnit = "Bucks ($)" | "Points";
type Screen = "overview" | "preview" | "setup";
type PreviewTab = "Picks" | "My Card" | "Side Bets" | "Standings";
type PreviewModal = "matchup" | "tracker" | null;

type SetupState = {
  commissioner: string;
  leagueName: string;
  leagueTier: LeagueTier;
  productMode: ProductMode;
  footballSlate: FootballSlate;
  scoringMode: ScoringMode;
  weeklyPicks: number;
  dogEnabled: boolean;
  dogPicks: number;
  liveBets: boolean;
  overUnders: boolean;
  moneylines: boolean;
  ledgerUnit: LedgerUnit;
  weekOpen: string;
  lockMode: "Kickoff" | "Saturday 11:00 AM CT";
};

const STORAGE_KEY = "pickem_commissioner_production_sim_v3";

const leaguePricing: Record<LeagueTier, number> = {
  "1–10": 20,
  "11–24": 40,
  "25–39": 60,
  "40+": 80
};

const defaultSetup: SetupState = {
  commissioner: "Kameron",
  leagueName: "Saturday Legends",
  leagueTier: "11–24",
  productMode: "Pick'em + Side Bets",
  footballSlate: "College + NFL",
  scoringMode: "Winning Percentage",
  weeklyPicks: 5,
  dogEnabled: true,
  dogPicks: 1,
  liveBets: true,
  overUnders: true,
  moneylines: true,
  ledgerUnit: "Bucks ($)",
  weekOpen: "Tuesday 9:00 AM CT",
  lockMode: "Kickoff"
};

const stepLabels = ["League Size", "Format", "Sport", "Rules", "Side Bets", "Locks", "Review"];

function Choice({
  active,
  title,
  detail,
  badge,
  onClick
}: {
  active: boolean;
  title: string;
  detail?: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={"sim-choice " + (active ? "active" : "")} onClick={onClick}>
      <span className="sim-choice-dot" aria-hidden="true" />
      <span className="sim-choice-copy">
        <span className="sim-choice-title">
          <strong>{title}</strong>
          {badge && <em>{badge}</em>}
        </span>
        {detail && <small>{detail}</small>}
      </span>
    </button>
  );
}

function Toggle({
  checked,
  title,
  detail,
  onChange
}: {
  checked: boolean;
  title: string;
  detail?: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button type="button" className="sim-toggle-row" onClick={() => onChange(!checked)} aria-pressed={checked}>
      <span>
        <strong>{title}</strong>
        {detail && <small>{detail}</small>}
      </span>
      <span className={"sim-switch " + (checked ? "on" : "")}>
        <span />
      </span>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="sim-summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProductHeader({
  screen,
  onNavigate
}: {
  screen: Screen;
  onNavigate: (next: Screen) => void;
}) {
  return (
    <>
      <header className="sim-scoreboard-header">
        <div className="sim-scoreboard-main">
          <Image src="/football-pickem-wordmark.png" alt="Football Pick'em" width={800} height={100} priority />
          <span className="sim-preview-chip">PREVIEW</span>
        </div>
      </header>
      <nav className="sim-product-tabs" aria-label="Preview navigation">
        <div>
          <button type="button" className={screen === "overview" ? "active" : ""} onClick={() => onNavigate("overview")}>Overview</button>
          <button type="button" className={screen === "preview" ? "active" : ""} onClick={() => onNavigate("preview")}>App Preview</button>
          <button type="button" className={screen === "setup" ? "active" : ""} onClick={() => onNavigate("setup")}>Create League</button>
        </div>
      </nav>
    </>
  );
}

function FeatureCard({
  kicker,
  title,
  copy,
  items,
  action,
  onAction
}: {
  kicker: string;
  title: string;
  copy: string;
  items?: string[];
  action?: string;
  onAction?: () => void;
}) {
  return (
    <article className="sim-feature-card">
      <span className="sim-feature-kicker">{kicker}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
      {items && (
        <ul>
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
      {action && onAction && <button type="button" onClick={onAction}>{action} →</button>}
    </article>
  );
}

function MatchupPreviewDemo({ onClose }: { onClose: () => void }) {
  return (
    <div className="sim-preview-modal" role="dialog" aria-modal="true" aria-label="Matchup Preview demo">
      <div className="sim-modal-head">
        <div>
          <small>MATCHUP PREVIEW</small>
          <strong>#8 Oregon at #12 Penn State</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Close matchup preview">×</button>
      </div>
      <div className="sim-matchup-score">
        <div><span className="sim-logo-ball">O</span><strong>OREGON</strong><b>5–0</b></div>
        <span>AT</span>
        <div><span className="sim-logo-ball">PS</span><strong>PENN STATE</strong><b>4–1</b></div>
      </div>
      <div className="sim-stat-section">
        <div className="sim-stat-title"><strong>FORM</strong><span>Season + ATS</span></div>
        <div className="sim-stat-row"><span>5–0</span><b>Record</b><span>4–1</span></div>
        <div className="sim-stat-row"><span>4–1</span><b>Against the Spread</b><span>3–2</span></div>
        <div className="sim-stat-row"><span>+7.8</span><b>Avg Cover Margin</b><span>+2.4</span></div>
      </div>
      <div className="sim-stat-section">
        <div className="sim-stat-title"><strong>ADVANCED STATS</strong><span>Team strength</span></div>
        <div className="sim-stat-row"><span className="good">18%</span><b>Offensive Success</b><span className="good">15%</span></div>
        <div className="sim-stat-row"><span className="good">41%</span><b>Late Down Success</b><span className="mid">35%</span></div>
        <div className="sim-stat-row"><span className="good">8.1</span><b>Explosiveness</b><span className="mid">6.9</span></div>
        <div className="sim-stat-row"><span className="mid">22</span><b>Defense Rank</b><span className="good">11</span></div>
      </div>
      <p className="sim-demo-footnote">Demo data only. The real preview combines records, ATS form, advanced offense/defense metrics and team-strength context.</p>
    </div>
  );
}

function GameTrackerDemo({ onClose }: { onClose: () => void }) {
  return (
    <div className="sim-preview-modal tracker" role="dialog" aria-modal="true" aria-label="GameTracker demo">
      <div className="sim-modal-head">
        <div>
          <small>GAMETRACKER</small>
          <strong>Oregon at Penn State</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Close GameTracker">×</button>
      </div>
      <div className="sim-tracker-score">
        <div><span className="sim-logo-ball">O</span><strong>Oregon</strong><b>24</b><i><u /><u /><u /></i></div>
        <div className="sim-live-center"><strong>3rd</strong><span>7:42</span><b>3rd & 6</b></div>
        <div><span className="sim-logo-ball">PS</span><strong>Penn State</strong><b>21</b><i><u /><u /><u className="used" /></i></div>
      </div>
      <div className="sim-field">
        <div className="sim-endzone">OREGON</div>
        <div className="sim-field-main">
          <span className="yard y20" />
          <span className="yard y40" />
          <span className="yard y50" />
          <span className="yard y60" />
          <span className="yard y80" />
          <span className="first-line" />
          <span className="los-line" />
          <span className="football">◆</span>
        </div>
        <div className="sim-endzone right">PENN STATE</div>
      </div>
      <div className="sim-tracker-tabs"><b>Scoring</b><b className="active">Live</b><b>Plays</b><b>Box Score</b></div>
      <div className="sim-drive">
        <div><strong>Oregon possession</strong><span>3rd Qtr · 7:42</span></div>
        <p><b>3rd & 6 · PSU 38</b> Pass complete over the middle for 11 yards and a first down.</p>
        <p><b>1st & 10 · PSU 27</b> Rush right side for 4 yards.</p>
      </div>
      <p className="sim-demo-footnote">The live tracker includes score, quarter/time, down & distance, field position, timeouts, drives, scoring, plays and box score views.</p>
    </div>
  );
}

function AppPreview({
  tab,
  onTab,
  modal,
  onModal
}: {
  tab: PreviewTab;
  onTab: (tab: PreviewTab) => void;
  modal: PreviewModal;
  onModal: (modal: PreviewModal) => void;
}) {
  return (
    <div className="sim-preview-layout">
      <section className="sim-phone">
        <div className="sim-phone-header">
          <Image src="/football-pickem-wordmark.png" alt="" width={800} height={100} />
          <span>WEEK 5</span>
        </div>
        <div className="sim-phone-body">
          {tab === "Picks" && (
            <>
              <div className="sim-phone-title">
                <div><small>PICK BOARD</small><strong>College Football</strong></div>
                <span>OPEN</span>
              </div>
              <div className="sim-filter-pills"><b>CFB</b><span>NFL</span><span>All Games</span></div>
              <div className="sim-game">
                <header><span>SAT · 6:30 PM</span><button type="button" onClick={() => onModal("matchup")}>Matchup Preview</button></header>
                <div><i className="sim-logo-ball">O</i><strong><small>#8</small> Oregon</strong><b>-4.5</b></div>
                <div><i className="sim-logo-ball">PS</i><strong><small>#12</small> Penn State</strong><b>+4.5</b></div>
              </div>
              <div className="sim-game live">
                <header><span>LIVE · 3RD 7:42</span><button type="button" onClick={() => onModal("tracker")}>GameTracker</button></header>
                <div><i className="sim-logo-ball">A</i><strong>Alabama</strong><b>24</b></div>
                <div><i className="sim-logo-ball">UG</i><strong>Georgia</strong><b>21</b></div>
              </div>
              <div className="sim-dog-demo">
                <div><strong>DOG PICK</strong><span>Optional weekly underdog challenge</span></div>
                <p>The dog must win outright. A loss does not add a loss. Bigger underdogs earn a larger bonus when they win.</p>
                <div><span>+7 to +9.5 <b>+1</b></span><span>+10 to +19.5 <b>+2</b></span><span>+20+ <b>+3</b></span></div>
              </div>
            </>
          )}

          {tab === "My Card" && (
            <>
              <div className="sim-phone-title"><div><small>MY CARD</small><strong>5 of 6 locked</strong></div><span>83%</span></div>
              <div className="sim-card-list">
                <div><span>ORE</span><strong>Oregon -4.5</strong><b>LOCKED</b></div>
                <div><span>KC</span><strong>Kansas City -3</strong><b>LOCKED</b></div>
                <div><span>PSU</span><strong>Penn State +7.5</strong><b>OPEN</b></div>
                <div className="dog"><span>DOG</span><strong>Arizona +12.5 ML</strong><b>+2</b></div>
              </div>
              <div className="sim-progress-card"><strong>Weekly card</strong><span>Regular picks and dog selections stay together so players always know what remains before lock.</span></div>
            </>
          )}

          {tab === "Side Bets" && (
            <>
              <div className="sim-phone-title"><div><small>SIDE BETS</small><strong>Make an offer</strong></div><span>3 OPEN</span></div>
              <div className="sim-filter-pills"><b>Pregame</b><span>Live</span><span>Spread</span><span>O/U</span></div>
              <div className="sim-offer-card">
                <header><strong>Oregon at Penn State</strong><span>Market -4.5</span></header>
                <p><b>Kameron</b> offers Oregon -3.5 to Mason</p>
                <footer><span>Risk $20</span><b>Win $20</b></footer>
              </div>
              <div className="sim-offer-card">
                <header><strong>Chiefs at Bills</strong><span>Live · 2nd</span></header>
                <p><b>Josh</b> offers Over 47.5 to Caleb</p>
                <footer><span>Risk $20</span><b>Win $20</b></footer>
              </div>
              <div className="sim-progress-card"><strong>Peer-to-peer ledger</strong><span>Pregame and live spreads, moneylines and totals can be tracked without the app holding funds or paying anyone out.</span></div>
            </>
          )}

          {tab === "Standings" && (
            <>
              <div className="sim-phone-title"><div><small>STANDINGS</small><strong>Season</strong></div><span>WK 5</span></div>
              <div className="sim-standings">
                <div className="head"><span>RK</span><strong>PLAYER</strong><b>RECORD</b></div>
                <div><span>1</span><strong>Dad</strong><b>18–7 · 72%</b></div>
                <div><span>2</span><strong>Kameron</strong><b>17–8 · 68%</b></div>
                <div><span>3</span><strong>Mason</strong><b>16–9 · 64%</b></div>
                <div><span>4</span><strong>Josh</strong><b>15–10 · 60%</b></div>
              </div>
              <div className="sim-progress-card"><strong>Commissioner-selected scoring</strong><span>Standings can use winning percentage, total wins or confidence points.</span></div>
            </>
          )}
        </div>
        <nav className="sim-phone-nav">
          {(["Picks", "My Card", "Side Bets", "Standings"] as PreviewTab[]).map((item) => (
            <button key={item} type="button" className={tab === item ? "active" : ""} onClick={() => onTab(item)}>
              <span>{item === "Picks" ? "✓" : item === "My Card" ? "▣" : item === "Side Bets" ? "↔" : "≡"}</span>
              {item}
            </button>
          ))}
        </nav>
      </section>

      <aside className="sim-preview-guide">
        <span className="sim-section-kicker">INTERACTIVE PREVIEW</span>
        <h2>See how the league feels before you create it.</h2>
        <p>Use the bottom navigation just like a member would. The sample data is fake, but the layout and feature flow mirror the real app.</p>
        <div className="sim-guide-list">
          <button type="button" onClick={() => { onTab("Picks"); onModal("matchup"); }}>
            <b>Matchup Preview</b><span>Advanced stats, ATS form, team strength and comparison metrics.</span>
          </button>
          <button type="button" onClick={() => { onTab("Picks"); onModal("tracker"); }}>
            <b>GameTracker</b><span>Live score, field position, down & distance, drives, plays and box score.</span>
          </button>
          <button type="button" onClick={() => onTab("Side Bets")}>
            <b>Side Bets</b><span>Pregame/live challenges with spread, moneyline and over/under markets.</span>
          </button>
          <button type="button" onClick={() => onTab("Standings")}>
            <b>Standings</b><span>Season records update around the commissioner&apos;s scoring rules.</span>
          </button>
        </div>
      </aside>

      {modal && (
        <div className="sim-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) onModal(null);
        }}>
          {modal === "matchup" ? <MatchupPreviewDemo onClose={() => onModal(null)} /> : <GameTrackerDemo onClose={() => onModal(null)} />}
        </div>
      )}
    </div>
  );
}

export default function CommissionerProductionSim() {
  const [screen, setScreen] = useState<Screen>("overview");
  const [step, setStep] = useState(0);
  const [setup, setSetup] = useState<SetupState>(defaultSetup);
  const [created, setCreated] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("Picks");
  const [previewModal, setPreviewModal] = useState<PreviewModal>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { setup?: Partial<SetupState>; step?: number; created?: boolean };
        setSetup((current) => ({ ...current, ...(saved.setup || {}) }));
        if (Number.isInteger(saved.step)) setStep(Math.min(6, Math.max(0, Number(saved.step))));
        setCreated(Boolean(saved.created));
      }
    } catch {
      // Prototype works without storage.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ setup, step, created }));
    } catch {
      // Storage is optional.
    }
  }, [created, loaded, setup, step]);

  const hasPickem = setup.productMode !== "Side Bets Only";
  const hasSideBets = setup.productMode !== "Pick'em";
  const leaguePrice = useMemo(() => leaguePricing[setup.leagueTier], [setup.leagueTier]);
  const dogBonusOne = setup.scoringMode === "Confidence Points" ? "point" : "win";
  const dogBonusMany = setup.scoringMode === "Confidence Points" ? "points" : "wins";

  const flowSteps = useMemo(() => {
    const steps = [0, 1, 2];
    if (hasPickem) steps.push(3);
    if (hasSideBets) steps.push(4);
    steps.push(5, 6);
    return steps;
  }, [hasPickem, hasSideBets]);

  const currentFlowIndex = Math.max(0, flowSteps.indexOf(step));

  const update = <K extends keyof SetupState,>(key: K, value: SetupState[K]) => {
    setSetup((current) => ({ ...current, [key]: value }));
  };

  const goNext = () => {
    const index = flowSteps.indexOf(step);
    if (index >= 0 && index < flowSteps.length - 1) setStep(flowSteps[index + 1]);
  };

  const goBack = () => {
    const index = flowSteps.indexOf(step);
    if (index > 0) setStep(flowSteps[index - 1]);
  };

  const navigate = (next: Screen) => {
    setPreviewModal(null);
    setScreen(next);
  };

  const reset = () => {
    setSetup(defaultSetup);
    setStep(0);
    setCreated(false);
    setScreen("overview");
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage cleanup is optional in prototype mode.
    }
  };

  if (!loaded) {
    return <main className="production-sim"><div className="sim-loading">Loading preview…</div></main>;
  }

  if (created) {
    return (
      <main className="production-sim">
        <ProductHeader screen="setup" onNavigate={(next) => { setCreated(false); navigate(next); }} />
        <section className="sim-created">
          <div className="sim-created-check">✓</div>
          <p className="sim-eyebrow">League created</p>
          <h1>{setup.leagueName}</h1>
          <p className="sim-created-copy">This is the post-checkout state a commissioner would see before inviting the league.</p>
          <div className="sim-invite-card">
            <div><small>INVITE CODE</small><strong>SHAW-26</strong></div>
            <button type="button">Copy Invite Link</button>
          </div>
          <div className="sim-created-summary">
            <SummaryRow label="Format" value={setup.productMode} />
            <SummaryRow label="Football" value={setup.footballSlate} />
            {hasPickem && <SummaryRow label="Weekly card" value={setup.weeklyPicks + " picks" + (setup.dogEnabled ? " + " + setup.dogPicks + (setup.dogPicks === 1 ? " dog" : " dogs") : "")} />}
            <SummaryRow label="Season price" value={"$" + leaguePrice} />
          </div>
          <div className="sim-created-actions">
            <button type="button" className="sim-secondary" onClick={() => { setCreated(false); navigate("setup"); }}>Edit Setup</button>
            <button type="button" className="sim-primary" onClick={reset}>Start Over</button>
          </div>
          <p className="sim-safety-note">Simulation only. No checkout, database record, deposit or payout is created.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="production-sim">
      <ProductHeader screen={screen} onNavigate={navigate} />

      {screen === "overview" && (
        <div className="sim-overview">
          <section className="sim-hero">
            <span className="sim-section-kicker">FOOTBALL PICK&apos;EM</span>
            <h1>Your league. Your rules. One place to pick, challenge and follow every game.</h1>
            <p>Commissioners build the league once, invite everyone, and the app handles weekly picks, side bets, standings, advanced matchup research and live game tracking.</p>
            <div className="sim-hero-actions">
              <button type="button" className="sim-primary" onClick={() => navigate("preview")}>Preview the App</button>
              <button type="button" className="sim-secondary" onClick={() => navigate("setup")}>Create a League</button>
            </div>
          </section>

          <section className="sim-how">
            <div className="sim-section-heading">
              <span className="sim-section-kicker">HOW IT WORKS</span>
              <h2>Simple for the commissioner. Easy for everyone else.</h2>
            </div>
            <div className="sim-how-grid">
              <article><b>1</b><strong>Set the league rules</strong><p>Choose the size, football slate, pick format, scoring and side-bet options.</p></article>
              <article><b>2</b><strong>Invite the group</strong><p>Members join the league from the commissioner&apos;s invite instead of building their own setup.</p></article>
              <article><b>3</b><strong>Play each week</strong><p>Make picks, lock a card, send side-bet offers and use matchup research before kickoff.</p></article>
              <article><b>4</b><strong>Follow it live</strong><p>GameTracker, results, standings and the side-bet ledger keep the league together all weekend.</p></article>
            </div>
          </section>

          <section className="sim-feature-section">
            <div className="sim-section-heading">
              <span className="sim-section-kicker">WHAT&apos;S INCLUDED</span>
              <h2>More than a basic pick&apos;em pool.</h2>
              <p>The commissioner can keep it simple or turn on the deeper features.</p>
            </div>
            <div className="sim-feature-grid">
              <FeatureCard kicker="PICK'EM" title="Flexible weekly cards" copy="Choose 3–15 regular picks and rank the season by winning percentage, total wins or confidence points." items={["College Football, NFL or both", "Game-by-game or universal locks", "My Card keeps every selection together"]} />
              <FeatureCard kicker="DOG PICKS" title="Reward the upset call" copy="An optional dog pick is an underdog moneyline selection that must win the game outright." items={["A losing dog does not add a loss", "+7 to +9.5 = +1 bonus", "+10 to +19.5 = +2 · +20+ = +3", "Win-based leagues award bonus wins; confidence leagues award bonus points"]} />
              <FeatureCard kicker="SIDE BETS" title="Challenge people in the league" copy="Send peer-to-peer offers before or during games while the app keeps the offer and result organized." items={["Spreads, moneylines and totals", "Pregame and live offers", "Weekly and season ledger"]} action="See Side Bets" onAction={() => { setPreviewTab("Side Bets"); navigate("preview"); }} />
              <FeatureCard kicker="MATCHUP PREVIEW" title="Advanced research in the matchup" copy="Open a game before picking it and compare the information that matters without leaving the league." items={["Season and ATS records", "Average cover margin and recent form", "Offense/defense comparison", "Late-down success and team strength"]} action="Open demo" onAction={() => { setPreviewTab("Picks"); setPreviewModal("matchup"); setScreen("preview"); }} />
              <FeatureCard kicker="GAMETRACKER" title="Follow the game inside the app" copy="Once a game is live, the matchup becomes a live tracker instead of sending everyone somewhere else." items={["Quarter, clock, score and timeouts", "Down, distance and field position", "Scoring, drives and play-by-play", "Box score and team stats"]} action="Open demo" onAction={() => { setPreviewTab("Picks"); setPreviewModal("tracker"); setScreen("preview"); }} />
              <FeatureCard kicker="LEAGUE HUB" title="Standings and commissioner control" copy="The league stays in one shared place from Week 1 through the end of the season." items={["Season standings", "Rule summary for every member", "Invite flow and commissioner settings", "Results and side-bet history"]} action="See Standings" onAction={() => { setPreviewTab("Standings"); navigate("preview"); }} />
            </div>
          </section>

          <section className="sim-cta">
            <div><span className="sim-section-kicker">READY TO BUILD IT?</span><h2>Start with the defaults and change only what your league needs.</h2><p>Pick&apos;em + Side Bets, 5 regular picks, 1 dog and winning percentage are preselected.</p></div>
            <button type="button" className="sim-primary" onClick={() => navigate("setup")}>Create League</button>
          </section>
        </div>
      )}

      {screen === "preview" && (
        <div className="sim-preview-page">
          <div className="sim-page-intro">
            <span className="sim-section-kicker">APP PREVIEW</span>
            <h1>Try the member experience.</h1>
            <p>This uses demo teams and demo numbers, but it shows how the actual league UI works before anyone pays or joins.</p>
          </div>
          <AppPreview tab={previewTab} onTab={setPreviewTab} modal={previewModal} onModal={setPreviewModal} />
          <div className="sim-preview-bottom-cta">
            <div><strong>Like the flow?</strong><span>Build the league rules next.</span></div>
            <button type="button" className="sim-primary" onClick={() => navigate("setup")}>Create League</button>
          </div>
        </div>
      )}

      {screen === "setup" && (
        <div className="sim-setup-layout">
          <aside className="sim-progress" aria-label="Commissioner setup progress">
            <p className="sim-eyebrow">Commissioner setup</p>
            <h2>Create your league</h2>
            <div className="sim-progress-list">
              {flowSteps.map((stepIndex, flowIndex) => (
                <button
                  key={stepLabels[stepIndex]}
                  type="button"
                  className={stepIndex === step ? "active" : flowIndex < currentFlowIndex ? "done" : ""}
                  onClick={() => setStep(stepIndex)}
                >
                  <span>{flowIndex < currentFlowIndex ? "✓" : flowIndex + 1}</span>
                  {stepLabels[stepIndex]}
                </button>
              ))}
            </div>
            <div className="sim-safe-card">
              <strong>Preview setup</strong>
              <span>Nothing here charges a card or changes a live league.</span>
            </div>
          </aside>

          <section className="sim-panel">
            <div className="sim-mobile-step">Step {currentFlowIndex + 1} of {flowSteps.length} · {stepLabels[step]}</div>

            {step === 0 && (
              <>
                <p className="sim-eyebrow">League size & price</p>
                <h1>How many people are in your league?</h1>
                <p className="sim-lead">Choose the tier that covers your expected league size. This is one season price paid by the commissioner — members do not buy individual subscriptions.</p>
                <div className="sim-choice-grid two">
                  {(Object.keys(leaguePricing) as LeagueTier[]).map((tier) => (
                    <Choice key={tier} active={setup.leagueTier === tier} title={tier + " people"} detail={"$" + leaguePricing[tier] + " for the league"} onClick={() => update("leagueTier", tier)} />
                  ))}
                </div>
                <div className="sim-price-strip">
                  <span>Selected season price</span><strong>{"$" + leaguePrice}</strong><b>{setup.leagueTier + " players"}</b>
                </div>
                <div className="sim-section">
                  <h3>League details</h3>
                  <p className="sim-section-help">These are the names members will see after they join.</p>
                  <div className="sim-field-grid">
                    <label className="sim-field"><span>Commissioner name</span><input value={setup.commissioner} onChange={(event) => update("commissioner", event.target.value)} /></label>
                    <label className="sim-field"><span>League name</span><input value={setup.leagueName} onChange={(event) => update("leagueName", event.target.value)} /></label>
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <p className="sim-eyebrow">League format</p>
                <h1>What do you want the league to do?</h1>
                <p className="sim-lead">This determines which parts of the app your members see. You can run a traditional pick&apos;em, the side-bet league by itself, or combine both.</p>
                <div className="sim-choice-grid">
                  <Choice active={setup.productMode === "Pick'em"} title="Pick'em" detail="Weekly picks, cards and season standings." onClick={() => update("productMode", "Pick'em")} />
                  <Choice active={setup.productMode === "Pick'em + Side Bets"} title="Pick'em + Side Bets" badge="DEFAULT" detail="The full experience: weekly picks plus peer-to-peer challenges." onClick={() => update("productMode", "Pick'em + Side Bets")} />
                  <Choice active={setup.productMode === "Side Bets Only"} title="Side Bets Only" detail="Skip weekly pick cards and use the offer + ledger system." onClick={() => update("productMode", "Side Bets Only")} />
                </div>
                <div className="sim-help-note"><strong>Not sure?</strong><span>Pick&apos;em + Side Bets keeps every feature available. Members can still ignore Side Bets if they only want to make weekly picks.</span></div>
              </>
            )}

            {step === 2 && (
              <>
                <p className="sim-eyebrow">Sport</p>
                <h1>Choose the football games your league uses.</h1>
                <p className="sim-lead">Football is the first supported sport. You can make the league college-only, NFL-only, or let both appear in the same league.</p>
                <div className="sim-sport-row"><strong>Football</strong><span>AVAILABLE</span></div>
                <div className="sim-section">
                  <h3>Football slate</h3>
                  <div className="sim-choice-grid">
                    {(["College Football", "NFL", "College + NFL"] as FootballSlate[]).map((mode) => (
                      <Choice key={mode} active={setup.footballSlate === mode} title={mode} detail={mode === "College + NFL" ? "Both boards are available to the league." : "Only " + mode + " games appear."} onClick={() => update("footballSlate", mode)} />
                    ))}
                  </div>
                </div>
              </>
            )}

            {step === 3 && hasPickem && (
              <>
                <p className="sim-eyebrow">Pick&apos;em rules</p>
                <h1>Choose how picks turn into standings.</h1>
                <p className="sim-lead">Start with the scoring method, then choose the weekly card size and whether the league includes dog picks.</p>
                <div className="sim-section">
                  <h3>Standings scoring</h3>
                  <p className="sim-section-help">This is the main number used to rank the season standings.</p>
                  <div className="sim-choice-grid">
                    <Choice active={setup.scoringMode === "Winning Percentage"} title="Winning Percentage" badge="DEFAULT" detail="Correct picks ÷ total graded picks. Best when people may have different numbers of graded selections." onClick={() => update("scoringMode", "Winning Percentage")} />
                    <Choice active={setup.scoringMode === "Total Wins"} title="Total Wins" detail="Every correct regular pick is one win. Most wins ranks highest." onClick={() => update("scoringMode", "Total Wins")} />
                    <Choice active={setup.scoringMode === "Confidence Points"} title="Confidence Points" detail={"Rank each weekly pick from 1–" + setup.weeklyPicks + ". Correct picks earn the confidence value assigned to them."} onClick={() => update("scoringMode", "Confidence Points")} />
                  </div>
                </div>
                {setup.scoringMode === "Confidence Points" && (
                  <div className="sim-help-note"><strong>Confidence example</strong><span>With 5 weekly picks, a player must use 1, 2, 3, 4 and 5 exactly once. A correct 5-point pick earns 5 points; a missed pick earns 0.</span></div>
                )}
                <div className="sim-section">
                  <div className="sim-range-head"><h3>Regular picks per week</h3><strong>{setup.weeklyPicks}</strong></div>
                  <p className="sim-section-help">Each member makes this many normal spread picks every week.</p>
                  <input className="sim-range" type="range" min="3" max="15" step="1" value={setup.weeklyPicks} onChange={(event) => update("weeklyPicks", Number(event.target.value))} />
                  <div className="sim-range-labels"><span>3</span><span>15</span></div>
                </div>
                <div className="sim-section">
                  <Toggle checked={setup.dogEnabled} title="Include dog picks" detail="An optional underdog moneyline challenge in addition to the regular weekly picks." onChange={(next) => update("dogEnabled", next)} />
                  {setup.dogEnabled && (
                    <div className="sim-dog-explainer">
                      <div><strong>What is a dog pick?</strong><span>The selected underdog must win the game outright — covering the spread is not enough. If the dog loses, it does not add a loss to the player&apos;s regular record.</span></div>
                      <div className="sim-dog-tiers">
                        <span><b>+7 to +9.5</b><strong>+1 {dogBonusOne}</strong></span>
                        <span><b>+10 to +19.5</b><strong>+2 {dogBonusMany}</strong></span>
                        <span><b>+20 or more</b><strong>+3 {dogBonusMany}</strong></span>
                      </div>
                      <small>{setup.scoringMode === "Confidence Points" ? "In a confidence league, successful dogs award bonus points." : "In a win-based league, successful dogs award bonus wins."}</small>
                    </div>
                  )}
                </div>
                {setup.dogEnabled && (
                  <div className="sim-section">
                    <h3>Dog picks per week</h3>
                    <div className="sim-choice-grid">
                      {([1, 2, 3] as const).map((count) => <Choice key={count} active={setup.dogPicks === count} title={count + (count === 1 ? " dog" : " dogs")} onClick={() => update("dogPicks", count)} />)}
                    </div>
                  </div>
                )}
              </>
            )}

            {step === 4 && hasSideBets && (
              <>
                <p className="sim-eyebrow">Peer-to-peer side bets</p>
                <h1>Choose which challenges members can send.</h1>
                <p className="sim-lead">Members offer bets directly to other people in the league. The app records the terms and result; it does not hold or automatically transfer funds.</p>
                <div className="sim-stack">
                  <Toggle checked={setup.moneylines} title="Moneyline offers" detail="Choose which team wins the game outright." onChange={(next) => update("moneylines", next)} />
                  <Toggle checked={setup.overUnders} title="Over / under offers" detail="Offer a total and choose over or under." onChange={(next) => update("overUnders", next)} />
                  <Toggle checked={setup.liveBets} title="Live offers" detail="Allow supported markets to be offered while the game is in progress." onChange={(next) => update("liveBets", next)} />
                </div>
                <div className="sim-section">
                  <h3>Ledger display</h3>
                  <p className="sim-section-help">This changes how the league labels the amount tracked in side bets.</p>
                  <div className="sim-choice-grid two">
                    <Choice active={setup.ledgerUnit === "Bucks ($)"} title="Bucks ($)" detail="Dollar-style recordkeeping between league members." onClick={() => update("ledgerUnit", "Bucks ($)")} />
                    <Choice active={setup.ledgerUnit === "Points"} title="Points" detail="Use a points label instead of a currency symbol." onClick={() => update("ledgerUnit", "Points")} />
                  </div>
                </div>
                <div className="sim-help-note"><strong>Side-bet boundary</strong><span>No wallet, deposits, withdrawals, custody or automatic payouts. Members settle outside the app.</span></div>
              </>
            )}

            {step === 5 && (
              <>
                <p className="sim-eyebrow">Schedule & locks</p>
                <h1>Choose when each football week becomes active.</h1>
                <p className="sim-lead">The week-open setting controls when the next slate appears. Pick leagues can also decide whether selections lock game-by-game or all at once.</p>
                <div className="sim-section">
                  <h3>Week opens</h3>
                  <div className="sim-choice-grid two">
                    <Choice active={setup.weekOpen === "Tuesday 9:00 AM CT"} title="Tuesday 9:00 AM CT" badge="DEFAULT" detail="Matches the current weekly rollover flow." onClick={() => update("weekOpen", "Tuesday 9:00 AM CT")} />
                    <Choice active={setup.weekOpen === "Monday 9:00 AM CT"} title="Monday 9:00 AM CT" detail="Give members an extra day with the new slate." onClick={() => update("weekOpen", "Monday 9:00 AM CT")} />
                  </div>
                </div>
                {hasPickem && (
                  <div className="sim-section">
                    <h3>Pick lock</h3>
                    <div className="sim-choice-grid two">
                      <Choice active={setup.lockMode === "Kickoff"} title="Lock each game at kickoff" detail="A player can keep changing future games after earlier games begin." onClick={() => update("lockMode", "Kickoff")} />
                      <Choice active={setup.lockMode === "Saturday 11:00 AM CT"} title="Saturday 11:00 AM CT" detail="The entire weekly card freezes at one league-wide deadline." onClick={() => update("lockMode", "Saturday 11:00 AM CT")} />
                    </div>
                  </div>
                )}
                <div className="sim-help-note"><strong>Market lines</strong><span>Lines can refresh during the week. Once a selected game reaches the league&apos;s lock rule, that pick freezes.</span></div>
              </>
            )}

            {step === 6 && (
              <>
                <p className="sim-eyebrow">Review</p>
                <h1>Here&apos;s the league you&apos;re creating.</h1>
                <p className="sim-lead">Nothing is submitted in this preview. This summary is what the commissioner would confirm before the real checkout/create step.</p>
                <div className="sim-review">
                  <div className="sim-review-title">
                    <div><small>LEAGUE</small><strong>{setup.leagueName || "Untitled League"}</strong><span>{"Commissioner: " + (setup.commissioner || "—")}</span></div>
                    <b>{"$" + leaguePrice}</b>
                  </div>
                  <SummaryRow label="League size" value={setup.leagueTier + " people"} />
                  <SummaryRow label="Format" value={setup.productMode} />
                  <SummaryRow label="Football" value={setup.footballSlate} />
                  {hasPickem && <SummaryRow label="Scoring" value={setup.scoringMode} />}
                  {hasPickem && <SummaryRow label="Weekly card" value={setup.weeklyPicks + " regular picks" + (setup.dogEnabled ? " + " + setup.dogPicks + (setup.dogPicks === 1 ? " dog" : " dogs") : "")} />}
                  {hasPickem && setup.dogEnabled && <SummaryRow label="Dog bonus" value={"Tiered bonus " + dogBonusMany} />}
                  <SummaryRow label="Side bets" value={hasSideBets ? "On · " + setup.ledgerUnit : "Off"} />
                  <SummaryRow label="Week opens" value={setup.weekOpen} />
                  {hasPickem && <SummaryRow label="Locks" value={setup.lockMode} />}
                </div>
                <button type="button" className="sim-create-button" onClick={() => setCreated(true)}>Simulate Checkout & Create League</button>
                <p className="sim-fine-print">Prototype only — no payment or database record is created.</p>
              </>
            )}

            <footer className="sim-actions">
              <button type="button" className="sim-secondary" disabled={currentFlowIndex === 0} onClick={goBack}>Back</button>
              {currentFlowIndex < flowSteps.length - 1 && <button type="button" className="sim-primary" onClick={goNext}>Continue</button>}
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
