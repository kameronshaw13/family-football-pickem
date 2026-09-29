"use client";

import { useEffect, useMemo, useState } from "react";

type LeagueMode = "CFB + NFL" | "CFB only" | "NFL only";
type ScoringMode = "Classic wins" | "Confidence points";
type LedgerUnit = "Bucks ($)" | "Points";

type SetupState = {
  commissioner: string;
  leagueName: string;
  leagueMode: LeagueMode;
  maxMembers: number;
  pricePerMember: number;
  scoringMode: ScoringMode;
  weeklyPicks: number;
  dogEnabled: boolean;
  perfectBonus: boolean;
  sideBets: boolean;
  liveBets: boolean;
  overUnders: boolean;
  moneylines: boolean;
  ledgerUnit: LedgerUnit;
  weekOpen: string;
  lockMode: "Kickoff" | "Saturday 11:00 AM CT";
};

const STORAGE_KEY = "pickem_commissioner_production_sim_v1";

const defaultSetup: SetupState = {
  commissioner: "Kameron",
  leagueName: "Saturday Legends",
  leagueMode: "CFB + NFL",
  maxMembers: 20,
  pricePerMember: 2,
  scoringMode: "Classic wins",
  weeklyPicks: 5,
  dogEnabled: true,
  perfectBonus: true,
  sideBets: true,
  liveBets: true,
  overUnders: true,
  moneylines: true,
  ledgerUnit: "Bucks ($)",
  weekOpen: "Tuesday 9:00 AM CT",
  lockMode: "Kickoff"
};

const stepLabels = ["League", "Plan", "Rules", "Side Bets", "Locks", "Review"];

function Choice({ active, title, detail, onClick }: { active: boolean; title: string; detail?: string; onClick: () => void }) {
  return (
    <button type="button" className={"sim-choice " + (active ? "active" : "")} onClick={onClick}>
      <span className="sim-choice-dot" aria-hidden="true" />
      <span><strong>{title}</strong>{detail && <small>{detail}</small>}</span>
    </button>
  );
}

