"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronLeft, Eye, KeyRound, Link2, LockKeyhole, Mail, Plus, ShieldCheck, Users } from "lucide-react";
import { getUniversalSupabase, setRememberMe } from "@/lib/universalAuthClient";
import { clearClientSession, storeClientSession } from "@/lib/clientSession";

type Membership = { role: string; group: { id: string; slug: string; name: string; short_name?: string | null; current_season_year: number } };
type Stage = "loading" | "auth" | "home" | "create" | "created";
type AuthMode = "signin" | "signup";
type LeagueFormat = "pickem" | "pickem-sidebets" | "sidebets";
type Slate = "CFB" | "NFL" | "BOTH";
type Scoring = "winning-percentage" | "total-wins" | "confidence";
type Tier = "1-10" | "11-24" | "25-39" | "40+";
type StartOptions = {
  seasonYear: number;
  CFB: { seasonStartWeek: number; nextAvailableWeek: number; options: Array<{ week: number; firstKickoff: string }> };
  NFL: { seasonStartWeek: number; nextAvailableWeek: number; options: Array<{ week: number; firstKickoff: string }> };
};

const prices: Record<Tier, number> = { "1-10": 20, "11-24": 40, "25-39": 60, "40+": 80 };

const initialLeague = {
  leagueName: "",
  inviteCode: "",
  playerTier: "11-24" as Tier,
  format: "pickem-sidebets" as LeagueFormat,
  footballSlate: "BOTH" as Slate,
  scoringMode: "winning-percentage" as Scoring,
  weeklyPicks: 5,
  dogEnabled: true,
  dogPicks: 1,
  sideBetMoneyline: true,
  sideBetTotals: true,
  sideBetLive: true,
  ledgerUnit: "bucks" as "bucks" | "points",
  weekOpen: "tuesday-9" as "monday-9" | "tuesday-9",
  lockMode: "kickoff" as "kickoff" | "saturday-11",
  startMode: "now" as "season" | "now",
  startWeeks: { CFB: 0 as number | null, NFL: 1 as number | null }
};

function Choice({ active, title, detail, disabled = false, onClick }: { active: boolean; title: string; detail: string; disabled?: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} className={"universal-option " + (active ? "active " : "") + (disabled ? "disabled" : "")} onClick={onClick}>
    <i>{active ? <Check size={14} /> : null}</i>
    <span><strong>{title}</strong><small>{detail}</small></span>
  </button>;
}

function Toggle({ checked, title, detail, onChange }: { checked: boolean; title: string; detail: string; onChange: (next: boolean) => void }) {
  return <button type="button" className="universal-toggle-row" onClick={() => onChange(!checked)}>
    <span><strong>{title}</strong><small>{detail}</small></span>
    <i className={checked ? "on" : ""}><b /></i>
  </button>;
}

