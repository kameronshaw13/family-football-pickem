"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type LeagueTier = "1–10" | "11–24" | "25–39" | "40+";
type ProductMode = "Pick'em" | "Pick'em + Side Bets" | "Side Bets Only";
type FootballSlate = "College Football" | "NFL" | "College + NFL";
type ScoringMode = "Winning Percentage" | "Total Wins" | "Confidence Points";
type LedgerUnit = "Bucks ($)" | "Points";
type AuthMode = "create" | "signin";
type AppStage = "auth" | "home" | "setup" | "created";
type SetupStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;

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
  weekOpen: "Monday 9:00 AM CT" | "Tuesday 9:00 AM CT";
  lockMode: "Kickoff" | "Saturday 11:00 AM CT";
};

const STORAGE_KEY = "football_pickem_production_onboarding_v5";

const leaguePricing: Record<LeagueTier, number> = {
  "1–10": 20,
  "11–24": 40,
  "25–39": 60,
  "40+": 80
};

const stepLabels = ["League", "Format", "Sport", "Pick'em", "Side Bets", "Schedule", "Review"];

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

function Choice({ active, title, detail, badge, onClick }: { active: boolean; title: string; detail?: string; badge?: string; onClick: () => void }) {
  return (
    <button type="button" className={"prod-choice " + (active ? "active" : "")} onClick={onClick}>
      <span className="prod-choice-dot" />
      <span className="prod-choice-copy">
        <span className="prod-choice-title"><strong>{title}</strong>{badge && <em>{badge}</em>}</span>
        {active && detail && <small>{detail}</small>}
      </span>
    </button>
  );
}