function Toggle({ checked, title, detail, onChange }: { checked: boolean; title: string; detail?: string; onChange: (next: boolean) => void }) {
  return (
    <button type="button" className="sim-toggle-row" onClick={() => onChange(!checked)} aria-pressed={checked}>
      <span><strong>{title}</strong>{detail && <small>{detail}</small>}</span>
      <span className={"sim-switch " + (checked ? "on" : "")}><span /></span>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="sim-summary-row"><span>{label}</span><strong>{value}</strong></div>;
}

export default function CommissionerProductionSim() {
  const [step, setStep] = useState(0);
  const [setup, setSetup] = useState<SetupState>(defaultSetup);
  const [created, setCreated] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { setup?: Partial<SetupState>; step?: number; created?: boolean };
        setSetup((current) => ({ ...current, ...(saved.setup || {}) }));
        if (Number.isInteger(saved.step)) setStep(Math.min(5, Math.max(0, Number(saved.step))));
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

  const estimatedPrice = useMemo(() => Math.max(1, setup.maxMembers) * Math.max(0, setup.pricePerMember), [setup.maxMembers, setup.pricePerMember]);

  const update = <K extends keyof SetupState>(key: K, value: SetupState[K]) => {
    setSetup((current) => ({ ...current, [key]: value }));
  };

  const reset = () => {
    setSetup(defaultSetup);
    setStep(0);
    setCreated(false);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch {\n      // Storage cleanup is optional in prototype mode.\n    }
  };

  if (!loaded) return <main className="production-sim"><div className="sim-loading">Loading commissioner preview…</div></main>;

  if (created) {
    return (
      <main className="production-sim">
        <header className="sim-topbar">
          <img src="/football-pickem-wordmark.png" alt="Football Pick'em" />
          <span className="sim-preview-pill">PRODUCTION SIM</span>
        </header>
        <section className="sim-created">
          <div className="sim-created-check">✓</div>
          <p className="sim-eyebrow">League created</p>
          <h1>{setup.leagueName}</h1>
          <p className="sim-created-copy">This is the post-checkout state a commissioner would see before inviting the league.</p>
          <div className="sim-invite-card">
            <div><small>Invite code</small><strong>SHAW-26</strong></div>
            <button type="button">Copy Invite Link</button>
          </div>
          <div className="sim-app-shell">
            <div className="sim-shell-head">
              <div><small>WEEK 1</small><strong>{setup.leagueName}</strong></div>
              <span>Commissioner</span>
            </div>
            <nav>
              <button className="active" type="button">Picks</button>
              <button type="button">My Card</button>
              {setup.sideBets && <button type="button">Side Bets</button>}
              <button type="button">Standings</button>
              <button type="button">Rules</button>
            </nav>
            <div className="sim-week-card">
              <div><span>League is ready</span><strong>{setup.weekOpen}</strong></div>
              <p>Members join free. Picks, standings, matchup previews and your configured league rules will live here.</p>
            </div>
            <div className="sim-fake-games">
              <div><span>THU</span><strong>KC</strong><b>-3.5</b><strong>BUF</strong><b>+3.5</b></div>
              <div><span>SAT</span><strong>ORE</strong><b>-6.5</b><strong>PSU</strong><b>+6.5</b></div>
              <div><span>SUN</span><strong>GB</strong><b>+2.5</b><strong>DET</strong><b>-2.5</b></div>
            </div>
          </div>
          <div className="sim-created-actions">
            <button type="button" className="sim-secondary" onClick={() => setCreated(false)}>Edit Setup</button>
            <button type="button" className="sim-primary" onClick={reset}>Start Over</button>
          </div>
          <p className="sim-safety-note">Simulation only. No real checkout, deposits, payouts, group creation, picks, or side bets are submitted.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="production-sim">
      <header className="sim-topbar">
        <img src="/football-pickem-wordmark.png" alt="Football Pick'em" />
        <span className="sim-preview-pill">PRODUCTION SIM</span>
      </header>

      <div className="sim-layout">
        <aside className="sim-progress" aria-label="Commissioner setup progress">
          <p className="sim-eyebrow">Commissioner setup</p>
          <h2>Create your league</h2>
          <div className="sim-progress-list">
            {stepLabels.map((label, index) => (
              <button key={label} type="button" className={index === step ? "active" : index < step ? "done" : ""} onClick={() => setStep(index)}>
                <span>{index < step ? "✓" : index + 1}</span>{label}
              </button>
            ))}
          </div>
          <div className="sim-safe-card">
            <strong>Safe preview</strong>
            <span>Nothing here writes to Supabase or changes a live league.</span>
          </div>
        </aside>

        <section className="sim-panel">
          <div className="sim-mobile-step">Step {step + 1} of {stepLabels.length} · {stepLabels[step]}</div>

          {step === 0 && (
            <>
              <p className="sim-eyebrow">Start a league</p>
              <h1>Set the basics.</h1>
              <p className="sim-lead">This becomes the league members see after they join.</p>
              <div className="sim-field-grid">
                <label className="sim-field"><span>Commissioner name</span><input value={setup.commissioner} onChange={(event) => update("commissioner", event.target.value)} /></label>
                <label className="sim-field"><span>League name</span><input value={setup.leagueName} onChange={(event) => update("leagueName", event.target.value)} /></label>
              </div>
              <div className="sim-section">
                <h3>Football slate</h3>
                <div className="sim-choice-grid">
                  {(["CFB + NFL", "CFB only", "NFL only"] as LeagueMode[]).map((mode) => <Choice key={mode} active={setup.leagueMode === mode} title={mode} onClick={() => update("leagueMode", mode)} />)}
                </div>
              </div>
              <div className="sim-section">
                <div className="sim-range-head"><h3>League size</h3><strong>{setup.maxMembers} members</strong></div>
                <input className="sim-range" type="range" min="4" max="40" step="1" value={setup.maxMembers} onChange={(event) => update("maxMembers", Number(event.target.value))} />
                <div className="sim-range-labels"><span>4</span><span>40</span></div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="sim-eyebrow">League plan</p>
              <h1>Commissioner pays. Members join free.</h1>
              <p className="sim-lead">The prototype keeps checkout on the commissioner side so league members never hit a paywall.</p>
              <div className="sim-price-card">
                <div className="sim-price-copy">
                  <span>SEASON PASS · PROTOTYPE PRICE</span>
                  <strong><b>$</b>{setup.pricePerMember}<small> / member</small></strong>
                  <p>One commissioner checkout for the full football season.</p>
                </div>
                <div className="sim-price-total">
                  <small>Estimated league total</small>
                  <strong>{"$" + estimatedPrice}</strong>
                  <span>{setup.maxMembers + " members × $" + setup.pricePerMember}</span>
                </div>
              </div>
              <div className="sim-section">
                <div className="sim-range-head"><h3>Prototype price per member</h3><strong>{"$" + setup.pricePerMember}</strong></div>
                <input className="sim-range" type="range" min="1" max="5" step="1" value={setup.pricePerMember} onChange={(event) => update("pricePerMember", Number(event.target.value))} />
                <div className="sim-range-labels"><span>$1</span><span>$5</span></div>
              </div>
              <div className="sim-callout"><strong>What the season pass includes</strong><span>Pick'em league · matchup previews · GameTracker · standings · side-bet ledger · commissioner controls</span></div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="sim-eyebrow">Pick'em rules</p>
              <h1>Choose how the league plays.</h1>
              <p className="sim-lead">These choices would become the season rules shown to every member.</p>
              <div className="sim-section">
                <h3>Scoring style</h3>
                <div className="sim-choice-grid two">
                  <Choice active={setup.scoringMode === "Classic wins"} title="Classic wins" detail="Every correct pick counts as one win." onClick={() => update("scoringMode", "Classic wins")} />
                  <Choice active={setup.scoringMode === "Confidence points"} title="Confidence points" detail="Assign higher value to stronger picks." onClick={() => update("scoringMode", "Confidence points")} />
                </div>
              </div>
              <div className="sim-section">
                <div className="sim-range-head"><h3>Weekly spread picks</h3><strong>{setup.weeklyPicks}</strong></div>
                <input className="sim-range" type="range" min="3" max="10" step="1" value={setup.weeklyPicks} onChange={(event) => update("weeklyPicks", Number(event.target.value))} />
              </div>
              <div className="sim-stack">
                <Toggle checked={setup.dogEnabled} title="Underdog pick" detail="One underdog moneyline pick each week. Losses do not add a loss." onChange={(next) => update("dogEnabled", next)} />
                {setup.dogEnabled && <div className="sim-dog-tiers"><span>+7 to +9.5 <b>+1 bonus win</b></span><span>+10 to +19.5 <b>+2 bonus wins</b></span><span>+20 or more <b>+3 bonus wins</b></span></div>}
                <Toggle checked={setup.perfectBonus} title="Perfect-week bonus" detail="Allow a commissioner-defined reward for a perfect card." onChange={(next) => update("perfectBonus", next)} />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="sim-eyebrow">Peer-to-peer side bets</p>
              <h1>Decide what members can challenge each other on.</h1>
              <p className="sim-lead">The app tracks agreed outcomes. Members settle with each other outside the app.</p>
              <div className="sim-stack">
                <Toggle checked={setup.sideBets} title="Enable side bets" detail="Members can send one-to-one offers tied to games." onChange={(next) => update("sideBets", next)} />
                {setup.sideBets && <>
                  <Toggle checked={setup.moneylines} title="Moneyline offers" onChange={(next) => update("moneylines", next)} />
                  <Toggle checked={setup.overUnders} title="Over / under offers" onChange={(next) => update("overUnders", next)} />
                  <Toggle checked={setup.liveBets} title="Live offers" detail="Allow offers while supported games are in progress." onChange={(next) => update("liveBets", next)} />
                </>}
              </div>
              {setup.sideBets && <div className="sim-section">
                <h3>Ledger display</h3>
                <div className="sim-choice-grid two">
                  <Choice active={setup.ledgerUnit === "Bucks ($)"} title="Bucks ($)" detail="Familiar dollar-style scorekeeping." onClick={() => update("ledgerUnit", "Bucks ($)")} />
                  <Choice active={setup.ledgerUnit === "Points"} title="Points" detail="No currency symbol in league totals." onClick={() => update("ledgerUnit", "Points")} />
                </div>
              </div>}
              <div className="sim-callout legal"><strong>Product boundary</strong><span>No wallet, deposits, withdrawals, custody, or automatic payouts. This flow is league scorekeeping and recordkeeping only.</span></div>
            </>
          )}

          {step === 4 && (
            <>
              <p className="sim-eyebrow">Schedule & locks</p>
              <h1>Set when the week opens and picks lock.</h1>
              <p className="sim-lead">The current defaults mirror how the existing leagues run.</p>
              <div className="sim-section">
                <h3>Week opens</h3>
                <div className="sim-choice-grid two">
                  <Choice active={setup.weekOpen === "Tuesday 9:00 AM CT"} title="Tuesday 9:00 AM CT" detail="Recommended football-week rollover." onClick={() => update("weekOpen", "Tuesday 9:00 AM CT")} />
                  <Choice active={setup.weekOpen === "Monday 9:00 AM CT"} title="Monday 9:00 AM CT" detail="Open the next card a day earlier." onClick={() => update("weekOpen", "Monday 9:00 AM CT")} />
                </div>
              </div>
              <div className="sim-section">
                <h3>Pick lock</h3>
                <div className="sim-choice-grid two">
                  <Choice active={setup.lockMode === "Kickoff"} title="Lock each game at kickoff" detail="Players can keep editing future games." onClick={() => update("lockMode", "Kickoff")} />
                  <Choice active={setup.lockMode === "Saturday 11:00 AM CT"} title="Saturday 11:00 AM CT" detail="Universal weekly lock for the whole card." onClick={() => update("lockMode", "Saturday 11:00 AM CT")} />
                </div>
              </div>
              <div className="sim-callout"><strong>Spread behavior</strong><span>Market lines can refresh during the week, then each selected game freezes according to the league lock rules.</span></div>
            </>
          )}

          {step === 5 && (
            <>
              <p className="sim-eyebrow">Review</p>
              <h1>Your league is ready to create.</h1>
              <p className="sim-lead">This is the production-style summary shown before commissioner checkout.</p>
              <div className="sim-review">
                <div className="sim-review-title">
                  <div><small>LEAGUE</small><strong>{setup.leagueName || "Untitled League"}</strong><span>{"Commissioner: " + (setup.commissioner || "—")}</span></div>
                  <b>{"$" + estimatedPrice}</b>
                </div>
                <SummaryRow label="Football" value={setup.leagueMode} />
                <SummaryRow label="Members" value={"Up to " + setup.maxMembers} />
                <SummaryRow label="Plan" value={"Commissioner pays · $" + setup.pricePerMember + "/member"} />
                <SummaryRow label="Scoring" value={setup.scoringMode} />
                <SummaryRow label="Weekly card" value={setup.weeklyPicks + " spread picks" + (setup.dogEnabled ? " + 1 dog" : "")} />
                <SummaryRow label="Side bets" value={setup.sideBets ? "On · " + setup.ledgerUnit : "Off"} />
                <SummaryRow label="Week opens" value={setup.weekOpen} />
                <SummaryRow label="Locks" value={setup.lockMode} />
              </div>
              <button type="button" className="sim-create-button" onClick={() => setCreated(true)}>Simulate Checkout & Create League</button>
              <p className="sim-fine-print">Prototype only — this button does not charge a card or create database records.</p>
            </>
          )}

          <footer className="sim-actions">
            <button type="button" className="sim-secondary" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>Back</button>
            {step < 5 && <button type="button" className="sim-primary" onClick={() => setStep((current) => Math.min(5, current + 1))}>Continue</button>}
          </footer>
        </section>
      </div>
    </main>
  );
}
