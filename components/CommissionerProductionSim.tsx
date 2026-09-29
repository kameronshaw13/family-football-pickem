"use client";

import { useEffect, useMemo, useState } from "react";
import PickemApp from "@/components/PickemApp";
import RouteAppBootstrap from "@/components/RouteAppBootstrap";
import styles from "./CommissionerProductionSim.module.css";

type LeagueCode = "CFB" | "NFL";
type LedgerUnit = "dollars" | "points" | "bucks";

type SimConfig = {
  leagueName: string;
  memberCount: number;
  ledgerUnit: LedgerUnit;
  eligibleLeagues: LeagueCode[];
  regularPicks: number;
  dogPickEnabled: boolean;
  dogMinimum: number;
  perfectWeekBonus: boolean;
  spreadFreeze: "friday-8" | "kickoff";
  pickLock: "kickoff" | "saturday-11";
  sideBetsEnabled: boolean;
  liveBetsEnabled: boolean;
  totalsEnabled: boolean;
  defaultBet: number;
};

const STORAGE_KEY = "pickem_commissioner_production_sim_v1";

const DEFAULT_CONFIG: SimConfig = {
  leagueName: "My Football Pick'em",
  memberCount: 20,
  ledgerUnit: "dollars",
  eligibleLeagues: ["CFB", "NFL"],
  regularPicks: 5,
  dogPickEnabled: true,
  dogMinimum: 7,
  perfectWeekBonus: true,
  spreadFreeze: "friday-8",
  pickLock: "kickoff",
  sideBetsEnabled: true,
  liveBetsEnabled: true,
  totalsEnabled: true,
  defaultBet: 20
};

function toggleLeague(current: LeagueCode[], league: LeagueCode) {
  return current.includes(league) ? current.filter((item) => item !== league) : [...current, league];
}

function leagueLabel(leagues: LeagueCode[]) {
  if (leagues.length === 2) return "College + NFL";
  if (leagues[0] === "CFB") return "College football";
  if (leagues[0] === "NFL") return "NFL";
  return "No leagues selected";
}