function Toggle({ checked, title, detail, onChange }: { checked: boolean; title: string; detail?: string; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" className="prod-toggle" aria-pressed={checked} onClick={() => onChange(!checked)}>
      <span><strong>{title}</strong>{detail && <small>{detail}</small>}</span>
      <i className={checked ? "on" : ""}><b /></i>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="prod-summary-row"><span>{label}</span><strong>{value}</strong></div>;
}

export default function CommissionerProductionSim() {
  const [stage, setStage] = useState<AppStage>("auth");
  const [authMode, setAuthMode] = useState<AuthMode>("create");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [step, setStep] = useState<SetupStep>(0);
  const [setup, setSetup] = useState<SetupState>(defaultSetup);
  const [showFeatures, setShowFeatures] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.name) setName(saved.name);
        if (saved.email) setEmail(saved.email);
        if (saved.setup) setSetup((current) => ({ ...current, ...saved.setup }));
        if (saved.stage === "home" || saved.stage === "setup" || saved.stage === "created") setStage(saved.stage);
        if (Number.isInteger(saved.step)) setStep(Math.min(6, Math.max(0, saved.step)) as SetupStep);
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, email, setup, stage, step })); } catch {}
  }, [email, loaded, name, setup, stage, step]);

  useEffect(() => {
    const removeToolbar = () => document.querySelectorAll("vercel-live-feedback").forEach((node) => node.remove());
    removeToolbar();
    const observer = new MutationObserver(removeToolbar);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const hasPickem = setup.productMode !== "Side Bets Only";
  const hasSideBets = setup.productMode !== "Pick'em";
  const price = leaguePricing[setup.leagueTier];

  const flow = useMemo(() => {
    const values: SetupStep[] = [0, 1, 2];
    if (hasPickem) values.push(3);
    if (hasSideBets) values.push(4);
    values.push(5, 6);
    return values;
  }, [hasPickem, hasSideBets]);

  const flowIndex = Math.max(0, flow.indexOf(step));
  const update = <K extends keyof SetupState,>(key: K, value: SetupState[K]) => setSetup((current) => ({ ...current, [key]: value }));

  const beginAccount = () => {
    if (authMode === "create" && !name.trim()) return;
    const display = name.trim() || email.split("@")[0] || "Commissioner";
    setName(display);
    setSetup((current) => ({ ...current, commissioner: current.commissioner || display }));
    setStage("home");
  };

  const beginLeague = () => {
    setSetup((current) => ({ ...current, commissioner: current.commissioner || name || "Commissioner" }));
    setStep(0);
    setStage("setup");
  };

  const next = () => {
    const index = flow.indexOf(step);
    if (index >= 0 && index < flow.length - 1) setStep(flow[index + 1]);
  };

  const back = () => {
    const index = flow.indexOf(step);
    if (index > 0) setStep(flow[index - 1]);
    else setStage("home");
  };

  const reset = () => {
    setStage("auth"); setStep(0); setName(""); setEmail(""); setPassword(""); setJoinCode(""); setSetup(defaultSetup);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  if (!loaded) return <main className="prod-onboarding"><div className="prod-loader">Loading…</div></main>;

  return (
    <main className="prod-onboarding">
      <header className="prod-header">
        <div className="prod-header-inner">
          <button type="button" className="prod-brand" onClick={() => stage !== "auth" && setStage("home")}>
            <Image src="/football-pickem-wordmark.png" alt="Football Pick'em" width={800} height={100} priority />
          </button>
          <div className="prod-header-actions">
            <button type="button" onClick={() => setShowFeatures(true)}>How it works</button>
            <button type="button" className="preview" onClick={() => setShowPreview(true)}>Preview App</button>
          </div>
        </div>
      </header>

      {stage === "auth" && (
        <section className="prod-auth-shell">
          <div className="prod-auth-intro">
            <span className="prod-kicker">FOOTBALL PICK'EM</span>
            <h1>Your league, built your way.</h1>
            <p>Run weekly picks, optional dog picks and peer-to-peer side bets in one league — with advanced matchup research and live GameTracker built in.</p>
            <div className="prod-feature-strip">
              <span><b>Pick'em</b><small>Custom weekly cards</small></span>
              <span><b>Side Bets</b><small>Pregame + live</small></span>
              <span><b>GameTracker</b><small>Follow games live</small></span>
            </div>
          </div>

          <div className="prod-auth-card">
            <div className="prod-auth-tabs">
              <button type="button" className={authMode === "create" ? "active" : ""} onClick={() => setAuthMode("create")}>Create account</button>
              <button type="button" className={authMode === "signin" ? "active" : ""} onClick={() => setAuthMode("signin")}>Sign in</button>
            </div>
            <div className="prod-auth-copy">
              <span>{authMode === "create" ? "NEW ACCOUNT" : "WELCOME BACK"}</span>
              <h2>{authMode === "create" ? "Start your league." : "Sign in to your leagues."}</h2>
              <p>{authMode === "create" ? "Create your account first. You can build a league or join one with an invite after." : "This test flow simulates returning-user sign in."}</p>
            </div>
            {authMode === "create" && <label className="prod-field"><span>Your name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Kameron Shaw" autoComplete="name" /></label>}
            <label className="prod-field"><span>Email</span><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" autoComplete="email" /></label>
            <label className="prod-field"><span>Password</span><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="6+ characters" type="password" autoComplete={authMode === "create" ? "new-password" : "current-password"} /></label>
            <button type="button" className="prod-primary full" disabled={!email.trim() || password.length < 6 || (authMode === "create" && !name.trim())} onClick={beginAccount}>{authMode === "create" ? "Create Account" : "Sign In"}</button>
            <button type="button" className="prod-text-action" onClick={() => setShowPreview(true)}>Want to see the app first? Preview it →</button>
          </div>
        </section>
      )}

      {stage === "home" && (
        <section className="prod-home">
          <span className="prod-kicker">WELCOME{name ? ", " + name.toUpperCase() : ""}</span>
          <h1>What do you want to do?</h1>
          <p className="prod-home-lead">Create a new league as commissioner or join one someone already made.</p>
          <div className="prod-start-grid">
            <button type="button" className="prod-start-card primary" onClick={beginLeague}>
              <span>COMMISSIONER</span><strong>Create a League</strong><small>Choose the format, football slate, scoring, dog picks, side bets and lock rules.</small><b>Start setup →</b>
            </button>
            <div className="prod-start-card">
              <span>PLAYER</span><strong>Join a League</strong><small>Enter the invite code your commissioner sent you.</small>
              <label className="prod-inline-code"><input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="INVITE CODE" /><button type="button" disabled={!joinCode.trim()}>Join</button></label>
            </div>
          </div>
          <div className="prod-home-tools"><button type="button" onClick={() => setShowPreview(true)}>Preview the member app</button><button type="button" onClick={() => setShowFeatures(true)}>See everything included</button></div>
        </section>
      )}

      {stage === "setup" && (
        <div className="prod-setup-shell">
          <aside className="prod-setup-nav">
            <span className="prod-kicker">CREATE LEAGUE</span><h2>{setup.leagueName || "New League"}</h2>
            <div className="prod-step-list">{flow.map((value, index) => <button type="button" key={value} className={value === step ? "active" : index < flowIndex ? "done" : ""} onClick={() => setStep(value)}><i>{index < flowIndex ? "✓" : index + 1}</i><span>{stepLabels[value]}</span></button>)}</div>
            <button type="button" className="prod-preview-side" onClick={() => setShowPreview(true)}>Preview App</button>
          </aside>

          <section className="prod-setup-panel">
            <div className="prod-mobile-progress">Step {flowIndex + 1} of {flow.length} · {stepLabels[step]}</div>

            {step === 0 && <>
              <span className="prod-kicker">LEAGUE</span><h1>Start with the basics.</h1><p className="prod-lead">Give the league a name and choose the size tier. The commissioner pays one season price for the whole league.</p>
              <label className="prod-field"><span>League name</span><input value={setup.leagueName} onChange={(event) => update("leagueName", event.target.value)} placeholder="Saturday Legends" /></label>
              <div className="prod-section"><div className="prod-section-head"><h3>League size</h3><strong>{"$" + price}</strong></div><div className="prod-choice-grid two">{(Object.keys(leaguePricing) as LeagueTier[]).map((tier) => <Choice key={tier} active={setup.leagueTier === tier} title={tier + " players"} detail={"$" + leaguePricing[tier] + " for the full season"} onClick={() => update("leagueTier", tier)} />)}</div></div>
            </>}

            {step === 1 && <>
              <span className="prod-kicker">FORMAT</span><h1>What kind of league is it?</h1><p className="prod-lead">Turn on only the parts your group wants.</p>
              <div className="prod-choice-grid"><Choice active={setup.productMode === "Pick'em"} title="Pick'em" detail="Weekly cards, standings and dog picks." onClick={() => update("productMode", "Pick'em")} /><Choice active={setup.productMode === "Pick'em + Side Bets"} title="Pick'em + Side Bets" badge="DEFAULT" detail="The full league experience." onClick={() => update("productMode", "Pick'em + Side Bets")} /><Choice active={setup.productMode === "Side Bets Only"} title="Side Bets Only" detail="Skip weekly cards and use the challenge + ledger system." onClick={() => update("productMode", "Side Bets Only")} /></div>
            </>}

            {step === 2 && <>
              <span className="prod-kicker">SPORT</span><h1>Choose the football slate.</h1><p className="prod-lead">Football is the first supported sport. More sports can be added later without changing the league model.</p>
              <div className="prod-choice-grid">{(["College Football", "NFL", "College + NFL"] as FootballSlate[]).map((value) => <Choice key={value} active={setup.footballSlate === value} title={value} detail={value === "College + NFL" ? "Members can use both boards in the same league." : "Only " + value + " games appear."} onClick={() => update("footballSlate", value)} />)}</div>
            </>}

            {step === 3 && hasPickem && <>
              <span className="prod-kicker">PICK'EM</span><h1>Set the weekly game.</h1><p className="prod-lead">Choose how standings work, how many regular picks each member makes, and whether dog picks are included.</p>
              <div className="prod-section"><h3>Standings</h3><div className="prod-choice-grid"><Choice active={setup.scoringMode === "Winning Percentage"} title="Winning Percentage" badge="DEFAULT" detail="Correct picks divided by graded picks." onClick={() => update("scoringMode", "Winning Percentage")} /><Choice active={setup.scoringMode === "Total Wins"} title="Total Wins" detail="Each correct regular pick is one win." onClick={() => update("scoringMode", "Total Wins")} /><Choice active={setup.scoringMode === "Confidence Points"} title="Confidence Points" detail={"With " + setup.weeklyPicks + " picks, assign 1–" + setup.weeklyPicks + " exactly once. Correct picks earn their assigned value."} onClick={() => update("scoringMode", "Confidence Points")} /></div></div>
              <div className="prod-section"><div className="prod-section-head"><h3>Regular picks per week</h3><strong>{setup.weeklyPicks}</strong></div><input className="prod-range" type="range" min="3" max="15" value={setup.weeklyPicks} onChange={(event) => update("weeklyPicks", Number(event.target.value))} /><div className="prod-range-labels"><span>3</span><span>15</span></div></div>
              <div className="prod-section"><Toggle checked={setup.dogEnabled} title="Include dog picks" detail="An underdog moneyline pick that must win outright." onChange={(value) => update("dogEnabled", value)} />{setup.dogEnabled && <div className="prod-dog-card"><div><span>DOG PICK</span><strong>Reward the upset call.</strong><p>A losing dog does not add a regular loss. A winning dog earns a larger bonus as the underdog gets bigger.</p></div><div className="prod-dog-tiers"><span><b>+7 to +9.5</b><strong>+1</strong></span><span><b>+10 to +19.5</b><strong>+2</strong></span><span><b>+20+</b><strong>+3</strong></span></div><small>{setup.scoringMode === "Confidence Points" ? "Bonuses are points in a confidence league." : "Bonuses are wins in a win-based league."}</small></div>}</div>
              {setup.dogEnabled && <div className="prod-section"><h3>Dog picks per week</h3><div className="prod-choice-grid three">{([1,2,3] as const).map((count) => <Choice key={count} active={setup.dogPicks === count} title={count + (count === 1 ? " dog" : " dogs")} onClick={() => update("dogPicks", count)} />)}</div></div>}
            </>}

            {step === 4 && hasSideBets && <>
              <span className="prod-kicker">SIDE BETS</span><h1>Choose how members can challenge each other.</h1><p className="prod-lead">The app records the offer and result. It does not hold funds or automatically pay anyone.</p>
              <div className="prod-toggle-stack"><Toggle checked={setup.moneylines} title="Moneyline" detail="Pick the outright winner." onChange={(value) => update("moneylines", value)} /><Toggle checked={setup.overUnders} title="Over / Under" detail="Offer a game total." onChange={(value) => update("overUnders", value)} /><Toggle checked={setup.liveBets} title="Live offers" detail="Allow challenges while supported games are in progress." onChange={(value) => update("liveBets", value)} /></div>
              <div className="prod-section"><h3>Ledger label</h3><div className="prod-choice-grid two"><Choice active={setup.ledgerUnit === "Bucks ($)"} title="Bucks ($)" detail="Dollar-style tracking between league members." onClick={() => update("ledgerUnit", "Bucks ($)")} /><Choice active={setup.ledgerUnit === "Points"} title="Points" detail="Use points instead of a currency label." onClick={() => update("ledgerUnit", "Points")} /></div></div>
            </>}

            {step === 5 && <>
              <span className="prod-kicker">SCHEDULE</span><h1>Choose when the week opens and locks.</h1><p className="prod-lead">Keep it simple with the defaults or choose a single weekly deadline.</p>
              <div className="prod-section"><h3>New week opens</h3><div className="prod-choice-grid two"><Choice active={setup.weekOpen === "Tuesday 9:00 AM CT"} title="Tuesday 9:00 AM CT" badge="DEFAULT" detail="The next slate appears Tuesday morning." onClick={() => update("weekOpen", "Tuesday 9:00 AM CT")} /><Choice active={setup.weekOpen === "Monday 9:00 AM CT"} title="Monday 9:00 AM CT" detail="Give the league an extra day with the next slate." onClick={() => update("weekOpen", "Monday 9:00 AM CT")} /></div></div>
              {hasPickem && <div className="prod-section"><h3>Pick lock</h3><div className="prod-choice-grid two"><Choice active={setup.lockMode === "Kickoff"} title="Each game at kickoff" detail="Future selections stay editable after earlier games start." onClick={() => update("lockMode", "Kickoff")} /><Choice active={setup.lockMode === "Saturday 11:00 AM CT"} title="One weekly deadline" detail="The full weekly card locks Saturday at 11:00 AM CT." onClick={() => update("lockMode", "Saturday 11:00 AM CT")} /></div></div>}
            </>}

            {step === 6 && <>
              <span className="prod-kicker">REVIEW</span><h1>Everything looks ready.</h1><p className="prod-lead">This is the league members would join after checkout.</p>
              <div className="prod-review"><div className="prod-review-head"><div><small>LEAGUE</small><strong>{setup.leagueName || "Untitled League"}</strong><span>{setup.commissioner || name || "Commissioner"}</span></div><b>{"$" + price}</b></div><SummaryRow label="Players" value={setup.leagueTier} /><SummaryRow label="Format" value={setup.productMode} /><SummaryRow label="Football" value={setup.footballSlate} />{hasPickem && <SummaryRow label="Scoring" value={setup.scoringMode} />}{hasPickem && <SummaryRow label="Weekly card" value={setup.weeklyPicks + " picks" + (setup.dogEnabled ? " + " + setup.dogPicks + (setup.dogPicks === 1 ? " dog" : " dogs") : "")} />}<SummaryRow label="Side bets" value={hasSideBets ? "On · " + setup.ledgerUnit : "Off"} /><SummaryRow label="Week opens" value={setup.weekOpen} />{hasPickem && <SummaryRow label="Locks" value={setup.lockMode} />}</div>
              <div className="prod-review-actions"><button type="button" className="prod-secondary" onClick={() => setShowPreview(true)}>Preview App</button><button type="button" className="prod-primary" onClick={() => setStage("created")}>Simulate Checkout & Create</button></div>
            </>}

            <footer className="prod-setup-actions"><button type="button" className="prod-secondary" onClick={back}>Back</button>{flowIndex < flow.length - 1 && <button type="button" className="prod-primary" onClick={next}>Continue</button>}</footer>
          </section>
        </div>
      )}

      {stage === "created" && <section className="prod-created"><span className="prod-created-check">✓</span><span className="prod-kicker">LEAGUE CREATED</span><h1>{setup.leagueName || "Your League"}</h1><p>Your commissioner setup is complete. The next production step would be inviting members and entering the league hub.</p><div className="prod-invite"><span><small>INVITE CODE</small><strong>PLAY-26</strong></span><button type="button">Copy Invite Link</button></div><div className="prod-created-actions"><button type="button" className="prod-secondary" onClick={() => { setStage("setup"); setStep(6); }}>Edit League</button><button type="button" className="prod-primary" onClick={reset}>Start Over</button></div></section>}

      {showFeatures && <div className="prod-overlay" role="dialog" aria-modal="true"><section className="prod-features-modal"><header><div><span className="prod-kicker">WHAT'S INCLUDED</span><h2>One league from picks to final whistle.</h2></div><button type="button" onClick={() => setShowFeatures(false)}>×</button></header><div className="prod-feature-groups"><article><span>PLAY</span><h3>Weekly Pick'em</h3><p>Custom weekly cards, optional dog picks, confidence scoring and season standings.</p><div><b>3–15 picks</b><b>Dog picks</b><b>Confidence points</b></div></article><article><span>CHALLENGE</span><h3>Side Bets</h3><p>Peer-to-peer pregame and live offers with spreads, moneylines, totals and a shared ledger.</p><div><b>Pregame</b><b>Live</b><b>Spread / ML / O-U</b></div></article><article className="wide"><span>RESEARCH + FOLLOW</span><h3>Matchup Preview & GameTracker</h3><p>Use ATS form, advanced offense/defense metrics and team strength before kickoff, then follow the game live with score, field position, down & distance, drives, plays and box score.</p><div><b>Advanced stats</b><b>ATS form</b><b>Field view</b><b>Play-by-play</b></div></article></div><div className="prod-feature-dog"><div><span>DOG PICK</span><strong>Pick an underdog to win outright.</strong><p>A loss does not add a regular loss. Winning a bigger underdog earns a larger +1 / +2 / +3 bonus.</p></div><button type="button" className="prod-primary" onClick={() => { setShowFeatures(false); setShowPreview(true); }}>Preview the Real App</button></div></section></div>}

      {showPreview && <div className="prod-preview-overlay" role="dialog" aria-modal="true" aria-label="App preview"><div className="prod-preview-bar"><div><strong>Member App Preview</strong><span>This is the actual Pick'em app running on isolated demo data.</span></div><button type="button" onClick={() => setShowPreview(false)}>Close</button></div><iframe src="/production-sim/demo" title="Football Pick'em member app preview" /></div>}
    </main>
  );
}
