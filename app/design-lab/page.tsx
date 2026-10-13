"use client";

import { useState } from "react";
import { Activity, ArrowLeft, ChevronDown, Clock3, Play, SquareCheck, Trophy, Send, X } from "lucide-react";
import "./design-lab.css";

type Surface = "tracker" | "matchup";
type TrackerTab = "live" | "scoring" | "plays" | "box";
type PreviewTab = "analytics" | "form" | "history";

function TeamMark({ team, small = false }: { team: "Oregon" | "USC"; small?: boolean }) {
  return <span className={`lab-mark ${team === "Oregon" ? "ducks" : "trojans"} ${small ? "small" : ""}`} aria-label={team}>{team === "Oregon" ? "O" : "SC"}</span>;
}

const plays = [
  { quarter: "4TH", time: "8:42", down: "1st & 10 · USC 24", event: "Gabriel passes to Stewart for 14 yards. First down.", result: "FIRST DOWN" },
  { quarter: "4TH", time: "9:11", down: "2nd & 6 · USC 38", event: "James rushes right for 7 yards.", result: "FIRST DOWN" },
  { quarter: "4TH", time: "9:48", down: "1st & 10 · USC 42", event: "Gabriel completes short left for 4 yards.", result: "" }
];

function TrackerContent({ tab, expanded, setExpanded }: { tab: TrackerTab; expanded: number; setExpanded: (n: number) => void }) {
  if (tab === "live") return <div className="lab-content">
    <div className="lab-section-eyebrow"><Activity size={14} /> <span>OREGON BALL</span><b>1st & 10 · USC 24</b></div>
    <div className="lab-field" role="img" aria-label="Illustrative football field, ball at USC 24 yard line">
      <div className="lab-endzone left"><span>OREGON</span></div>
      <div className="lab-yardlines">{[10,20,30,40,50,40,30,20,10].map((yard,i)=><i key={i} style={{left:`${12 + i * 9.5}%`}}><span>{yard}</span></i>)}</div>
      <div className="lab-line-of-scrimmage"/>
      <div className="lab-first-down"/>
      <div className="lab-football"><span>◆</span></div>
      <div className="lab-endzone right"><span>USC</span></div>
    </div>
    <div className="lab-drive-card">
      <div className="lab-drive-head"><TeamMark team="Oregon" small/><div><strong>Current drive</strong><small>5 plays <em>·</em> 47 yards <em>·</em> 2:16 possession</small></div><span className="lab-live-dot">LIVE</span></div>
      {plays.slice(0,2).map((p,i)=><div className="lab-play-inline" key={i}><small>{p.down} <em>·</em> {p.time}</small><p>{p.event}</p></div>)}
    </div>
    <p className="lab-demo-note">Illustrative live game data for comparing layout, not an actual score.</p>
  </div>;

  if (tab === "scoring") return <div className="lab-scoring">
    <div className="lab-quarter"><span>4TH QUARTER</span><span className="lab-score-heading"><TeamMark team="Oregon" small/><TeamMark team="USC" small/></span></div>
    {[
      { team:"Oregon" as const, kind:"TOUCHDOWN", time:"11:34", description:"James 6-yard run · PAT good", meta:"8 plays · 75 yards · 4:12 possession", scores:["24","21"]},
      { team:"USC" as const, kind:"FIELD GOAL", time:"14:52", description:"36-yard field goal is good", meta:"11 plays · 54 yards · 3:28 possession", scores:["17","21"]}
    ].map((p,i)=><div className="lab-scoring-row" key={i}><TeamMark team={p.team} small/><div className="lab-scoring-copy"><div className="lab-scoring-top"><b>{p.kind}</b><small>{p.time}</small></div><p>{p.description}</p><small>{p.meta}</small></div><div className="lab-inline-scores"><b>{p.scores[0]}</b><b>{p.scores[1]}</b></div></div>)}
    <div className="lab-quarter"><span>3RD QUARTER</span><span className="lab-score-heading"><TeamMark team="Oregon" small/><TeamMark team="USC" small/></span></div>
    <div className="lab-scoring-row"><TeamMark team="USC" small/><div className="lab-scoring-copy"><div className="lab-scoring-top"><b>TOUCHDOWN</b><small>3:27</small></div><p>24-yard passing touchdown · PAT good</p><small>6 plays · 63 yards · 2:51 possession</small></div><div className="lab-inline-scores"><b>17</b><b>18</b></div></div>
  </div>;

  if (tab === "plays") return <div className="lab-plays">
    {[{team:"Oregon" as const,title:"Current drive",meta:"5 plays · 47 yards · 2:16 possession"},{team:"USC" as const,title:"Punt",meta:"4 plays · 18 yards · 1:09 possession"},{team:"Oregon" as const,title:"Touchdown",meta:"8 plays · 75 yards · 4:12 possession"}].map((row,i)=><div className="lab-drive-collapsible" key={i}>
      <button type="button" onClick={()=>setExpanded(expanded===i?-1:i)} aria-expanded={expanded===i}><TeamMark team={row.team} small/><span><strong>{row.title}</strong><small>{row.meta}</small></span><ChevronDown size={17} className={expanded===i?"rotated":""}/></button>
      {expanded===i && <div className="lab-drive-expanded">{plays.map((p,j)=><div key={j}><small>{p.down} <em>·</em> {p.time}</small><p>{p.event}</p></div>)}</div>}
    </div>)}
  </div>;

  return <div className="lab-boxscore"><div className="lab-box-pills"><button>OREGON</button><button className="active">ALL</button><button>USC</button></div><div className="lab-box-heading">TEAM STATISTICS</div>{[
    ["21","First downs","18"],["342","Total yards","318"],["198","Passing yards","244"],["144","Rushing yards","74"],["6 / 11","Third down","5 / 12"],["2","Turnovers","1"],["31:28","Possession","28:32"]
  ].map((row,i)=><div className="lab-stat" key={i}><b>{row[0]}</b><span>{row[1]}</span><b>{row[2]}</b></div>)}</div>;
}