export default function CommissionerProductionSim() {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<SimConfig>(DEFAULT_CONFIG);
  const [completed, setCompleted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { config?: Partial<SimConfig>; completed?: boolean };
        if (saved.config) setConfig((current) => ({ ...current, ...saved.config }));
        if (saved.completed) setCompleted(true);
      }
    } catch {
      // The simulator still works when storage is unavailable.
    } finally {
      setHydrated(true);
    }
  }, []);

  const price = useMemo(() => Math.max(4, config.memberCount) * 2, [config.memberCount]);

  function update<K extends keyof SimConfig>(key: K, value: SimConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function finishSetup() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ config, completed: true }));
    } catch {
      // Persistence is optional in simulation mode.
    }
    setCompleted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function restartSetup() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
    setConfig(DEFAULT_CONFIG);
    setStep(0);
    setCompleted(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!hydrated) {
    return <main className={styles.loading}>Loading commissioner setup…</main>;
  }

  if (completed) {
    return (
      <div className={styles.previewShell}>
        <div className={styles.simBanner}>
          <div>
            <strong>Production simulation</strong>
            <span>{config.leagueName} · {config.memberCount} players · {"$"}{price}/season prototype</span>
          </div>
          <button type="button" onClick={restartSetup}>Restart setup</button>
        </div>
        <RouteAppBootstrap slug="friends" />
        <PickemApp appSlug="friends" />
      </div>
    );
  }

  const steps = ["League", "Price", "Pick'em", "Side Bets", "Review"];
  const canContinue = step !== 0 || (config.leagueName.trim().length > 1 && config.memberCount >= 4);

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <header className={styles.header}>
          <div className={styles.eyebrow}>COMMISSIONER SETUP · SIMULATION</div>
          <h1>Create your league</h1>
          <p>Set the format once, invite your group, and run the season from one place.</p>
        </header>

        <div className={styles.progress} aria-label={`Step ${step + 1} of ${steps.length}`}>
          <div className={styles.progressTrack}><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
          <div className={styles.stepRow}>
            {steps.map((label, index) => <span key={label} className={index === step ? styles.activeStep : ""}>{label}</span>)}
          </div>
        </div>

        {step === 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHeading}>
              <span>1</span>
              <div><h2>League basics</h2><p>This is what your members will see.</p></div>
            </div>

            <label className={styles.field}>
              <span>League name</span>
              <input value={config.leagueName} onChange={(event) => update("leagueName", event.target.value)} maxLength={40} />
            </label>

            <label className={styles.field}>
              <span>Expected players</span>
              <div className={styles.numberField}>
                <button type="button" onClick={() => update("memberCount", Math.max(4, config.memberCount - 1))}>−</button>
                <strong>{config.memberCount}</strong>
                <button type="button" onClick={() => update("memberCount", Math.min(100, config.memberCount + 1))}>+</button>
              </div>
              <small>You can still invite more people later.</small>
            </label>

            <div className={styles.field}>
              <span>League games</span>
              <div className={styles.choiceGrid}>
                {(["CFB", "NFL"] as LeagueCode[]).map((league) => (
                  <button
                    key={league}
                    type="button"
                    className={config.eligibleLeagues.includes(league) ? styles.selectedChoice : styles.choice}
                    onClick={() => update("eligibleLeagues", toggleLeague(config.eligibleLeagues, league))}
                  >
                    <b>{league === "CFB" ? "College" : "NFL"}</b>
                    <small>{league === "CFB" ? "FBS games" : "Regular season"}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className={styles.section}>
            <div className={styles.sectionHeading}>
              <span>2</span>
              <div><h2>Commissioner price</h2><p>Prototype pricing only — nothing is charged in this branch.</p></div>
            </div>

            <div className={styles.priceCard}>
              <div>
                <span>Season league pass</span>
                <strong>$2 <small>/ player</small></strong>
              </div>
              <div className={styles.priceMath}>
                <span>{config.memberCount} players × $2</span>
                <b>{"$"}{price}</b>
              </div>
            </div>

            <div className={styles.callout}>
              <b>Commissioner pays once for the league.</b>
              <p>Members join from an invite. The app does not hold side-bet money; players settle with each other outside the app.</p>
            </div>

            <div className={styles.field}>
              <span>Ledger display</span>
              <div className={styles.pillRow}>
                {([
                  ["dollars", "$"],
                  ["points", "Points"],
                  ["bucks", "Bucks"]
                ] as Array<[LedgerUnit, string]>).map(([value, label]) => (
                  <button key={value} type="button" className={config.ledgerUnit === value ? styles.activePill : styles.pill} onClick={() => update("ledgerUnit", value)}>
                    {label}
                  </button>
                ))}
              </div>
              <small>This changes the label only. No real funds are stored in the app.</small>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={styles.section}>
            <div className={styles.sectionHeading}>
              <span>3</span>
              <div><h2>Pick'em rules</h2><p>Start with the format your league wants.</p></div>
            </div>

            <label className={styles.field}>
              <span>Regular picks each week</span>
              <div className={styles.numberField}>
                <button type="button" onClick={() => update("regularPicks", Math.max(1, config.regularPicks - 1))}>−</button>
                <strong>{config.regularPicks}</strong>
                <button type="button" onClick={() => update("regularPicks", Math.min(12, config.regularPicks + 1))}>+</button>
              </div>
            </label>

            <div className={styles.toggleRow}>
              <div><b>Underdog pick</b><small>One bonus pick that must win outright.</small></div>
              <button type="button" className={config.dogPickEnabled ? styles.toggleOn : styles.toggle} onClick={() => update("dogPickEnabled", !config.dogPickEnabled)} aria-pressed={config.dogPickEnabled}><span /></button>
            </div>

            {config.dogPickEnabled && (
              <div className={styles.ruleInset}>
                <label className={styles.field}>
                  <span>Minimum underdog spread</span>
                  <select value={config.dogMinimum} onChange={(event) => update("dogMinimum", Number(event.target.value))}>
                    <option value={3}>+3 or more</option>
                    <option value={5}>+5 or more</option>
                    <option value={7}>+7 or more</option>
                    <option value={10}>+10 or more</option>
                  </select>
                </label>
                <div className={styles.miniRules}>
                  <span>+7 to +9.5 → +1 win</span>
                  <span>+10 to +19.5 → +2 wins</span>
                  <span>+20 or more → +3 wins</span>
                </div>
              </div>
            )}

            <div className={styles.toggleRow}>
              <div><b>Perfect-week bonus</b><small>Enable the league's bonus for a perfect card.</small></div>
              <button type="button" className={config.perfectWeekBonus ? styles.toggleOn : styles.toggle} onClick={() => update("perfectWeekBonus", !config.perfectWeekBonus)} aria-pressed={config.perfectWeekBonus}><span /></button>
            </div>

            <label className={styles.field}>
              <span>Spread freeze</span>
              <select value={config.spreadFreeze} onChange={(event) => update("spreadFreeze", event.target.value as SimConfig["spreadFreeze"])}>
                <option value="friday-8">Friday at 8:00 PM CT</option>
                <option value="kickoff">At each game's kickoff</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Pick lock</span>
              <select value={config.pickLock} onChange={(event) => update("pickLock", event.target.value as SimConfig["pickLock"])}>
                <option value="kickoff">Lock each game at kickoff</option>
                <option value="saturday-11">Universal Saturday 11:00 AM CT lock</option>
              </select>
            </label>
          </div>
        )}

        {step === 3 && (
          <div className={styles.section}>
            <div className={styles.sectionHeading}>
              <span>4</span>
              <div><h2>Side bets</h2><p>Choose which peer-to-peer features the league can use.</p></div>
            </div>

            <div className={styles.toggleRow}>
              <div><b>Side bets</b><small>Members can offer bets directly to each other.</small></div>
              <button type="button" className={config.sideBetsEnabled ? styles.toggleOn : styles.toggle} onClick={() => update("sideBetsEnabled", !config.sideBetsEnabled)} aria-pressed={config.sideBetsEnabled}><span /></button>
            </div>

            {config.sideBetsEnabled && (
              <>
                <div className={styles.toggleRow}>
                  <div><b>Live bets</b><small>Allow offers after games begin.</small></div>
                  <button type="button" className={config.liveBetsEnabled ? styles.toggleOn : styles.toggle} onClick={() => update("liveBetsEnabled", !config.liveBetsEnabled)} aria-pressed={config.liveBetsEnabled}><span /></button>
                </div>
                <div className={styles.toggleRow}>
                  <div><b>Over / unders</b><small>Add totals beside spreads and moneylines.</small></div>
                  <button type="button" className={config.totalsEnabled ? styles.toggleOn : styles.toggle} onClick={() => update("totalsEnabled", !config.totalsEnabled)} aria-pressed={config.totalsEnabled}><span /></button>
                </div>
                <label className={styles.field}>
                  <span>Default offer amount</span>
                  <div className={styles.pillRow}>
                    {[10, 20, 30, 40].map((amount) => (
                      <button key={amount} type="button" className={config.defaultBet === amount ? styles.activePill : styles.pill} onClick={() => update("defaultBet", amount)}>
                        {config.ledgerUnit === "dollars" ? "$" : ""}{amount}
                      </button>
                    ))}
                  </div>
                </label>
              </>
            )}

            <div className={styles.callout}>
              <b>Peer-to-peer ledger only.</b>
              <p>The app records who won and lost. It does not take deposits, hold balances, or transfer winnings between members.</p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className={styles.section}>
            <div className={styles.sectionHeading}>
              <span>5</span>
              <div><h2>Review your league</h2><p>This is the simulated configuration we will carry into the app preview.</p></div>
            </div>

            <div className={styles.reviewCard}>
              <div><span>League</span><b>{config.leagueName}</b></div>
              <div><span>Players</span><b>{config.memberCount}</b></div>
              <div><span>Season price</span><b>{"$"}{price}</b></div>
              <div><span>Games</span><b>{leagueLabel(config.eligibleLeagues)}</b></div>
              <div><span>Weekly card</span><b>{config.regularPicks} picks{config.dogPickEnabled ? " + dog" : ""}</b></div>
              <div><span>Side bets</span><b>{config.sideBetsEnabled ? `On · ${config.liveBetsEnabled ? "Live on" : "Pregame only"}` : "Off"}</b></div>
              <div><span>Ledger</span><b>{config.ledgerUnit === "dollars" ? "Dollars · external settlement" : config.ledgerUnit}</b></div>
            </div>

            <div className={styles.demoNotice}>
              <b>What happens next in this branch</b>
              <p>“Create simulated league” saves these choices only on this device, then opens the existing Friends build as the realistic in-app preview. No production group or payment is created.</p>
            </div>
          </div>
        )}

        <footer className={styles.footer}>
          {step > 0 ? <button type="button" className={styles.secondaryButton} onClick={() => setStep((current) => current - 1)}>Back</button> : <span />}
          {step < steps.length - 1 ? (
            <button type="button" className={styles.primaryButton} disabled={!canContinue || (step === 0 && config.eligibleLeagues.length === 0)} onClick={() => setStep((current) => current + 1)}>Continue</button>
          ) : (
            <button type="button" className={styles.primaryButton} onClick={finishSetup}>Create simulated league</button>
          )}
        </footer>
      </section>
    </main>
  );
}
