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
  commissioner: "",
  leagueName: "",
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
        {detail && active && <small>{detail}</small>}
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
  void screen;
  void onNavigate;
  return (
    <header className="sim-scoreboard-header">
      <div className="sim-scoreboard-main">
        <Image src="/football-pickem-wordmark.png" alt="Football Pick'em" width={800} height={100} priority />
        <span className="sim-preview-chip">CREATE LEAGUE</span>
      </div>
    </header>
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

function DemoLogo({ text }: { text: string }) {
  return <span className="team-logo sim-demo-logo" aria-hidden="true">{text}</span>;
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
    <div className="sim-preview-stage">
      <div className="sim-preview-stage-head">
        <div>
          <span className="sim-section-kicker">DEMO LEAGUE · WEEK 5</span>
          <strong>Same structure as the current Pick&apos;em app.</strong>
          <small>Use the bottom navigation inside the preview. Only the data is simulated.</small>
        </div>
        <div className="sim-demo-actions">
          <button type="button" onClick={() => { onTab("Picks"); onModal("matchup"); }}>Matchup Preview</button>
          <button type="button" onClick={() => { onTab("Picks"); onModal("tracker"); }}>GameTracker</button>
        </div>
      </div>

      <section className="sim-app-demo">
        <div className="app-shell">
          <header className="scoreboard-header">
            <div className="scoreboard-main">
              <div className="brand-lockup">
                <Image className="header-wordmark" src="/football-pickem-wordmark.png" alt="Football Pick'em" width={800} height={100} />
              </div>
              <div className="header-slate"><span className="test-week-chip">WEEK 5</span></div>
            </div>
          </header>

          <main className="container">
            {tab === "Picks" && (
              <section className="panel picks-panel">
                <div className="section-tabs">
                  <button type="button" className="active">CFB</button>
                  <button type="button">NFL</button>
                </div>
                <div className="game-days">
                  <div>
                    <div className="game-day-marker"><b>SAT</b><strong>OCT 3</strong></div>
                    <div className="game-list">
                      <article className="game-card status-open">
                        <div className="game-head">
                          <span className="badge open">Open</span>
                          <div className="game-time-group">
                            <span className="game-time">6:30 PM</span>
                            <button type="button" className="sim-inline-app-link" onClick={() => onModal("matchup")}>Matchup Preview</button>
                          </div>
                        </div>
                        <div className="stacked-matchup">
                          <button type="button" className="team-row selectable">
                            <DemoLogo text="O" />
                            <span className="team-name-line"><span className="board-team-rank">#8</span><span className="team-name">Oregon</span></span>
                            <span className="team-spread">−4.5</span>
                          </button>
                          <button type="button" className="team-row selectable">
                            <DemoLogo text="PS" />
                            <span className="team-name-line"><span className="board-team-rank">#12</span><span className="team-name">Penn State</span></span>
                            <span className="team-spread">+4.5</span>
                          </button>
                        </div>
                      </article>
                      <article className="game-card score-values">
                        <div className="game-head">
                          <span className="badge live">Live</span>
                          <div className="game-time-group">
                            <span className="game-live-status">3rd Qtr · 7:42</span>
                            <button type="button" className="sim-inline-app-link" onClick={() => onModal("tracker")}>GameTracker</button>
                          </div>
                        </div>
                        <div className="stacked-matchup">
                          <button type="button" className="team-row">
                            <DemoLogo text="A" />
                            <span className="team-name-line"><span className="team-name">Alabama</span></span>
                            <span className="team-result-score">24</span>
                          </button>
                          <button type="button" className="team-row">
                            <DemoLogo text="UG" />
                            <span className="team-name-line"><span className="team-name">Georgia</span></span>
                            <span className="team-result-score">21</span>
                          </button>
                        </div>
                      </article>
                    </div>
                  </div>
                </div>
                <div className="sim-app-dog-note">
                  <span>DOG PICK</span>
                  <strong>Arizona +12.5 · ML</strong>
                  <small>Win outright for a tiered bonus. A miss does not add a regular loss.</small>
                </div>
              </section>
            )}

            {tab === "My Card" && (
              <section className="panel card-panel">
                <div className="section-tabs">
                  <button type="button" className="active">My Picks</button>
                  <button type="button">League Card</button>
                </div>
                <div className="card-progress">
                  <div className="card-progress-copy">
                    <div className="card-progress-heading"><strong>Week 5 card</strong><span className="card-progress-state saved">5 of 6 locked</span></div>
                    <span className="card-progress-count">1 pick remaining</span>
                  </div>
                  <div className="progress-track"><span style={{ width: "83%" }} /></div>
                </div>
                <div className="pick-section">
                  <h3>Regular Picks</h3>
                  {[
                    ["O","Oregon","−4.5","Locked"],
                    ["KC","Kansas City","−3","Locked"],
                    ["PS","Penn State","+7.5","Open"]
                  ].map(([logo, team, line, state]) => (
                    <div className="pick-card" key={team}>
                      <div className="pick-top">
                        <DemoLogo text={logo} />
                        <div className="pick-copy">
                          <strong className="pick-title"><span className="pick-title-team">{team}</span><span className="pick-title-market">{line}</span></strong>
                          <p className="pick-meta">Week 5</p>
                        </div>
                        <div className="pick-row-actions"><span className={state === "Locked" ? "badge pick-status-locked" : "badge open"}>{state === "Locked" ? "✓" : "Open"}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pick-section">
                  <h3>Dog Pick</h3>
                  <div className="pick-card">
                    <div className="pick-top">
                      <DemoLogo text="AZ" />
                      <div className="pick-copy">
                        <strong className="pick-title"><span className="pick-title-team">Arizona</span><span className="dog-tag">DOG +2</span></strong>
                        <p className="pick-meta">+12.5 · moneyline upset pick</p>
                      </div>
                      <div className="pick-row-actions"><span className="badge pick-status-locked">✓</span></div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {tab === "Side Bets" && (
              <section className="panel">
                <div className="side-bet-offer-mode-row">
                  <div className="side-bet-offer-mode-toggle"><button type="button" className="active">Pregame</button><button type="button">Live</button></div>
                  <div className="side-bet-offer-mode-toggle"><button type="button" className="active">Spread</button><button type="button">O/U</button></div>
                </div>
                <div className="section-title"><div><h2>Open Offers</h2><p>League challenges in one place.</p></div></div>
                <div className="side-bet-list">
                  <div className="side-bet-card">
                    <div className="side-bet-offer-row">
                      <DemoLogo text="O" />
                      <div className="side-bet-offer-copy"><strong>Oregon −3.5</strong><p>Kameron to Mason · market −4.5</p></div>
                      <div className="side-bet-offer-amount">20 pts</div>
                    </div>
                  </div>
                  <div className="side-bet-card">
                    <div className="side-bet-offer-row">
                      <DemoLogo text="KC" />
                      <div className="side-bet-offer-copy"><strong>Over 47.5</strong><p>Josh to Caleb · Chiefs at Bills</p></div>
                      <div className="side-bet-offer-amount">20 pts</div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {tab === "Standings" && (
              <section className="panel standings-panel">
                <div className="section-tabs">
                  <button type="button" className="active">Season</button>
                  <button type="button">Week 5</button>
                </div>
                <div className="leaderboard">
                  <div className="leaderboard-labels"><span>RK</span><span>PLAYER</span><span>W</span><span>L</span><span>P</span><span>PCT</span></div>
                  {[
                    ["1","Dad","18","7","0","72%"],
                    ["2","Kameron","17","8","0","68%"],
                    ["3","Mason","16","9","0","64%"],
                    ["4","Josh","15","10","0","60%"]
                  ].map(([rank, name, w, l, p, pct]) => (
                    <div className="leaderboard-row" key={name}>
                      <span className={"leaderboard-rank rank-" + rank}>{rank}</span>
                      <span className="leaderboard-player"><strong>{name}</strong></span>
                      <span className="leaderboard-stat">{w}</span>
                      <span className="leaderboard-stat">{l}</span>
                      <span className="leaderboard-stat">{p}</span>
                      <strong className="leaderboard-pct">{pct}</strong>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </main>

          <nav className="primary-nav">
            <div className="primary-nav-inner">
              {(["Picks", "My Card", "Side Bets", "Standings"] as PreviewTab[]).map((item) => (
                <button key={item} type="button" className={tab === item ? "active" : ""} onClick={() => onTab(item)}>
                  <span className="sim-demo-nav-icon">{item === "Picks" ? "✓" : item === "My Card" ? "▣" : item === "Side Bets" ? "↔" : "≡"}</span>
                  <span>{item}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>
      </section>

      <p className="sim-preview-caption">The structure and styling now come from the current app. Only the demo data is fake.</p>

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
  const [onboardingStage, setOnboardingStage] = useState<"signup" | "home" | "setup">("signup");
  const [accountName, setAccountName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  useEffect(() => {
    const removePreviewToolbar = () => {
      document.querySelectorAll("vercel-live-feedback").forEach((element) => element.remove());
    };
    removePreviewToolbar();
    const observer = new MutationObserver(removePreviewToolbar);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

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
    setScreen("setup");
    setOnboardingStage("signup");
    setAccountName("");
    setAccountEmail("");
    setAccountPassword("");
    setInviteCode("");
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage cleanup is optional in prototype mode.
    }
  };

  if (!loaded) {
    return <main className="production-sim"><div className="sim-loading">Loading preview…</div></main>;
  }

  if (onboardingStage === "signup") {
    const canCreateAccount = accountName.trim().length > 0 && accountEmail.trim().length > 0 && accountPassword.length >= 6;
    return (
      <main className="production-sim">
        <ProductHeader screen="setup" onNavigate={() => undefined} />
        <section className="sim-signup-shell">
          <div className="sim-signup-intro">
            <p className="sim-eyebrow">FOOTBALL PICK&apos;EM</p>
            <h1>Build the league your group actually wants to play.</h1>
            <p>Start with a commissioner account, create the league rules, then invite everyone else. The member app gets connected after the league is created.</p>
            <div className="sim-signup-features">
              <span><strong>Pick&apos;em</strong><small>Weekly cards + standings</small></span>
              <span><strong>Dog Picks</strong><small>Optional upset bonuses</small></span>
              <span><strong>Side Bets</strong><small>Pregame + live challenges</small></span>
            </div>
          </div>

          <div className="sim-signup-card">
            <div className="sim-auth-heading">
              <span>NEW ACCOUNT</span>
              <h2>Create your account</h2>
              <p>You&apos;ll become the commissioner of any league you create.</p>
            </div>
            <label className="sim-field"><span>Your name</span><input value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Your name" /></label>
            <label className="sim-field"><span>Email</span><input value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} placeholder="you@example.com" type="email" /></label>
            <label className="sim-field"><span>Password</span><input value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} placeholder="At least 6 characters" type="password" /></label>
            <button
              type="button"
              className="sim-primary sim-auth-submit"
              disabled={!canCreateAccount}
              onClick={() => {
                setSetup((current) => ({ ...current, commissioner: accountName.trim() }));
                setOnboardingStage("home");
              }}
            >
              Create Account
            </button>
            <p className="sim-auth-footnote">Prototype flow only — account credentials are not submitted yet.</p>
          </div>
        </section>
      </main>
    );
  }

  if (onboardingStage === "home") {
    return (
      <main className="production-sim">
        <ProductHeader screen="setup" onNavigate={() => undefined} />
        <section className="sim-new-user-home">
          <p className="sim-eyebrow">WELCOME{accountName ? ", " + accountName.toUpperCase() : ""}</p>
          <h1>What do you want to do?</h1>
          <p className="sim-created-copy">Create a new league as commissioner, or join one with an invite code.</p>
          <div className="sim-entry-grid">
            <button
              type="button"
              className="sim-entry-card primary"
              onClick={() => {
                setStep(0);
                setScreen("setup");
                setOnboardingStage("setup");
              }}
            >
              <span>COMMISSIONER</span>
              <strong>Create a League</strong>
              <small>Choose size, format, football slate, scoring, dog picks, side bets and lock rules.</small>
              <b>Start setup →</b>
            </button>
            <div className="sim-entry-card">
              <span>PLAYER</span>
              <strong>Join a League</strong>
              <small>Enter the invite code your commissioner sent you.</small>
              <label className="sim-invite-entry">
                <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="INVITE CODE" />
                <button type="button" disabled={!inviteCode.trim()}>Join</button>
              </label>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (created) {
    return (
      <main className="production-sim">
        <ProductHeader screen="setup" onNavigate={(next) => { setCreated(false); navigate(next); }} />
        <section className="sim-created">
          <div className="sim-created-check">✓</div>
          <p className="sim-eyebrow">League created</p>
          <h1>{setup.leagueName}</h1>
          <p className="sim-created-copy">The league setup is complete. This is the handoff point where we can connect the existing Pick&apos;em member app to the league&apos;s saved rules.</p>
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
            <button type="button" className="sim-secondary" onClick={() => { setCreated(false); setOnboardingStage("setup"); navigate("setup"); }}>Edit Setup</button>
            <button type="button" className="sim-primary" onClick={reset}>Start Over</button>
          </div>
          <p className="sim-safety-note">Prototype only. The next build phase is saving this league and opening the existing member app with these rules.</p>
        </section>
      </main>
    );
  }

  if (screen !== "setup") {
    setScreen("setup");
    return null;
  }

  return (
    <main className="production-sim">
      <ProductHeader screen="setup" onNavigate={navigate} />

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
            <div className="sim-feature-groups">
              <article className="sim-feature-group">
                <span className="sim-feature-kicker">PLAY</span>
                <h3>Weekly Pick&apos;em</h3>
                <p>Regular picks, optional dog picks, My Card and season standings.</p>
                <div className="sim-feature-pills"><span>3–15 picks</span><span>Dog picks</span><span>Confidence</span><span>Standings</span></div>
              </article>
              <article className="sim-feature-group">
                <span className="sim-feature-kicker">CHALLENGE</span>
                <h3>Side Bets</h3>
                <p>Pregame and live league challenges with a shared history and ledger.</p>
                <div className="sim-feature-pills"><span>Spread</span><span>Moneyline</span><span>O/U</span><span>Live</span></div>
                <button type="button" onClick={() => { setPreviewTab("Side Bets"); navigate("preview"); }}>See Side Bets →</button>
              </article>
              <article className="sim-feature-group featured">
                <span className="sim-feature-kicker">RESEARCH + FOLLOW</span>
                <h3>Matchup Preview & GameTracker</h3>
                <p>Advanced matchup research before kickoff, then live game tracking once it starts.</p>
                <div className="sim-feature-pills"><span>ATS form</span><span>Advanced stats</span><span>Field view</span><span>Plays + box</span></div>
                <div className="sim-feature-actions">
                  <button type="button" onClick={() => { setPreviewTab("Picks"); setPreviewModal("matchup"); setScreen("preview"); }}>Matchup Preview</button>
                  <button type="button" onClick={() => { setPreviewTab("Picks"); setPreviewModal("tracker"); setScreen("preview"); }}>GameTracker</button>
                </div>
              </article>
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
