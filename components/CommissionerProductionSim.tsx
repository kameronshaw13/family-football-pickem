"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";

type LeagueTier = "1–10" | "11–24" | "25–39" | "40+";
type LeagueFormat = "Pick'em" | "Pick'em + Side Bets" | "Side Bets Only";
type FootballSlate = "College Football" | "NFL" | "College + NFL";
type ScoringMode = "Winning Percentage" | "Total Wins" | "Confidence Points";
type LedgerUnit = "Bucks ($)" | "Points";
type AuthMode = "create" | "signin";
type Stage = "account" | "home" | "setup" | "created";
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type Setup = {
  commissioner: string;
  leagueName: string;
  leagueTier: LeagueTier;
  leagueFormat: LeagueFormat;
  footballSlate: FootballSlate;
  scoringMode: ScoringMode;
  weeklyPicks: number;
  dogEnabled: boolean;
  dogPicks: number;
  moneylines: boolean;
  totals: boolean;
  liveBets: boolean;
  ledgerUnit: LedgerUnit;
  weekOpen: "Monday 9:00 AM CT" | "Tuesday 9:00 AM CT";
  lockMode: "Kickoff" | "Saturday 11:00 AM CT";
};


const pricing: Record<LeagueTier, number> = {
  "1–10": 20,
  "11–24": 40,
  "25–39": 60,
  "40+": 80
};

const stepNames = ["League", "Format", "Sport", "Pick'em", "Side Bets", "Schedule", "Review"];

