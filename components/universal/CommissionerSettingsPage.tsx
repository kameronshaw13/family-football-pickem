"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect,useState } from "react";
import { ArrowLeft,Check,Copy } from "lucide-react";
import { getUniversalSupabase } from "@/lib/universalAuthClient";

export default function CommissionerSettingsPage({slug}:{slug:string}){
  const supabase=getUniversalSupabase();
  const [data,setData]=useState<any>(null);
  const [name,setName]=useState("");
  const [code,setCode]=useState("");
  const [message,setMessage]=useState("");
  const [working,setWorking]=useState(false);

  async function token(){return (await supabase.auth.getSession()).data.session?.access_token||"";}
  useEffect(()=>{(async()=>{
    const access=await token();if(!access){window.location.replace("/");return;}
    const response=await fetch("/api/universal/league-settings?slug="+encodeURIComponent(slug),{headers:{Authorization:"Bearer "+access}});
    const payload=await response.json();
    if(!response.ok){setMessage(payload.error||"Could not load settings.");return;}
    setData(payload);setName(payload.group?.name||"");setCode(payload.inviteCode||"");
  })();},[slug]);

  async function save(){
    const access=await token();if(!access)return;setWorking(true);setMessage("");
    const response=await fetch("/api/universal/league-settings",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer "+access},body:JSON.stringify({slug,leagueName:name,inviteCode:code})});
    const payload=await response.json();setWorking(false);
    if(!response.ok){setMessage(payload.error||"Could not save settings.");return;}
    setName(payload.leagueName);setCode(payload.inviteCode);setMessage("League settings updated.");
  }
  const rules=data?.rules||{};
  const format=rules.productMode==="pickem"?"Pick'em":rules.productMode==="sidebets"?"Side Bets Only":"Pick'em + Side Bets";
  const football=rules.footballSlate==="BOTH"?"College + NFL":rules.footballSlate||"College + NFL";
  const scoring=rules.scoring?.mode==="confidence"?"Confidence Points":rules.scoring?.ranking==="total-wins"?"Total Wins":"Winning Percentage";

  return <div className="app-shell universal-settings-shell">
    <header className="scoreboard-header"><div className="scoreboard-main"><div className="brand-lockup"><Image className="header-wordmark" src="/football-pickem-wordmark.png" alt="Football Pick'em" width={800} height={100} priority/></div><div className="test-week-chip">SETTINGS</div></div></header>
    <main className="container universal-settings-container">
      <Link href={"/league/"+slug} className="universal-settings-back"><ArrowLeft size={15}/>Back to League</Link>
      <section className="panel universal-settings-panel">
        <div className="section-title"><div><h2>League Settings</h2><p>Commissioner controls for your league.</p></div></div>
        <label className="universal-input simple"><span>League name</span><input value={name} onChange={e=>setName(e.target.value)} /></label>
        <label className="universal-input simple"><span>Invite code</span><input value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,20))} /></label>
        <button className="btn full universal-copy-button" onClick={()=>navigator.clipboard?.writeText(window.location.origin+"/join/"+code)}><Copy size={15}/>Copy Invite Link</button>
        <div className="universal-settings-summary">
          <div><span>Players</span><strong>{data?.memberCount??"—"}{data?.playerLimit?"/"+data.playerLimit:""}</strong></div>
          <div><span>Format</span><strong>{format}</strong></div>
          <div><span>Football</span><strong>{football}</strong></div>
          <div><span>Scoring</span><strong>{scoring}</strong></div>
        </div>
        <p className="universal-settings-note">Full rule editing will live here as the commissioner controls expand. The current league rules remain active until you change them.</p>
        {message&&<div className="notice-card">{message}</div>}
        <button className="btn gold full" disabled={working||name.trim().length<2||code.length<4} onClick={save}>{working?"Saving…":<><Check size={16}/>Save Settings</>}</button>
      </section>
    </main>
  </div>;
}