function PreviewContent({ tab }: { tab: PreviewTab }) {
  if(tab==="analytics") return <div className="lab-preview-table">
    <div className="lab-metric-title">MATCHUP BREAKDOWN <span>SEASON TO DATE</span></div>
    <div className="lab-comparison-head"><span>OREGON</span><span>ADVANCED METRIC</span><span>USC</span></div>
    {[
      ["+0.25","EPA / PLAY","+0.12",true],["48.7%","SUCCESS RATE","43.2%",true],["6.2","YARDS / PLAY","5.8",true],["41.8%","3RD DOWN","39.5%",true],["#12","OFFENSE RANK","#24",true],["#19","DEFENSE RANK","#32",false]
    ].map((r,i)=><div className="lab-metric-row" key={i}><strong className={r[3]?"leading":""}>{r[0]}</strong><span>{r[1]}</span><strong>{r[2]}</strong></div>)}
    <div className="lab-section-eyebrow" style={{marginTop:14}}>HOW TO READ IT</div>
    <p className="lab-analysis-explainer">Values are illustrative. We’re comparing whether stats are easier to scan in a dense full-screen table or grouped cards.</p>
  </div>;
  if(tab==="form")return <div className="lab-form-view"><div className="lab-metric-title">RECENT FORM</div>{[
    ["Oregon","W","38–24","vs Michigan","OCT 3"],["Oregon","W","31–17","at Washington","SEP 26"],
    ["USC","L","24–28","at Penn State","OCT 3"],["USC","W","35–21","vs Nebraska","SEP 26"]
  ].map((row,i)=><div className="lab-form-row" key={i}><TeamMark team={row[0] as "Oregon"|"USC"} small/><span className={row[1]==="W"?"win":"loss"}>{row[1]}</span><div><b>{row[2]}</b><small>{row[3]}</small></div><small>{row[4]}</small></div>)}</div>;
  return <div className="lab-form-view"><div className="lab-metric-title">HEAD-TO-HEAD</div><div className="lab-history-summary"><div><TeamMark team="Oregon"/><strong>3</strong><small>WINS</small></div><span>LAST FIVE</span><div><TeamMark team="USC"/><strong>2</strong><small>WINS</small></div></div>{["2025 · Oregon 31 – USC 24","2024 · USC 28 – Oregon 27","2023 · Oregon 36 – USC 27"].map(x=><div className="lab-history-row" key={x}>{x}</div>)}</div>;
}