const defaultSetup: Setup = {
  commissioner: "",
  leagueName: "",
  leagueTier: "11–24",
  leagueFormat: "Pick'em + Side Bets",
  footballSlate: "College + NFL",
  scoringMode: "Winning Percentage",
  weeklyPicks: 5,
  dogEnabled: true,
  dogPicks: 1,
  moneylines: true,
  totals: true,
  liveBets: true,
  ledgerUnit: "Bucks ($)",
  weekOpen: "Tuesday 9:00 AM CT",
  lockMode: "Kickoff"
};

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
    <button type="button" className={"universal-choice " + (active ? "active" : "")} onClick={onClick}>
      <span className="universal-choice-radio" aria-hidden="true" />
      <span className="universal-choice-copy">
        <span className="universal-choice-title">
          <strong>{title}</strong>
          {badge ? <em>{badge}</em> : null}
        </span>
        {detail ? <small>{detail}</small> : null}
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
    <button type="button" className="universal-toggle" aria-pressed={checked} onClick={() => onChange(!checked)}>
      <span>
        <strong>{title}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
      <i className={checked ? "on" : ""} aria-hidden="true"><b /></i>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="universal-summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function CommissionerProductionSim() {
  const [stage, setStage] = useState<Stage>("account");
  const [authMode, setAuthMode] = useState<AuthMode>("create");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [step, setStep] = useState<Step>(0);
  const [setup, setSetup] = useState<Setup>(defaultSetup);
  const [showFeatures, setShowFeatures] = useState(false);

  useEffect(() => {
    const removeToolbar = () => {
      document.querySelectorAll("vercel-live-feedback").forEach((node) => node.remove());
    };
    removeToolbar();
    const observer = new MutationObserver(removeToolbar);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const hasPickem = setup.leagueFormat !== "Side Bets Only";
  const hasSideBets = setup.leagueFormat !== "Pick'em";
  const seasonPrice = pricing[setup.leagueTier];

  const flow = useMemo(() => {
    const next: Step[] = [0, 1, 2];
    if (hasPickem) next.push(3);
    if (hasSideBets) next.push(4);
    next.push(5, 6);
    return next;
  }, [hasPickem, hasSideBets]);

  const flowIndex = Math.max(0, flow.indexOf(step));

  function update<K extends keyof Setup>(key: K, value: Setup[K]) {
    setSetup((current) => ({ ...current, [key]: value }));
  }

  function finishAccount() {
    if (authMode === "create" && !name.trim()) return;
    const displayName = name.trim() || email.split("@")[0] || "Commissioner";
    setName(displayName);
    setSetup((current) => ({ ...current, commissioner: current.commissioner || displayName }));
    setStage("home");
  }

  function startLeague() {
    setSetup((current) => ({ ...current, commissioner: current.commissioner || name || "Commissioner" }));
    setStep(0);
    setStage("setup");
  }

  function nextStep() {
    const index = flow.indexOf(step);
    if (index >= 0 && index < flow.length - 1) setStep(flow[index + 1]);
  }

  function previousStep() {
    const index = flow.indexOf(step);
    if (index > 0) setStep(flow[index - 1]);
    else setStage("home");
  }

  function resetPrototype() {
    setStage("account");
    setAuthMode("create");
    setName("");
    setEmail("");
    setPassword("");
    setInviteCode("");
    setStep(0);
    setSetup(defaultSetup);
  }

  return (
    <main className="universal-app">
      <header className="universal-header">
        <div className="universal-header-inner">
          <button
            type="button"
            className="universal-brand"
            onClick={() => {
              if (stage !== "account") setStage("home");
            }}
          >
            <Image src="/football-pickem-wordmark.png" alt="Football Pick'em" width={800} height={100} priority />
          </button>
          <button type="button" className="universal-header-help" onClick={() => setShowFeatures(true)}>
            What&apos;s included
          </button>
        </div>
      </header>

      {stage === "account" ? (
        <section className="universal-account-shell universal-screen">
          <div className="universal-account-intro">
            <span className="universal-kicker">FOOTBALL PICK&apos;EM</span>
            <h1>Build the league your group actually wants.</h1>
            <p>One account can create or join leagues. Commissioners choose the rules once; everyone else just joins and plays.</p>
            <div className="universal-value-row">
              <span><strong>Pick&apos;em</strong><small>Custom weekly cards</small></span>
              <span><strong>Side Bets</strong><small>Pregame + live</small></span>
              <span><strong>GameTracker</strong><small>Follow games in-app</small></span>
            </div>
          </div>

          <div className="universal-account-card">
            <div className="universal-auth-tabs">
              <button type="button" className={authMode === "create" ? "active" : ""} onClick={() => setAuthMode("create")}>Create account</button>
              <button type="button" className={authMode === "signin" ? "active" : ""} onClick={() => setAuthMode("signin")}>Sign in</button>
            </div>

            <div className="universal-account-copy">
              <span>{authMode === "create" ? "NEW USER" : "WELCOME BACK"}</span>
              <h2>{authMode === "create" ? "Start with your account." : "Sign in to your leagues."}</h2>
              <p>{authMode === "create" ? "After this, choose whether you want to create a league or join one." : "This prototype keeps sign-in local while we design the final account system."}</p>
            </div>

            {authMode === "create" ? (
              <label className="universal-field">
                <span>Your name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Kameron Shaw" autoComplete="name" />
              </label>
            ) : null}

            <label className="universal-field">
              <span>Email</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" autoComplete="email" />
            </label>

            <label className="universal-field">
              <span>Password</span>
              <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="6+ characters" type="password" autoComplete={authMode === "create" ? "new-password" : "current-password"} />
            </label>

            <button type="button" className="universal-primary universal-full" disabled={!email.trim() || password.length < 6 || (authMode === "create" && !name.trim())} onClick={finishAccount}>
              {authMode === "create" ? "Create Account" : "Sign In"}
            </button>
          </div>
        </section>
      ) : null}

      {stage === "home" ? (
        <section className="universal-home universal-screen">
          <span className="universal-kicker">WELCOME{name ? ", " + name.toUpperCase() : ""}</span>
          <h1>What do you want to do?</h1>
          <p>Start a new league as commissioner, or enter an invite code to join one that already exists.</p>

          <div className="universal-home-grid">
            <button type="button" className="universal-home-card commissioner" onClick={startLeague}>
              <span>COMMISSIONER</span>
              <strong>Create a League</strong>
              <small>Set the format, football slate, weekly picks, dog rules, side bets and schedule.</small>
              <b>Start setup →</b>
            </button>

            <div className="universal-home-card">
              <span>PLAYER</span>
              <strong>Join a League</strong>
              <small>Use the invite code your commissioner sends you.</small>
              <label className="universal-invite">
                <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="INVITE CODE" />
                <button type="button" disabled={!inviteCode.trim()}>Join</button>
              </label>
            </div>
          </div>
        </section>
      ) : null}

      {stage === "setup" ? (
        <div className="universal-setup-shell universal-screen">
          <aside className="universal-steps">
            <span className="universal-kicker">CREATE LEAGUE</span>
            <h2>{setup.leagueName || "New League"}</h2>
            <div>
              {flow.map((value, index) => (
                <button key={value} type="button" className={value === step ? "active" : index < flowIndex ? "done" : ""} onClick={() => setStep(value)}>
                  <i>{index < flowIndex ? "✓" : index + 1}</i>
                  <span>{stepNames[value]}</span>
                </button>
              ))}
            </div>
          </aside>

          <section key={step} className="universal-setup-panel universal-step-screen">
            <div className="universal-mobile-step">Step {flowIndex + 1} of {flow.length} · {stepNames[step]}</div>
            <div className="universal-progress" aria-hidden="true">
              <span style={{ width: (((flowIndex + 1) / flow.length) * 100) + "%" }} />
            </div>

            {step === 0 ? (
              <>
                <span className="universal-kicker">LEAGUE</span>
                <h1>Start with the basics.</h1>
                <p className="universal-lead">Give the league a name and choose the player tier. One commissioner payment covers the league for the season.</p>

                <label className="universal-field">
                  <span>League name</span>
                  <input value={setup.leagueName} onChange={(event) => update("leagueName", event.target.value)} placeholder="Saturday Legends" />
                </label>

                <div className="universal-section">
                  <div className="universal-section-head"><h3>League size</h3><strong>{"$" + seasonPrice}</strong></div>
                  <div className="universal-choice-grid two">
                    {(Object.keys(pricing) as LeagueTier[]).map((tier) => (
                      <Choice key={tier} active={setup.leagueTier === tier} title={tier + " players"} detail={"$" + pricing[tier] + " for the full season"} onClick={() => update("leagueTier", tier)} />
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <span className="universal-kicker">FORMAT</span>
                <h1>What kind of league is it?</h1>
                <p className="universal-lead">Turn on only the parts your group wants. You can keep it simple or use the full experience.</p>
                <div className="universal-choice-grid">
                  <Choice active={setup.leagueFormat === "Pick'em"} title="Pick'em" detail="Weekly picks, My Card and season standings." onClick={() => update("leagueFormat", "Pick'em")} />
                  <Choice active={setup.leagueFormat === "Pick'em + Side Bets"} title="Pick'em + Side Bets" badge="DEFAULT" detail="The full experience: weekly picks plus peer-to-peer challenges." onClick={() => update("leagueFormat", "Pick'em + Side Bets")} />
                  <Choice active={setup.leagueFormat === "Side Bets Only"} title="Side Bets Only" detail="Skip weekly pick cards and use the challenge + ledger system." onClick={() => update("leagueFormat", "Side Bets Only")} />
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <span className="universal-kicker">SPORT</span>
                <h1>Choose the football slate.</h1>
                <p className="universal-lead">Football is the first sport. Pick which games this league can use.</p>
                <div className="universal-choice-grid">
                  {(["College Football", "NFL", "College + NFL"] as FootballSlate[]).map((value) => (
                    <Choice key={value} active={setup.footballSlate === value} title={value} detail={value === "College + NFL" ? "Both boards are available inside one league." : "Only " + value + " games appear."} onClick={() => update("footballSlate", value)} />
                  ))}
                </div>
              </>
            ) : null}

            {step === 3 && hasPickem ? (
              <>
                <span className="universal-kicker">PICK&apos;EM</span>
                <h1>Set the weekly game.</h1>
                <p className="universal-lead">Choose how standings work, how many regular picks each player makes, and whether dog picks are part of the league.</p>

                <div className="universal-section">
                  <h3>Standings scoring</h3>
                  <div className="universal-choice-grid">
                    <Choice active={setup.scoringMode === "Winning Percentage"} title="Winning Percentage" badge="DEFAULT" detail="Correct picks divided by total graded picks." onClick={() => update("scoringMode", "Winning Percentage")} />
                    <Choice active={setup.scoringMode === "Total Wins"} title="Total Wins" detail="Each correct regular pick is one win. Most wins ranks highest." onClick={() => update("scoringMode", "Total Wins")} />
                    <Choice active={setup.scoringMode === "Confidence Points"} title="Confidence Points" detail={"With " + setup.weeklyPicks + " picks, assign 1–" + setup.weeklyPicks + " exactly once. Correct picks earn the assigned value."} onClick={() => update("scoringMode", "Confidence Points")} />
                  </div>
                </div>

                <div className="universal-section">
                  <div className="universal-section-head"><h3>Regular picks per week</h3><strong>{setup.weeklyPicks}</strong></div>
                  <input className="universal-range" type="range" min="3" max="15" step="1" value={setup.weeklyPicks} onChange={(event) => update("weeklyPicks", Number(event.target.value))} />
                  <div className="universal-range-labels"><span>3</span><span>15</span></div>
                </div>

                <div className="universal-section">
                  <Toggle checked={setup.dogEnabled} title="Include dog picks" detail="An underdog moneyline pick that must win outright." onChange={(value) => update("dogEnabled", value)} />
                  {setup.dogEnabled ? (
                    <div className="universal-dog-card">
                      <div>
                        <span>DOG PICK</span>
                        <strong>Reward the upset call.</strong>
                        <p>A losing dog does not add a normal loss. Bigger successful underdogs earn a bigger bonus.</p>
                      </div>
                      <div className="universal-dog-tiers">
                        <span><b>+7 to +9.5</b><strong>+1</strong></span>
                        <span><b>+10 to +19.5</b><strong>+2</strong></span>
                        <span><b>+20+</b><strong>+3</strong></span>
                      </div>
                      <small>{setup.scoringMode === "Confidence Points" ? "Dog bonuses count as points." : "Dog bonuses count as wins."}</small>
                    </div>
                  ) : null}
                </div>

                {setup.dogEnabled ? (
                  <div className="universal-section">
                    <h3>Dog picks per week</h3>
                    <div className="universal-choice-grid three">
                      {([1, 2, 3] as const).map((count) => (
                        <Choice key={count} active={setup.dogPicks === count} title={count + (count === 1 ? " dog" : " dogs")} onClick={() => update("dogPicks", count)} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {step === 4 && hasSideBets ? (
              <>
                <span className="universal-kicker">SIDE BETS</span>
                <h1>Choose how members can challenge each other.</h1>
                <p className="universal-lead">The app tracks the agreed offer and result. It does not hold funds or automatically pay anyone.</p>
                <div className="universal-toggle-stack">
                  <Toggle checked={setup.moneylines} title="Moneyline" detail="Pick the outright winner." onChange={(value) => update("moneylines", value)} />
                  <Toggle checked={setup.totals} title="Over / Under" detail="Offer a game total." onChange={(value) => update("totals", value)} />
                  <Toggle checked={setup.liveBets} title="Live offers" detail="Allow challenges while supported games are in progress." onChange={(value) => update("liveBets", value)} />
                </div>

                <div className="universal-section">
                  <h3>Ledger label</h3>
                  <div className="universal-choice-grid two">
                    <Choice active={setup.ledgerUnit === "Bucks ($)"} title="Bucks ($)" detail="Dollar-style recordkeeping between league members." onClick={() => update("ledgerUnit", "Bucks ($)")} />
                    <Choice active={setup.ledgerUnit === "Points"} title="Points" detail="Use points instead of a currency label." onClick={() => update("ledgerUnit", "Points")} />
                  </div>
                </div>
              </>
            ) : null}

            {step === 5 ? (
              <>
                <span className="universal-kicker">SCHEDULE</span>
                <h1>Choose when the week opens and locks.</h1>
                <p className="universal-lead">The defaults mirror the current football flow, but commissioners can choose a simpler weekly deadline.</p>

                <div className="universal-section">
                  <h3>New week opens</h3>
                  <div className="universal-choice-grid two">
                    <Choice active={setup.weekOpen === "Tuesday 9:00 AM CT"} title="Tuesday 9:00 AM CT" badge="DEFAULT" detail="The next football slate becomes active Tuesday morning." onClick={() => update("weekOpen", "Tuesday 9:00 AM CT")} />
                    <Choice active={setup.weekOpen === "Monday 9:00 AM CT"} title="Monday 9:00 AM CT" detail="Give the league an extra day with the next slate." onClick={() => update("weekOpen", "Monday 9:00 AM CT")} />
                  </div>
                </div>

                {hasPickem ? (
                  <div className="universal-section">
                    <h3>Pick lock</h3>
                    <div className="universal-choice-grid two">
                      <Choice active={setup.lockMode === "Kickoff"} title="Each game at kickoff" detail="Future games remain editable after earlier games begin." onClick={() => update("lockMode", "Kickoff")} />
                      <Choice active={setup.lockMode === "Saturday 11:00 AM CT"} title="One weekly deadline" detail="The full weekly card freezes Saturday at 11:00 AM CT." onClick={() => update("lockMode", "Saturday 11:00 AM CT")} />
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {step === 6 ? (
              <>
                <span className="universal-kicker">REVIEW</span>
                <h1>Your league is ready to create.</h1>
                <p className="universal-lead">This prototype stops at creation. Later, this is where we connect the existing league app behind these rules.</p>

                <div className="universal-review">
                  <div className="universal-review-head">
                    <div><small>LEAGUE</small><strong>{setup.leagueName || "Untitled League"}</strong><span>{setup.commissioner || name || "Commissioner"}</span></div>
                    <b>{"$" + seasonPrice}</b>
                  </div>
                  <SummaryRow label="Players" value={setup.leagueTier} />
                  <SummaryRow label="Format" value={setup.leagueFormat} />
                  <SummaryRow label="Football" value={setup.footballSlate} />
                  {hasPickem ? <SummaryRow label="Scoring" value={setup.scoringMode} /> : null}
                  {hasPickem ? <SummaryRow label="Weekly card" value={setup.weeklyPicks + " picks" + (setup.dogEnabled ? " + " + setup.dogPicks + (setup.dogPicks === 1 ? " dog" : " dogs") : "")} /> : null}
                  <SummaryRow label="Side bets" value={hasSideBets ? "On · " + setup.ledgerUnit : "Off"} />
                  <SummaryRow label="Week opens" value={setup.weekOpen} />
                  {hasPickem ? <SummaryRow label="Locks" value={setup.lockMode} /> : null}
                </div>

                <button type="button" className="universal-primary universal-create" onClick={() => setStage("created")}>Simulate Checkout & Create League</button>
              </>
            ) : null}

            <footer className="universal-setup-actions">
              <button type="button" className="universal-secondary" onClick={previousStep}>Back</button>
              {flowIndex < flow.length - 1 ? <button type="button" className="universal-primary" onClick={nextStep}>Continue</button> : null}
            </footer>
          </section>
        </div>
      ) : null}

      {stage === "created" ? (
        <section className="universal-created universal-screen">
          <span className="universal-created-check">✓</span>
          <span className="universal-kicker">LEAGUE CREATED</span>
          <h1>{setup.leagueName || "Your League"}</h1>
          <p>The universal setup flow is complete. The next development phase is connecting this created league to the existing Pick&apos;em experience.</p>
          <div className="universal-invite-card">
            <span><small>INVITE CODE</small><strong>PLAY-26</strong></span>
            <button type="button">Copy Invite Link</button>
          </div>
          <div className="universal-created-actions">
            <button type="button" className="universal-secondary" onClick={() => { setStage("setup"); setStep(6); }}>Edit League</button>
            <button type="button" className="universal-primary" onClick={resetPrototype}>Start Over</button>
          </div>
        </section>
      ) : null}

      {showFeatures ? (
        <div className="universal-overlay" role="dialog" aria-modal="true" aria-label="Football Pick'em features">
          <section className="universal-features">
            <header>
              <div><span className="universal-kicker">WHAT&apos;S INCLUDED</span><h2>The league experience we&apos;ll connect after setup.</h2></div>
              <button type="button" onClick={() => setShowFeatures(false)} aria-label="Close">×</button>
            </header>
            <div className="universal-feature-grid">
              <article><span>PLAY</span><h3>Weekly Pick&apos;em</h3><p>Flexible pick counts, dog picks, confidence scoring, My Card and season standings.</p></article>
              <article><span>CHALLENGE</span><h3>Side Bets</h3><p>Pregame and live peer-to-peer offers with spread, moneyline and over/under markets.</p></article>
              <article><span>RESEARCH</span><h3>Matchup Preview</h3><p>ATS form, cover margin, advanced offense/defense metrics, team strength and more.</p></article>
              <article><span>FOLLOW</span><h3>GameTracker</h3><p>Score, clock, down & distance, field position, drives, plays and box score.</p></article>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
