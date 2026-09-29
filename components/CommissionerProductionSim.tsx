"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type LeagueTier = "1–10" | "11–24" | "25–39" | "40+";
type ProductMode = "Pick'em" | "Pick'em + Side Bets" | "Side Bets Only";
type FootballSlate = "College Football" | "NFL" | "College + NFL";
type ScoringMode = "Winning Percentage" | "Total Wins" | "Confidence Points";
type LedgerUnit = "Bucks ($)" | "Points";

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

const STORAGE_KEY = "pickem_commissioner_production_sim_v2";

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
  onClick
}: {
  active: boolean;
  title: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={"sim-choice " + (active ? "active" : "")} onClick={onClick}>
      <span className="sim-choice-dot" aria-hidden="true" />
      <span>
        <strong>{title}</strong>
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

  const reset = () => {
    setSetup(defaultSetup);
    setStep(0);
    setCreated(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage cleanup is optional in prototype mode.
    }
  };

  if (!loaded) {
    return (
      <main className="production-sim">
        <div className="sim-loading">Loading commissioner preview…</div>
      </main>
    );
  }

  if (created) {
    return (
      <main className="production-sim">
        <header className="sim-topbar">
          <Image src="/football-pickem-wordmark.png" alt="Football Pick'em" width={800} height={100} priority />
          <span className="sim-preview-pill">PRODUCTION SIM</span>
        </header>

        <section className="sim-created">
          <div className="sim-created-check">✓</div>
          <p className="sim-eyebrow">League created</p>
          <h1>{setup.leagueName}</h1>
          <p className="sim-created-copy">This is the post-checkout state a commissioner would see before inviting the league.</p>

          <div className="sim-invite-card">
            <div>
              <small>Invite code</small>
              <strong>SHAW-26</strong>
            </div>
            <button type="button">Copy Invite Link</button>
          </div>

          <div className="sim-app-shell">
            <div className="sim-shell-head">
              <div>
                <small>WEEK 1</small>
                <strong>{setup.leagueName}</strong>
              </div>
              <span>Commissioner</span>
            </div>
            <nav>
              {hasPickem && <button className="active" type="button">Picks</button>}
              {hasPickem && <button type="button">My Card</button>}
              {hasSideBets && <button className={!hasPickem ? "active" : ""} type="button">Side Bets</button>}
              {hasPickem && <button type="button">Standings</button>}
              <button type="button">Rules</button>
            </nav>
            <div className="sim-week-card">
              <div>
                <span>League is ready</span>
                <strong>{setup.weekOpen}</strong>
              </div>
              <p>
                Members join free. Your {setup.productMode.toLowerCase()} league is configured for {setup.footballSlate.toLowerCase()}.
              </p>
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
        <Image src="/football-pickem-wordmark.png" alt="Football Pick'em" width={800} height={100} priority />
        <span className="sim-preview-pill">PRODUCTION SIM</span>
      </header>

      <div className="sim-layout">
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
            <strong>Safe preview</strong>
            <span>Nothing here writes to Supabase or changes a live league.</span>
          </div>
        </aside>

        <section className="sim-panel">
          <div className="sim-mobile-step">
            Step {currentFlowIndex + 1} of {flowSteps.length} · {stepLabels[step]}
          </div>

          {step === 0 && (
            <>
              <p className="sim-eyebrow">League size & price</p>
              <h1>How many people are in your league?</h1>
              <p className="sim-lead">Choose the league-size tier. The commissioner pays one season price and members join free.</p>

              <div className="sim-choice-grid two">
                {(Object.keys(leaguePricing) as LeagueTier[]).map((tier) => (
                  <Choice
                    key={tier}
                    active={setup.leagueTier === tier}
                    title={tier + " people"}
                    detail={"$" + leaguePricing[tier] + " for the league"}
                    onClick={() => update("leagueTier", tier)}
                  />
                ))}
              </div>

              <div className="sim-price-card" style={{ marginTop: 24 }}>
                <div className="sim-price-copy">
                  <span>FOOTBALL SEASON · COMMISSIONER PRICE</span>
                  <strong><b>$</b>{leaguePrice}</strong>
                  <p>One league payment. No member paywall.</p>
                </div>
                <div className="sim-price-total">
                  <small>Selected tier</small>
                  <strong>{setup.leagueTier}</strong>
                  <span>members</span>
                </div>
              </div>

              <div className="sim-section">
                <h3>League details</h3>
                <div className="sim-field-grid">
                  <label className="sim-field">
                    <span>Commissioner name</span>
                    <input value={setup.commissioner} onChange={(event) => update("commissioner", event.target.value)} />
                  </label>
                  <label className="sim-field">
                    <span>League name</span>
                    <input value={setup.leagueName} onChange={(event) => update("leagueName", event.target.value)} />
                  </label>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="sim-eyebrow">League format</p>
              <h1>What kind of league do you want?</h1>
              <p className="sim-lead">Pick&apos;em + Side Bets is the default. The rest of setup changes automatically based on this choice.</p>

              <div className="sim-choice-grid">
                <Choice
                  active={setup.productMode === "Pick'em"}
                  title="Pick'em"
                  detail="Weekly picks and season standings."
                  onClick={() => update("productMode", "Pick'em")}
                />
                <Choice
                  active={setup.productMode === "Pick'em + Side Bets"}
                  title="Pick'em + Side Bets"
                  detail="Weekly picks plus peer-to-peer side bets. Default."
                  onClick={() => update("productMode", "Pick'em + Side Bets")}
                />
                <Choice
                  active={setup.productMode === "Side Bets Only"}
                  title="Side Bets Only"
                  detail="Skip the weekly pick contest and use the side-bet system."
                  onClick={() => update("productMode", "Side Bets Only")}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="sim-eyebrow">Sport</p>
              <h1>Choose your football slate.</h1>
              <p className="sim-lead">Football is the first supported sport. Choose which games your league can use.</p>

              <div className="sim-section">
                <h3>Sport</h3>
                <div className="sim-choice-grid two">
                  <Choice active title="Football" detail="Available now." onClick={() => undefined} />
                </div>
              </div>

              <div className="sim-section">
                <h3>Football games</h3>
                <div className="sim-choice-grid">
                  {(["College Football", "NFL", "College + NFL"] as FootballSlate[]).map((mode) => (
                    <Choice
                      key={mode}
                      active={setup.footballSlate === mode}
                      title={mode}
                      onClick={() => update("footballSlate", mode)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 3 && hasPickem && (
            <>
              <p className="sim-eyebrow">Pick&apos;em rules</p>
              <h1>Choose how the league plays.</h1>
              <p className="sim-lead">These rules control the weekly card and how the standings are ranked.</p>

              <div className="sim-section">
                <h3>Standings scoring</h3>
                <div className="sim-choice-grid">
                  <Choice
                    active={setup.scoringMode === "Winning Percentage"}
                    title="Winning Percentage"
                    detail="Rank by the percentage of regular picks won. Default."
                    onClick={() => update("scoringMode", "Winning Percentage")}
                  />
                  <Choice
                    active={setup.scoringMode === "Total Wins"}
                    title="Total Wins"
                    detail="Rank by the total number of regular picks won."
                    onClick={() => update("scoringMode", "Total Wins")}
                  />
                  <Choice
                    active={setup.scoringMode === "Confidence Points"}
                    title="Confidence Points"
                    detail={"With " + setup.weeklyPicks + " picks, assign 1–" + setup.weeklyPicks + " once each."}
                    onClick={() => update("scoringMode", "Confidence Points")}
                  />
                </div>
              </div>

              {setup.scoringMode === "Confidence Points" && (
                <div className="sim-callout">
                  <strong>How confidence points work</strong>
                  <span>
                    Each regular pick gets a unique value from 1 through {setup.weeklyPicks}. A correct pick earns that many points.
                    Every value is used exactly once each week. Dog picks stay separate from confidence points.
                  </span>
                </div>
              )}

              <div className="sim-section">
                <div className="sim-range-head">
                  <h3>Regular picks per week</h3>
                  <strong>{setup.weeklyPicks}</strong>
                </div>
                <input
                  className="sim-range"
                  type="range"
                  min="3"
                  max="15"
                  step="1"
                  value={setup.weeklyPicks}
                  onChange={(event) => update("weeklyPicks", Number(event.target.value))}
                />
                <div className="sim-range-labels"><span>3</span><span>15</span></div>
              </div>

              <div className="sim-stack">
                <Toggle
                  checked={setup.dogEnabled}
                  title="Include dog picks"
                  detail="Add underdog moneyline picks to the weekly card."
                  onChange={(next) => update("dogEnabled", next)}
                />
              </div>

              {setup.dogEnabled && (
                <div className="sim-section">
                  <h3>Dog picks per week</h3>
                  <div className="sim-choice-grid">
                    {([1, 2, 3] as const).map((count) => (
                      <Choice
                        key={count}
                        active={setup.dogPicks === count}
                        title={count + (count === 1 ? " dog" : " dogs")}
                        onClick={() => update("dogPicks", count)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 4 && hasSideBets && (
            <>
              <p className="sim-eyebrow">Peer-to-peer side bets</p>
              <h1>Choose what members can challenge each other on.</h1>
              <p className="sim-lead">The app tracks agreed outcomes. Members settle with each other outside the app.</p>

              <div className="sim-stack">
                <Toggle checked={setup.moneylines} title="Moneyline offers" onChange={(next) => update("moneylines", next)} />
                <Toggle checked={setup.overUnders} title="Over / under offers" onChange={(next) => update("overUnders", next)} />
                <Toggle
                  checked={setup.liveBets}
                  title="Live offers"
                  detail="Allow offers while supported games are in progress."
                  onChange={(next) => update("liveBets", next)}
                />
              </div>

              <div className="sim-section">
                <h3>Ledger display</h3>
                <div className="sim-choice-grid two">
                  <Choice
                    active={setup.ledgerUnit === "Bucks ($)"}
                    title="Bucks ($)"
                    detail="Dollar-style scorekeeping between league members."
                    onClick={() => update("ledgerUnit", "Bucks ($)")}
                  />
                  <Choice
                    active={setup.ledgerUnit === "Points"}
                    title="Points"
                    detail="Use points instead of a currency symbol."
                    onClick={() => update("ledgerUnit", "Points")}
                  />
                </div>
              </div>

              <div className="sim-callout legal">
                <strong>Product boundary</strong>
                <span>No wallet, deposits, withdrawals, custody, or automatic payouts. This flow is league scorekeeping and recordkeeping only.</span>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <p className="sim-eyebrow">Schedule & locks</p>
              <h1>Set when the week opens and picks lock.</h1>
              <p className="sim-lead">The current defaults mirror how the existing leagues run.</p>

              <div className="sim-section">
                <h3>Week opens</h3>
                <div className="sim-choice-grid two">
                  <Choice
                    active={setup.weekOpen === "Tuesday 9:00 AM CT"}
                    title="Tuesday 9:00 AM CT"
                    detail="Recommended football-week rollover."
                    onClick={() => update("weekOpen", "Tuesday 9:00 AM CT")}
                  />
                  <Choice
                    active={setup.weekOpen === "Monday 9:00 AM CT"}
                    title="Monday 9:00 AM CT"
                    detail="Open the next card a day earlier."
                    onClick={() => update("weekOpen", "Monday 9:00 AM CT")}
                  />
                </div>
              </div>

              {hasPickem && (
                <div className="sim-section">
                  <h3>Pick lock</h3>
                  <div className="sim-choice-grid two">
                    <Choice
                      active={setup.lockMode === "Kickoff"}
                      title="Lock each game at kickoff"
                      detail="Players can keep editing future games."
                      onClick={() => update("lockMode", "Kickoff")}
                    />
                    <Choice
                      active={setup.lockMode === "Saturday 11:00 AM CT"}
                      title="Saturday 11:00 AM CT"
                      detail="Universal weekly lock for the whole card."
                      onClick={() => update("lockMode", "Saturday 11:00 AM CT")}
                    />
                  </div>
                </div>
              )}

              <div className="sim-callout">
                <strong>Spread behavior</strong>
                <span>Market lines can refresh during the week, then selected games freeze according to the league rules.</span>
              </div>
            </>
          )}

          {step === 6 && (
            <>
              <p className="sim-eyebrow">Review</p>
              <h1>Your league is ready to create.</h1>
              <p className="sim-lead">This is the production-style summary shown before commissioner checkout.</p>

              <div className="sim-review">
                <div className="sim-review-title">
                  <div>
                    <small>LEAGUE</small>
                    <strong>{setup.leagueName || "Untitled League"}</strong>
                    <span>{"Commissioner: " + (setup.commissioner || "—")}</span>
                  </div>
                  <b>{"$" + leaguePrice}</b>
                </div>
                <SummaryRow label="League size" value={setup.leagueTier + " people"} />
                <SummaryRow label="Season price" value={"$" + leaguePrice + " · commissioner pays"} />
                <SummaryRow label="Format" value={setup.productMode} />
                <SummaryRow label="Sport" value={"Football · " + setup.footballSlate} />
                {hasPickem && <SummaryRow label="Scoring" value={setup.scoringMode} />}
                {hasPickem && (
                  <SummaryRow
                    label="Weekly card"
                    value={
                      setup.weeklyPicks +
                      " regular picks" +
                      (setup.dogEnabled ? " + " + setup.dogPicks + (setup.dogPicks === 1 ? " dog" : " dogs") : "")
                    }
                  />
                )}
                {hasPickem && setup.scoringMode === "Confidence Points" && (
                  <SummaryRow label="Confidence" value={"1–" + setup.weeklyPicks + " used once each"} />
                )}
                <SummaryRow label="Side bets" value={hasSideBets ? "On · " + setup.ledgerUnit : "Off"} />
                <SummaryRow label="Week opens" value={setup.weekOpen} />
                {hasPickem && <SummaryRow label="Locks" value={setup.lockMode} />}
              </div>

              <button type="button" className="sim-create-button" onClick={() => setCreated(true)}>
                Simulate Checkout & Create League
              </button>
              <p className="sim-fine-print">Prototype only — this button does not charge a card or create database records.</p>
            </>
          )}

          <footer className="sim-actions">
            <button type="button" className="sim-secondary" disabled={currentFlowIndex === 0} onClick={goBack}>Back</button>
            {currentFlowIndex < flowSteps.length - 1 && (
              <button type="button" className="sim-primary" onClick={goNext}>Continue</button>
            )}
          </footer>
        </section>
      </div>
    </main>
  );
}