export default function DesignLab() {
  const variant = "refined" as "refined" | "reimagined";
  const [surface,setSurface]=useState<Surface>("tracker");
  const [trackerTab,setTrackerTab]=useState<TrackerTab>("live");
  const [previewTab,setPreviewTab]=useState<PreviewTab>("analytics");
  const [open,setOpen]=useState(true);
  const [nav,setNav]=useState("Picks");
  const [expanded,setExpanded]=useState(0);
  const setSurfaceOpen=(s:Surface)=>{setSurface(s);setOpen(true);};
  const label=variant==="refined"?"A · Refined Original":"B · Reimagined Panel";
  const trackerTabs:TrackerTab[]=["live","scoring","plays","box"];
  const previewTabs:PreviewTab[]=["analytics","form","history"];

  return <main className="ui-lab" data-variant={variant}>
    <div className="lab-introduction">
      <a className="lab-back" href="/friends"><ArrowLeft size={15}/> Back to preview app</a>
      <span className="lab-overline">PICK’EM INTERFACE STUDY</span>
      <h1>{label}</h1>
      <p>{variant==="refined"?"Full-screen information. Precise alignment. The familiar football-app design, with more deliberate visual rhythm.":"A navigable game panel. More breathing room. A different layout that keeps your main navigation within reach."}</p>
      <span className="lab-note-tag">Sample data · No live bets or picks</span>
      <div className="lab-experience-switch" role="group" aria-label="Which experience to preview">
        <button type="button" className={surface==="tracker"?"active":""} onClick={()=>setSurfaceOpen("tracker")}><Activity size={15}/> GameTracker</button>
        <button type="button" className={surface==="matchup"?"active":""} onClick={()=>setSurfaceOpen("matchup")}><Trophy size={15}/> Matchup Preview</button>
      </div>
    </div>

    <div className="lab-phone">
      <div className="lab-app-chrome"><span>SHAW <b>PICK’EM</b></span><small>WEEK 8 <ChevronDown size={13}/></small></div>
      <div className="lab-underlay"><div className="lab-board-title">WEEK 8 MATCHUPS</div><div className="lab-board-game"><div className="lab-board-line"><TeamMark team="Oregon" small/><b>Oregon</b><small>24</small></div><div className="lab-board-line"><TeamMark team="USC" small/><b>USC</b><small>21</small></div><div className="lab-board-meta"><span className="lab-live-dot">LIVE</span> 4TH · 8:42</div></div><button onClick={()=>setSurfaceOpen("tracker")}>Open GameTracker <Play size={14}/></button><button onClick={()=>setSurfaceOpen("matchup")}>Open Matchup Preview <ChevronDown size={14}/></button><p>This is a demonstration of layout and navigation behavior.</p></div>

      {open && <div className="lab-panel-layer">
        <section className="lab-panel" aria-label={surface==="tracker"?"GameTracker design demo":"Matchup Preview design demo"}>
          <header className="lab-panel-header"><div><small>{surface==="tracker"?"GAME CENTER":"PRE-GAME INTELLIGENCE"}</small><strong>Oregon at USC</strong></div><button onClick={()=>setOpen(false)} aria-label="Close design preview"><X size={18}/></button></header>
          {surface==="tracker"?<>
            <div className="lab-scoreboard"><div className="lab-team"><div className="lab-team-score"><TeamMark team="Oregon"/><b>24</b></div><strong>OREGON</strong><div className="lab-timeouts"><i/><i/><i className="off"/></div></div>
              <div className="lab-game-status"><span className="lab-status-pill">4TH QUARTER</span><b>8:42</b><small>1st & 10 · USC 24</small></div>
              <div className="lab-team"><div className="lab-team-score"><TeamMark team="USC"/><b>21</b></div><strong>USC</strong><div className="lab-timeouts"><i/><i className="off"/><i className="off"/></div></div>
            </div>
            <nav className="lab-detail-tabs" aria-label="GameTracker demo tabs">{trackerTabs.map(id=><button key={id} className={trackerTab===id?"active":""} onClick={()=>setTrackerTab(id)}>{id==="box"?"Box Score":id[0].toUpperCase()+id.slice(1)}</button>)}</nav>
            <div className="lab-panel-scroll"><TrackerContent tab={trackerTab} expanded={expanded} setExpanded={setExpanded}/></div>
          </>:<>
            <div className="lab-matchup-kickoff"><Clock3 size={12}/> SATURDAY · OCT 17 · 2:30 PM CT</div>
            <div className="lab-preview-hero"><div><TeamMark team="Oregon"/><b>Oregon</b><span>5–1 <em>·</em> −3.5</span></div><span className="lab-versus">AT</span><div><TeamMark team="USC"/><b>USC</b><span>4–2 <em>·</em> +3.5</span></div></div>
            <nav className="lab-detail-tabs" aria-label="Matchup preview demo tabs">{previewTabs.map(id=><button key={id} className={previewTab===id?"active":""} onClick={()=>setPreviewTab(id)}>{id[0].toUpperCase()+id.slice(1)}</button>)}</nav>
            <div className="lab-panel-scroll"><PreviewContent tab={previewTab}/></div>
          </>}
        </section>
      </div>}

      <nav className="lab-main-nav" aria-label="Main navigation demo">{[
        {id:"Picks",icon:Activity},{id:"My Card",icon:SquareCheck},{id:"Side Bets",icon:Send},{id:"Standings",icon:Trophy}
      ].map(item=><button key={item.id} className={nav===item.id?"active":""} onClick={()=>{setNav(item.id);setOpen(false);}}><item.icon size={19}/><span>{item.id}</span></button>)}</nav>
    </div>
    <div className="lab-caption">{variant==="refined"?"A: The detail view takes over the screen. Close it to return to the app.":"B: The game panel floats between the header and the persistent bottom navigation. Tap a nav item to leave it."} <strong>Try the tabs, scrolling, Close button and switching between GameTracker and Matchup Preview.</strong></div>
    <a href="/friends" className="lab-live-link">Return to Friends Pick’em preview <ArrowLeft size={14}/></a>
  </main>;
}