export default function UniversalAppShell() {
  const supabase = useMemo(() => getUniversalSupabase(), []);
  const [stage, setStage] = useState<Stage>("loading");
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [setupStep, setSetupStep] = useState(0);
  const [league, setLeague] = useState(initialLeague);
  const [startOptions, setStartOptions] = useState<StartOptions | null>(null);
  const [created, setCreated] = useState<{ group: any; inviteCode: string } | null>(null);

  async function bootstrap(accessToken: string) {
    const response = await fetch("/api/universal/bootstrap", { method: "POST", headers: { Authorization: "Bearer " + accessToken } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load account.");
    const durableSession = window.sessionStorage.getItem("football_pickem_remember_me") !== "0";
    storeClientSession(accessToken, payload.profile, durableSession);
    setProfile(payload.profile);
    setMemberships(payload.memberships || []);
    setStage("home");
  }

  useEffect(() => {
    let active = true;
    const query = new URL(window.location.href).searchParams.get("join");
    if (query) setJoinCode(query.toUpperCase());

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (data.session?.access_token) {
        try { await bootstrap(data.session.access_token); } catch { setStage("auth"); }
      } else {
        setStage("auth");
      }
    });
    return () => { active = false; };
  }, [supabase]);

  useEffect(() => {
    fetch("/api/universal/start-options").then((r) => r.json()).then((payload) => {
      if (!payload?.ok) return;
      setStartOptions(payload);
      setLeague((current) => ({
        ...current,
        startMode: "now",
        startWeeks: { CFB: payload.CFB.nextAvailableWeek, NFL: payload.NFL.nextAvailableWeek }
      }));
    }).catch(() => undefined);
  }, []);

  async function submitAuth() {
    setMessage("");
    setWorking(true);
    setRememberMe(remember);
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { full_name: name.trim() } }
        });
        if (error) throw error;
        if (data.session?.access_token) await bootstrap(data.session.access_token);
        else setMessage("Check your email to confirm your account, then sign in.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw error;
        if (!data.session?.access_token) throw new Error("Could not create a session.");
        await bootstrap(data.session.access_token);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not continue.");
    } finally {
      setWorking(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) { setMessage("Enter your email first."); return; }
    setWorking(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin + "/auth/update-password"
    });
    setWorking(false);
    setMessage(error ? error.message : "Password reset email sent.");
    if (!error) setForgotOpen(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    clearClientSession();
    setProfile(null); setMemberships([]); setStage("auth"); setMessage("");
  }

  async function joinLeague() {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) return;
    setWorking(true); setMessage("");
    try {
      const response = await fetch("/api/universal/join", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ code: joinCode })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not join league.");
      await bootstrap(session.access_token);
      setJoinCode("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not join league.");
    } finally { setWorking(false); }
  }

  function openCreate() {
    const suggestion = ((profile?.display_name || "MY") + "-26").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16);
    setLeague((current) => ({ ...current, inviteCode: current.inviteCode || suggestion }));
    setSetupStep(0); setStage("create"); setMessage("");
  }

  async function createLeague() {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) return;
    setWorking(true); setMessage("");
    try {
      const response = await fetch("/api/universal/create-league", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify(league)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not create league.");
      setCreated(payload);
      setStage("created");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create league.");
    } finally { setWorking(false); }
  }

  if (stage === "loading") return <main className="universal-loading-shell"><div className="universal-loading-brand"><Image src="/football-pickem-wordmark.png" alt="Football Pick'em" width={800} height={100} priority /><span>Loading your account…</span></div></main>;

  if (stage === "auth") return <main className="universal-entry">
    <section className="universal-entry-hero">
      <Image src="/football-pickem-wordmark.png" alt="Football Pick'em" width={800} height={100} priority />
      <span className="universal-eyebrow">YOUR LEAGUE. YOUR RULES.</span>
      <h1>Pick games. Challenge friends. Follow every snap.</h1>
      <p>Run a custom football league with weekly Pick&apos;em, peer-to-peer side bets, advanced matchup research and GameTracker.</p>
      <Link href="/demo" className="universal-demo-cta"><Eye size={18} /><span><strong>Try Demo Mode</strong><small>No account needed · full sample week</small></span><ArrowRight size={18} /></Link>
    </section>

    <section className="universal-login-card">
      <div className="universal-auth-tabs"><button className={authMode==="signin"?"active":""} onClick={()=>setAuthMode("signin")}>Sign In</button><button className={authMode==="signup"?"active":""} onClick={()=>setAuthMode("signup")}>Create Account</button></div>
      <div className="universal-login-copy"><span>{authMode==="signin"?"WELCOME BACK":"NEW ACCOUNT"}</span><h2>{authMode==="signin"?"Sign in to your leagues.":"Create your Football Pick'em account."}</h2></div>
      {authMode==="signup" && <label className="universal-input"><span>Name</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" autoComplete="name" /></label>}
      <label className="universal-input"><span>Email</span><div><Mail size={16}/><input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@example.com" autoComplete="email" /></div></label>
      <label className="universal-input"><span>Password</span><div><LockKeyhole size={16}/><input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder={authMode==="signup"?"8+ characters":"Password"} autoComplete={authMode==="signup"?"new-password":"current-password"} /></div></label>
      {authMode==="signin" && <div className="universal-login-options"><label><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} />Keep me signed in</label><button onClick={()=>setForgotOpen(true)}>Forgot password?</button></div>}
      {message && <div className="universal-form-message">{message}</div>}
      <button className="universal-primary-button" disabled={working || !email || password.length<6 || (authMode==="signup"&&!name.trim())} onClick={submitAuth}>{working?"Working…":authMode==="signin"?"Sign In":"Create Account"}</button>
      <small className="universal-legal">Football Pick&apos;em records peer-to-peer side bets but does not hold or transfer funds.</small>
    </section>

    {forgotOpen && <div className="universal-modal-backdrop"><section className="universal-small-modal"><button className="universal-modal-close" onClick={()=>setForgotOpen(false)}>×</button><KeyRound size={24}/><h2>Reset password</h2><p>We’ll email a secure link to the address above.</p><button className="universal-primary-button" disabled={working} onClick={resetPassword}>Send Reset Link</button></section></div>}
  </main>;

  if (stage === "home") return <main className="universal-dashboard">
    <header className="universal-topbar"><Image src="/football-pickem-wordmark.png" alt="Football Pick'em" width={800} height={100}/><button onClick={signOut}>Sign out</button></header>
    <section className="universal-dashboard-inner">
      <div className="universal-welcome"><span className="universal-eyebrow">WELCOME BACK</span><h1>{profile?.display_name || "Player"}</h1><p>{memberships.length ? "Choose a league or start another one." : "You’re ready. Join a league or create your own."}</p></div>
      {memberships.length>0 && <div className="universal-league-list">{memberships.map((m)=><Link key={m.group.id} href={"/league/"+m.group.slug} className="universal-league-card"><span><strong>{m.group.name}</strong><small>{m.role==="admin"?"Commissioner":"Member"} · {m.group.current_season_year}</small></span><ArrowRight size={18}/></Link>)}</div>}
      <div className="universal-action-grid">
        <button onClick={openCreate} className="universal-action-card primary"><Plus/><span><strong>Create a League</strong><small>Set every rule and invite your group.</small></span><ArrowRight/></button>
        <div className="universal-action-card"><Users/><span><strong>Join a League</strong><small>Enter the commissioner’s invite code.</small></span><div className="universal-join-inline"><input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="LEAGUE CODE"/><button disabled={working||joinCode.length<4} onClick={joinLeague}>Join</button></div></div>
      </div>
      <Link href="/demo" className="universal-secondary-link"><Eye size={16}/>Open Demo Mode</Link>
      {message && <div className="universal-form-message">{message}</div>}
    </section>
  </main>;

  if (stage === "created" && created) {
    const inviteUrl = typeof window !== "undefined" ? window.location.origin + "/join/" + created.inviteCode : "";
    return <main className="universal-dashboard"><header className="universal-topbar"><Image src="/football-pickem-wordmark.png" alt="Football Pick'em" width={800} height={100}/></header><section className="universal-created-view"><span className="universal-success-icon"><Check/></span><span className="universal-eyebrow">LEAGUE CREATED</span><h1>{created.group.name}</h1><p>Your league is ready. Members join free with your code or invite link.</p><div className="universal-invite-box"><span><small>LEAGUE CODE</small><strong>{created.inviteCode}</strong></span><button onClick={()=>navigator.clipboard?.writeText(inviteUrl)}><Link2 size={16}/>Copy Invite Link</button></div><div className="universal-created-actions"><Link href={"/league/"+created.group.slug} className="universal-primary-link">Enter League</Link><button onClick={()=>setStage("home")}>Back to My Leagues</button></div></section></main>;
  }

  const hasPickem = league.format !== "sidebets";
  const hasSideBets = league.format !== "pickem";
  const steps = ["League","Format","Football"].concat(hasPickem?["Pick'em"]:[]).concat(hasSideBets?["Side Bets"]:[]).concat(["Schedule","Review"]);
  const logical = [0,1,2].concat(hasPickem?[3]:[]).concat(hasSideBets?[4]:[]).concat([5,6]);
  const logicalStep = logical[setupStep] ?? 0;

  return <main className="universal-setup">
    <header className="universal-topbar"><button className="universal-back-home" onClick={()=>setStage("home")}><ChevronLeft/>My Leagues</button><Image src="/football-pickem-wordmark.png" alt="Football Pick'em" width={800} height={100}/><span /></header>
    <div className="universal-setup-layout">
      <aside className="universal-step-rail"><span className="universal-eyebrow">CREATE LEAGUE</span><h2>{league.leagueName||"New League"}</h2>{steps.map((s,i)=><div key={s} className={i===setupStep?"active":i<setupStep?"done":""}><i>{i<setupStep?<Check size={12}/>:i+1}</i><span>{s}</span></div>)}</aside>
      <section key={logicalStep} className="universal-setup-card">
        <div className="universal-mobile-progress"><span>Step {setupStep+1} of {steps.length}</span><b style={{width:((setupStep+1)/steps.length*100)+"%"}}/></div>
        {logicalStep===0 && <><span className="universal-eyebrow">LEAGUE BASICS</span><h1>Name it and size it.</h1><p>One commissioner payment covers the whole league for the season. Members join free.</p><label className="universal-input simple"><span>League name</span><input value={league.leagueName} onChange={e=>setLeague({...league,leagueName:e.target.value})} placeholder="Saturday Legends"/></label><label className="universal-input simple"><span>Custom invite code</span><input value={league.inviteCode} onChange={e=>setLeague({...league,inviteCode:e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,20)})} placeholder="SATURDAY-26"/></label><div className="universal-option-grid two">{(Object.keys(prices) as Tier[]).map(t=><Choice key={t} active={league.playerTier===t} title={t+" players"} detail={"$"+prices[t]+" for the season"} onClick={()=>setLeague({...league,playerTier:t})}/>)}</div></>}
        {logicalStep===1 && <><span className="universal-eyebrow">LEAGUE FORMAT</span><h1>Choose how your group plays.</h1><p>You can run a traditional Pick&apos;em, add peer-to-peer side bets, or use side bets by themselves.</p><div className="universal-option-grid"><Choice active={league.format==="pickem"} title="Pick'em" detail="Weekly picks, My Card and season standings." onClick={()=>setLeague({...league,format:"pickem"})}/><Choice active={league.format==="pickem-sidebets"} title="Pick'em + Side Bets" detail="The complete experience and recommended default." onClick={()=>setLeague({...league,format:"pickem-sidebets"})}/><Choice active={league.format==="sidebets"} title="Side Bets Only" detail="No weekly card; members challenge each other directly." onClick={()=>setLeague({...league,format:"sidebets"})}/></div></>}
        {logicalStep===2 && <><span className="universal-eyebrow">FOOTBALL</span><h1>Which games belong in the league?</h1><p>Choose college, NFL, or let members use both boards.</p><div className="universal-option-grid"><Choice active={league.footballSlate==="CFB"} title="College Football" detail="FBS college football only." onClick={()=>setLeague({...league,footballSlate:"CFB"})}/><Choice active={league.footballSlate==="NFL"} title="NFL" detail="NFL games only." onClick={()=>setLeague({...league,footballSlate:"NFL"})}/><Choice active={league.footballSlate==="BOTH"} title="College + NFL" detail="Both sports inside the same league." onClick={()=>setLeague({...league,footballSlate:"BOTH"})}/></div></>}
        {logicalStep===3 && hasPickem && <><span className="universal-eyebrow">PICK&apos;EM RULES</span><h1>Build the weekly card.</h1><p>Set the standings method, regular pick count and optional dog picks.</p><div className="universal-option-grid"><Choice active={league.scoringMode==="winning-percentage"} title="Winning Percentage" detail="Correct picks divided by graded picks." onClick={()=>setLeague({...league,scoringMode:"winning-percentage"})}/><Choice active={league.scoringMode==="total-wins"} title="Total Wins" detail="Most correct picks across the season wins." onClick={()=>setLeague({...league,scoringMode:"total-wins"})}/><Choice active={league.scoringMode==="confidence"} title="Confidence Points" detail={"Assign 1–"+league.weeklyPicks+" once each week. Correct picks earn their assigned points."} onClick={()=>setLeague({...league,scoringMode:"confidence"})}/></div><div className="universal-slider-block"><div><span>Regular picks each week</span><strong>{league.weeklyPicks}</strong></div><input type="range" min="3" max="15" value={league.weeklyPicks} onChange={e=>setLeague({...league,weeklyPicks:Number(e.target.value)})}/></div><Toggle checked={league.dogEnabled} title="Dog picks" detail="Pick an underdog to win outright. A losing dog does not add a regular loss." onChange={v=>setLeague({...league,dogEnabled:v})}/>{league.dogEnabled&&<><div className="universal-option-grid"><Choice active={league.dogPicks===1} title="1 dog" detail="One underdog pick each week." onClick={()=>setLeague({...league,dogPicks:1})}/><Choice active={league.dogPicks===2} title="2 dogs" detail="Two underdog picks each week." onClick={()=>setLeague({...league,dogPicks:2})}/><Choice active={league.dogPicks===3} title="3 dogs" detail="Three underdog picks each week." onClick={()=>setLeague({...league,dogPicks:3})}/></div><div className="universal-dog-explainer"><span>DOG BONUS</span><div><b>+7 to +9.5<strong>+1</strong></b><b>+10 to +19.5<strong>+2</strong></b><b>+20+<strong>+3</strong></b></div><small>Bigger successful underdogs earn bigger bonuses.</small></div></>}</>}
        {logicalStep===4 && hasSideBets && <><span className="universal-eyebrow">SIDE BETS</span><h1>Choose the challenge markets.</h1><p>These are peer-to-peer records inside the league. The app never holds or transfers the money.</p><div className="universal-toggle-stack"><Toggle checked={league.sideBetMoneyline} title="Moneyline" detail="Pick the outright winner." onChange={v=>setLeague({...league,sideBetMoneyline:v})}/><Toggle checked={league.sideBetTotals} title="Over / Under" detail="Challenge another member on a game total." onChange={v=>setLeague({...league,sideBetTotals:v})}/><Toggle checked={league.sideBetLive} title="Live Side Bets" detail="Allow offers while games are being played." onChange={v=>setLeague({...league,sideBetLive:v})}/></div><div className="universal-option-grid two"><Choice active={league.ledgerUnit==="bucks"} title="Bucks ($)" detail="Dollar-style ledger tracking." onClick={()=>setLeague({...league,ledgerUnit:"bucks"})}/><Choice active={league.ledgerUnit==="points"} title="Points" detail="Use a non-currency points ledger." onClick={()=>setLeague({...league,ledgerUnit:"points"})}/></div></>}
        {logicalStep===5 && <><span className="universal-eyebrow">SCHEDULE</span><h1>When does your league begin?</h1><p>Start from the opening week of the season, or—once games are underway—begin with the next week that has not started yet.</p><div className="universal-option-grid two universal-start-options"><Choice active={league.startMode==="season"} disabled={Boolean(startOptions && ((league.footballSlate!=="NFL" && startOptions.CFB.nextAvailableWeek>startOptions.CFB.seasonStartWeek) || (league.footballSlate!=="CFB" && startOptions.NFL.nextAvailableWeek>startOptions.NFL.seasonStartWeek)))} title="Season Start" detail={league.footballSlate==="CFB"?"CFB Week 0":league.footballSlate==="NFL"?"NFL Week 1":"CFB Week 0 · NFL Week 1"} onClick={()=>setLeague({...league,startMode:"season",startWeeks:{CFB:league.footballSlate==="NFL"?null:0,NFL:league.footballSlate==="CFB"?null:1}})}/><Choice active={league.startMode==="now"} title="Start Now" detail={league.footballSlate==="CFB"?"CFB Week "+(startOptions?.CFB.nextAvailableWeek??"—"):league.footballSlate==="NFL"?"NFL Week "+(startOptions?.NFL.nextAvailableWeek??"—"):"CFB Week "+(startOptions?.CFB.nextAvailableWeek??"—")+" · NFL Week "+(startOptions?.NFL.nextAvailableWeek??"—")} onClick={()=>setLeague({...league,startMode:"now",startWeeks:{CFB:league.footballSlate==="NFL"?null:startOptions?.CFB.nextAvailableWeek??0,NFL:league.footballSlate==="CFB"?null:startOptions?.NFL.nextAvailableWeek??1}})}/></div>{startOptions && ((league.footballSlate!=="NFL" && startOptions.CFB.nextAvailableWeek>0) || (league.footballSlate!=="CFB" && startOptions.NFL.nextAvailableWeek>1)) && <div className="universal-start-note"><ShieldCheck size={17}/><span><strong>The season is already underway.</strong><small>Season Start is locked so new standings never backfill games that already kicked off. Start Now begins at the next fully unstarted week.</small></span></div>}<div className="universal-option-grid two"><Choice active={league.weekOpen==="tuesday-9"} title="Tuesday 9 AM CT" detail="Recommended weekly opening time." onClick={()=>setLeague({...league,weekOpen:"tuesday-9"})}/><Choice active={league.weekOpen==="monday-9"} title="Monday 9 AM CT" detail="Open the next slate a day earlier." onClick={()=>setLeague({...league,weekOpen:"monday-9"})}/></div>{hasPickem&&<div className="universal-option-grid two"><Choice active={league.lockMode==="kickoff"} title="Lock each game at kickoff" detail="Future games remain editable." onClick={()=>setLeague({...league,lockMode:"kickoff"})}/><Choice active={league.lockMode==="saturday-11"} title="Saturday 11 AM CT" detail="Lock the entire card at one deadline." onClick={()=>setLeague({...league,lockMode:"saturday-11"})}/></div>}</>}
        {logicalStep===6 && <><span className="universal-eyebrow">REVIEW</span><h1>Ready to launch.</h1><p>Review the commissioner setup before creating the league.</p><div className="universal-review-card"><header><span><small>LEAGUE</small><strong>{league.leagueName||"Untitled League"}</strong></span><b>{"$"+prices[league.playerTier]}</b></header><div><span>Invite code</span><strong>{league.inviteCode||"—"}</strong></div><div><span>Format</span><strong>{league.format==="pickem-sidebets"?"Pick'em + Side Bets":league.format==="pickem"?"Pick'em":"Side Bets Only"}</strong></div><div><span>Football</span><strong>{league.footballSlate==="BOTH"?"College + NFL":league.footballSlate}</strong></div>{hasPickem&&<div><span>Weekly card</span><strong>{league.weeklyPicks+" picks"+(league.dogEnabled?" + "+league.dogPicks+" dog"+(league.dogPicks===1?"":"s"):"")}</strong></div>}<div><span>Starts</span><strong>{league.footballSlate!=="NFL"&&"CFB W"+league.startWeeks.CFB}{league.footballSlate==="BOTH"&&" · "}{league.footballSlate!=="CFB"&&"NFL W"+league.startWeeks.NFL}</strong></div></div>{message&&<div className="universal-form-message">{message}</div>}<button className="universal-primary-button" disabled={working||!league.leagueName||league.inviteCode.length<4} onClick={createLeague}>{working?"Creating…":"Create League · $"+prices[league.playerTier]+"/season"}</button></>}
        <footer className="universal-wizard-actions"><button disabled={setupStep===0} onClick={()=>setSetupStep(Math.max(0,setupStep-1))}>Back</button>{setupStep<steps.length-1&&<button className="primary" onClick={()=>setSetupStep(Math.min(steps.length-1,setupStep+1))}>Continue<ArrowRight size={16}/></button>}</footer>
      </section>
    </div>
  </main>;
}
