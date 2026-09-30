"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, BarChart3, CircleDollarSign, Lock, Send, Trophy, X } from "lucide-react";

type Tab = "picks" | "card" | "sidebets" | "standings";

const games = [
  { id:"ore-psu", time:"6:30 PM", away:"Oregon", home:"Penn State", awayMark:"O", homeMark:"PS", awaySpread:-4.5, homeSpread:4.5, awayRank:8, homeRank:12 },
  { id:"bama-uga", time:"7:00 PM", away:"Alabama", home:"Georgia", awayMark:"A", homeMark:"UG", awaySpread:3.5, homeSpread:-3.5, awayRank:9, homeRank:5 },
  { id:"kc-buf", time:"7:20 PM", away:"Kansas City", home:"Buffalo", awayMark:"KC", homeMark:"BUF", awaySpread:2.5, homeSpread:-2.5, awayRank:null, homeRank:null }
];

export default function DemoLeagueApp() {
  const [tab,setTab]=useState<Tab>("picks");
  const [picks,setPicks]=useState<Record<string,string>>({});
  const [sideBets,setSideBets]=useState<Array<{id:number;game:string;offer:string;to:string;amount:number}>>([
    {id:1,game:"Oregon at Penn State",offer:"Oregon -3.5",to:"Mason",amount:20}
  ]);
  const [offerGame,setOfferGame]=useState(games[0]);
  const [offer,setOffer]=useState("Oregon -4.5");
  const [recipient,setRecipient]=useState("Mason");
  const [amount,setAmount]=useState(20);
  const [offerOpen,setOfferOpen]=useState(false);
  const [feature,setFeature]=useState<"matchup"|"tracker"|null>(null);

  function openOffer(game: typeof games[number]) {
    setOfferGame(game);
    setOffer(game.away + " " + (game.awaySpread > 0 ? "+" : "") + game.awaySpread);
    setOfferOpen(true);
  }

  function sendOffer() {
    setSideBets((current)=>[
      { id:Date.now(), game:offerGame.away+" at "+offerGame.home, offer, to:recipient, amount },
      ...current
    ]);
    setOfferOpen(false);
  }

  return <main className="demo-app-shell">
    <header className="scoreboard-header">
      <div className="scoreboard-main">
        <div className="brand-lockup"><Image className="header-wordmark" src="/football-pickem-wordmark.png" alt="Football Pick'em" width={800} height={100}/></div>
        <span className="test-week-chip">DEMO · WEEK 5</span>
      </div>
    </header>

    <Link href="/" className="demo-exit"><ArrowLeft size={15}/>Exit Demo</Link>

    <main className="container">
      {tab==="picks" && <section className="panel picks-panel">
        <div className="section-tabs"><button className="active">CFB</button><button>NFL</button></div>
        <div className="demo-notice"><strong>Demo Mode</strong><span>Fixed spreads · sample data · nothing affects a real league.</span></div>
        <div className="game-day-marker"><b>SAT</b><strong>OCT 3</strong></div>
        <div className="game-list">
          {games.map((game)=><article className="game-card status-open" key={game.id}>
            <div className="game-head">
              <span className="badge open">Open</span>
              <div className="game-time-group"><span className="game-time">{game.time}</span><button className="demo-text-link" onClick={()=>setFeature("matchup")}>Matchup Preview</button></div>
            </div>
            <div className="stacked-matchup">
              <button className={"team-row selectable "+(picks[game.id]===game.away?"selected":"")} onClick={()=>setPicks({...picks,[game.id]:game.away})}>
                <span className="team-logo demo-logo">{game.awayMark}</span>
                <span className="team-name-line">{game.awayRank && <span className="board-team-rank">#{game.awayRank}</span>}<span className="team-name">{game.away}</span></span>
                <span className="team-spread">{game.awaySpread>0?"+":""}{game.awaySpread}</span>
              </button>
              <button className={"team-row selectable "+(picks[game.id]===game.home?"selected":"")} onClick={()=>setPicks({...picks,[game.id]:game.home})}>
                <span className="team-logo demo-logo">{game.homeMark}</span>
                <span className="team-name-line">{game.homeRank && <span className="board-team-rank">#{game.homeRank}</span>}<span className="team-name">{game.home}</span></span>
                <span className="team-spread">{game.homeSpread>0?"+":""}{game.homeSpread}</span>
              </button>
            </div>
            <div className="demo-game-actions">
              <button onClick={()=>openOffer(game)}><CircleDollarSign size={15}/>Side Bet</button>
              {game.id==="bama-uga" && <button onClick={()=>setFeature("tracker")}><BarChart3 size={15}/>GameTracker Demo</button>}
            </div>
          </article>)}
        </div>
      </section>}

      {tab==="card" && <section className="panel card-panel">
        <div className="section-title"><div><h2>My Card</h2><p>{Object.keys(picks).length} demo picks selected</p></div></div>
        <div className="pick-section">
          {Object.entries(picks).length ? Object.entries(picks).map(([id,team])=>{
            const game=games.find((item)=>item.id===id)!;
            return <div className="pick-card" key={id}><div className="pick-top"><span className="team-logo demo-logo">{team.slice(0,2).toUpperCase()}</span><div className="pick-copy"><strong className="pick-title">{team}</strong><p className="pick-meta">{game.away} at {game.home}</p></div><Lock size={16}/></div></div>;
          }) : <div className="demo-empty">Choose picks from the Pick Board to build your demo card.</div>}
        </div>
      </section>}

      {tab==="sidebets" && <section className="panel">
        <div className="section-title"><div><h2>Side Bets</h2><p>Send sample challenges exactly like a league member.</p></div><button className="btn gold" onClick={()=>setOfferOpen(true)}><Send size={15}/>New</button></div>
        <div className="side-bet-list">{sideBets.map((bet)=><div className="side-bet-card" key={bet.id}><div className="side-bet-offer-row"><span className="team-logo demo-logo">$</span><div className="side-bet-offer-copy"><strong>{bet.offer}</strong><p>You offered {bet.to} · {bet.game}</p></div><div className="side-bet-offer-amount">{"$"+bet.amount}</div></div></div>)}</div>
      </section>}

      {tab==="standings" && <section className="panel standings-panel">
        <div className="section-title"><div><h2>Season Standings</h2><p>Sample league standings</p></div></div>
        <div className="leaderboard">
          <div className="leaderboard-labels"><span>RK</span><span>PLAYER</span><span>W</span><span>L</span><span>P</span><span>PCT</span></div>
          {[["1","Mason","18","7","0","72%"],["2","You","17","8","0","68%"],["3","Josh","16","9","0","64%"],["4","Caleb","15","10","0","60%"]].map((row)=><div className="leaderboard-row" key={row[1]}><span className="leaderboard-rank">{row[0]}</span><span className="leaderboard-player"><strong>{row[1]}</strong></span><span className="leaderboard-stat">{row[2]}</span><span className="leaderboard-stat">{row[3]}</span><span className="leaderboard-stat">{row[4]}</span><strong className="leaderboard-pct">{row[5]}</strong></div>)}
        </div>
      </section>}
    </main>

    <nav className="primary-nav"><div className="primary-nav-inner">
      <button className={tab==="picks"?"active":""} onClick={()=>setTab("picks")}><Trophy size={20}/><span>Picks</span></button>
      <button className={tab==="card"?"active":""} onClick={()=>setTab("card")}><Lock size={20}/><span>My Card</span></button>
      <button className={tab==="sidebets"?"active":""} onClick={()=>setTab("sidebets")}><CircleDollarSign size={20}/><span>Side Bets</span></button>
      <button className={tab==="standings"?"active":""} onClick={()=>setTab("standings")}><BarChart3 size={20}/><span>Standings</span></button>
    </div></nav>

    {offerOpen && <div className="confirmation-backdrop"><section className="confirmation-card demo-offer-modal">
      <button className="demo-modal-x" onClick={()=>setOfferOpen(false)}><X size={18}/></button>
      <span className="universal-eyebrow">SEND SIDE BET</span><h2>{offerGame.away} at {offerGame.home}</h2>
      <label>Offer<input value={offer} onChange={(event)=>setOffer(event.target.value)}/></label>
      <label>Send to<select value={recipient} onChange={(event)=>setRecipient(event.target.value)}><option>Mason</option><option>Josh</option><option>Caleb</option><option>All</option></select></label>
      <label>Amount<input type="number" min="10" value={amount} onChange={(event)=>setAmount(Number(event.target.value))}/></label>
      <button className="btn gold full" onClick={sendOffer}>{"Send $"+amount+" Offer"}</button>
    </section></div>}

    {feature && <div className="confirmation-backdrop"><section className="demo-feature-modal">
      <button className="demo-modal-x" onClick={()=>setFeature(null)}><X size={18}/></button>
      {feature==="matchup" ? <>
        <span className="universal-eyebrow">MATCHUP PREVIEW</span><h2>Oregon at Penn State</h2>
        <div className="demo-stat-grid"><span><small>OREGON ATS</small><strong>4–1</strong><b>+6.2 avg cover</b></span><span><small>PENN STATE ATS</small><strong>3–2</strong><b>+1.8 avg cover</b></span></div>
        <h3>Advanced Comparison</h3>
        {[["Adj. EPA / play","+0.218","#8","+0.147","#19"],["Success rate","51.2%","#11","47.8%","#31"],["Late-down success","48.4%","#14","43.1%","#39"]].map((metric)=><div className="demo-metric" key={metric[0]}><span><strong>{metric[1]}</strong><small>{metric[2]}</small></span><b>{metric[0]}</b><span><strong>{metric[3]}</strong><small>{metric[4]}</small></span></div>)}
      </> : <>
        <span className="universal-eyebrow">GAMETRACKER DEMO</span>
        <div className="demo-scoreboard"><span><b>Alabama</b><strong>24</strong></span><div><small>3RD</small><strong>7:42</strong><b>3rd & 7 · UGA 38</b></div><span><b>Georgia</b><strong>21</strong></span></div>
        <div className="demo-field"><i style={{left:"58%"}}>🏈</i><b style={{left:"58%"}}/><b className="first" style={{left:"72%"}}/></div>
        <div className="demo-drive"><strong>Current Drive</strong><p>3rd & 7 · UGA 38</p><span>Pass complete over the middle for 11 yards and a first down.</span></div>
      </>}
    </section></div>}
  </main>;
}
