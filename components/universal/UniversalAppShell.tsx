"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, BarChart3, Check, ChevronLeft, CircleDollarSign, Eye, KeyRound, Link2, LockKeyhole, Mail, Plus, Settings2, ShieldCheck, Trophy, Users, Zap } from "lucide-react";
import { getUniversalSupabase, setRememberMe } from "@/lib/universalAuthClient";
import { clearClientSession, storeClientSession } from "@/lib/clientSession";

type Membership = {
  role: string;
  memberCount: number;
  playerLimit: number | null;
  inviteCode: string | null;
  group: { id: string; slug: string; name: string; short_name?: string | null; current_season_year: number };
};
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

function ProductHeader({ label }: { label?: string }) {
  return <header className="scoreboard-header">
    <div className="scoreboard-main">
      <div className="brand-lockup">
        <Image className="header-wordmark" src="/football-pickem-wordmark.png" alt="Football Pick'em" width={800} height={100} priority />
      </div>
      <div className="header-actions">
        {label ? <div className="test-week-chip">{label}</div> : null}
      </div>
    </div>
  </header>;
}

export default function UniversalAppShell() {
  const supabase = useMemo(() => getUniversalSupabase(), []);
  const [stage, setStage] = useState<Stage>("loading");
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
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
    async function loadAccount() {
      const response = await fetch("/api/universal/bootstrap", { method: "POST", headers: { Authorization: "Bearer " + accessToken } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load account.");
      return payload;
    }

    let payload = await loadAccount();
    const pendingJoinCode = new URL(window.location.href).searchParams.get("join")?.trim().toUpperCase() || "";
    if (pendingJoinCode) {
      const joinResponse = await fetch("/api/universal/join", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
        body: JSON.stringify({ code: pendingJoinCode })
      });
      const joinPayload = await joinResponse.json();
      if (joinResponse.ok) {
        payload = await loadAccount();
        setJoinCode("");
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete("join");
        window.history.replaceState({}, "", currentUrl.pathname + currentUrl.search + currentUrl.hash);
      } else {
        setJoinCode(pendingJoinCode);
        setMessage(joinPayload.error || "That league invite could not be joined.");
      }
    }

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

  async function copyLeagueInvite(membership: Membership) {
    if (!membership.inviteCode) return;
    const inviteUrl = window.location.origin + "/join/" + membership.inviteCode;
    try {
      await navigator.clipboard?.writeText(inviteUrl);
      setMessage(`Invite link copied for ${membership.group.name}.`);
    } catch {
      setMessage(`League code: ${membership.inviteCode}`);
    }
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

  if (stage === "loading") return <div className="app-shell universal-entry-app">
    <ProductHeader label="ACCOUNT" />
    <main className="container universal-account-container"><section className="panel universal-account-panel universal-account-loading"><span className="spinner" />Loading your account…</section></main>
  </div>;

  if (stage === "auth") return <div className="app-shell universal-entry-app universal-overview-page">
    <ProductHeader label="FOOTBALL PICK'EM" />
    <main className="container universal-overview-container">
      <section className="panel universal-overview-hero">
        <span className="universal-eyebrow">YOUR LEAGUE. YOUR RULES.</span>
        <h1 className="universal-motto"><span>Bet Your Friends.</span><span>Not the Sportsbook.</span></h1>
        <p>Custom Pick&apos;em leagues, peer-to-peer side bets, advanced matchup stats and live GameTracker — all in one app.</p>
        <div className="universal-overview-actions">
          <a href="#account" className="btn gold"><Plus size={17}/>Create Account</a>
          <Link href="/demo" className="btn"><Eye size={17}/>Try Demo</Link>
        </div>
      </section>

      <section className="panel universal-feature-overview">
        <div className="section-title"><div><h2>Everything in one league</h2><p>The same features you use every football week, built into one app.</p></div></div>
        <div className="universal-feature-grid">
          <article className="universal-feature-card"><span><Zap size={18}/></span><div><strong>Weekly Pick&apos;em</strong><p>Build your card from college football, NFL or both. Commissioners control pick count, scoring and weekly rules.</p></div></article>
          <article className="universal-feature-card"><span><Trophy size={18}/></span><div><strong>Dog Picks</strong><p>Take an underdog to win outright and earn bigger bonuses for bigger upsets. Leagues can use 1–3 dogs per week.</p></div></article>
          <article className="universal-feature-card"><span><CircleDollarSign size={18}/></span><div><strong>Peer-to-Peer Side Bets</strong><p>Send spread, moneyline and over/under challenges to league members, including live offers during games.</p></div></article>
          <article className="universal-feature-card"><span><BarChart3 size={18}/></span><div><strong>Matchup Preview</strong><p>Research games with records, ATS performance, form and advanced team metrics before making a pick.</p></div></article>
          <article className="universal-feature-card"><span><Activity size={18}/></span><div><strong>GameTracker</strong><p>Follow the score, down and distance, field position, drives, scoring, plays and box score without leaving the app.</p></div></article>
          <article className="universal-feature-card"><span><Settings2 size={18}/></span><div><strong>Commissioner Controls</strong><p>Choose league format, scoring, sports, side-bet markets, start week, lock rules and invite your group with one code.</p></div></article>
        </div>
      </section>

      <section className="panel universal-how-panel">
        <div className="section-title"><div><h2>How it works</h2><p>Set up once, then use the same league all season.</p></div></div>
        <div className="universal-how-steps">
          <div><b>1</b><span><strong>Create or join</strong><small>A commissioner creates the league. Everyone else joins free with the invite link or code.</small></span></div>
          <div><b>2</b><span><strong>Play each week</strong><small>Make your Pick&apos;em card, send side bets and use matchup data before kickoff.</small></span></div>
          <div><b>3</b><span><strong>Follow it live</strong><small>Track games, results, standings and side-bet history through the season.</small></span></div>
        </div>
        <Link href="/demo" className="universal-demo-real-link compact"><Eye size={17}/><span><strong>See the real app first</strong><small>Demo Mode opens the actual Pick&apos;em experience with demo data</small></span><ArrowRight size={17}/></Link>
      </section>

      <section id="account" className="panel universal-account-panel universal-account-bottom">
        <div className="universal-account-intro">
          <span className="universal-eyebrow">GET STARTED</span>
          <h2>{authMode==="signup"?"Create your account":"Welcome back"}</h2>
          <p>{authMode==="signup"?"Create one account, then join a league or start your own.":"Sign in to open your leagues."}</p>
        </div>

        <div className="section-tabs">
          <button className={authMode==="signup"?"active":""} onClick={()=>setAuthMode("signup")}>Create Account</button>
          <button className={authMode==="signin"?"active":""} onClick={()=>setAuthMode("signin")}>Sign In</button>
        </div>

        {authMode==="signup" && <label className="universal-input"><span>Name</span><div><Users size={16}/><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" autoComplete="name" /></div></label>}
        <label className="universal-input"><span>Email</span><div><Mail size={16}/><input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@example.com" autoComplete="email" /></div></label>
        <label className="universal-input"><span>Password</span><div><LockKeyhole size={16}/><input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder={authMode==="signup"?"8+ characters":"Password"} autoComplete={authMode==="signup"?"new-password":"current-password"} /></div></label>

        {authMode==="signin" && <div className="universal-login-options"><label><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} />Keep me signed in</label><button onClick={()=>setForgotOpen(true)}>Forgot password?</button></div>}
        {message && <div className="error-card universal-auth-error">{message}</div>}

        <button className="btn gold full universal-auth-submit" disabled={working || !email || password.length<6 || (authMode==="signup"&&!name.trim())} onClick={submitAuth}>{working?"Working…":authMode==="signup"?"Create Account":"Sign In"}</button>
        <small className="universal-legal">Football Pick&apos;em records peer-to-peer side bets but does not hold or transfer funds.</small>
      </section>
    </main>

    {forgotOpen && <div className="universal-modal-backdrop"><section className="universal-small-modal"><button className="universal-modal-close" onClick={()=>setForgotOpen(false)}>×</button><KeyRound size={24}/><h2>Reset password</h2><p>We’ll email a secure link to the address above.</p><button className="btn gold full" disabled={working} onClick={resetPassword}>Send Reset Link</button></section></div>}
  </div>;

  if (stage === "home") return <div className="app-shell universal-entry-app">
    <ProductHeader label="MY LEAGUES" />
    <main className="container universal-account-container">
      <section className="panel universal-leagues-panel">
        <div className="section-title">
          <div><h2>{profile?.display_name || "Player"}</h2><p>{memberships.length ? "Choose a league or create another one." : "Join a league or create your first one."}</p></div>
          <button className="btn" onClick={signOut}>Sign Out</button>
        </div>

        {memberships.length>0 && <div className="universal-league-list">{memberships.map((m)=>{
          const commissioner = m.role==="admin" || m.role==="owner";
          const memberText = m.playerLimit == null
            ? `${m.memberCount} member${m.memberCount===1?"":"s"}`
            : `${m.memberCount}/${m.playerLimit} members`;
          return <div key={m.group.id} className="universal-league-card">
            <Link href={"/league/"+m.group.slug} className="universal-league-card-main"><span><strong>{m.group.name}</strong><small>{commissioner?"Commissioner":"Member"} · {memberText} · {m.group.current_season_year}</small></span><ArrowRight size={18}/></Link>
            {commissioner && m.inviteCode && <button type="button" className="universal-league-invite-button" onClick={()=>void copyLeagueInvite(m)}><Link2 size={15}/><span>Invite</span></button>}
          </div>;
        })}</div>}

        <div className="universal-home-actions">
          <button onClick={openCreate} className="btn gold full"><Plus size={17}/>Create a League</button>
          <div className="universal-join-panel">
            <span><Users size={17}/><strong>Join a League</strong></span>
            <div className="universal-join-inline"><input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="LEAGUE CODE"/><button disabled={working||joinCode.length<4} onClick={joinLeague}>Join</button></div>
          </div>
          <Link href="/demo" className="universal-demo-real-link compact"><Eye size={17}/><span><strong>Demo Mode</strong><small>Open the real app with demo data</small></span><ArrowRight size={17}/></Link>
        </div>

        {message && <div className="error-card universal-auth-error">{message}</div>}
      </section>
    </main>
  </div>;

  if (stage === "created" && created) {
    const inviteUrl = typeof window !== "undefined" ? window.location.origin + "/join/" + created.inviteCode : "";
    return <div className="app-shell universal-entry-app"><ProductHeader label="LEAGUE CREATED" /><section className="universal-created-view"><span className="universal-success-icon"><Check/></span><span className="universal-eyebrow">LEAGUE CREATED</span><h1>{created.group.name}</h1><p>Your league is ready. Members join free with your code or invite link.</p><div className="universal-invite-box"><span><small>LEAGUE CODE</small><strong>{created.inviteCode}</strong></span><button onClick={()=>navigator.clipboard?.writeText(inviteUrl)}><Link2 size={16}/>Copy Invite Link</button></div><div className="universal-created-actions"><Link href={"/league/"+created.group.slug} className="universal-primary-link">Enter League</Link><button onClick={()=>setStage("home")}>Back to My Leagues</button></div></section></div>;
  }

  const hasPickem = league.format !== "sidebets";
  const hasSideBets = league.format !== "pickem";
  const steps = ["League","Format","Football"].concat(hasPickem?["Pick'em"]:[]).concat(hasSideBets?["Side Bets"]:[]).concat(["Schedule","Review"]);
  const logical = [0,1,2].concat(hasPickem?[3]:[]).concat(hasSideBets?[4]:[]).concat([5,6]);
  const logicalStep = logical[setupStep] ?? 0;

  return <div className="app-shell universal-entry-app">
    <ProductHeader label="CREATE LEAGUE" />
    <div className="universal-setup-layout">
      <button className="universal-setup-back" onClick={()=>setStage("home")}><ChevronLeft size={16}/>My Leagues</button>
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
  </div>;
}
