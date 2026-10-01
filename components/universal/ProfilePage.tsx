"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect,useState } from "react";
import { ArrowLeft,Check,LogOut } from "lucide-react";
import { getUniversalSupabase } from "@/lib/universalAuthClient";
import { clearClientSession } from "@/lib/clientSession";

export default function ProfilePage(){
  const supabase=getUniversalSupabase();
  const [profile,setProfile]=useState<any>(null);
  const [name,setName]=useState("");
  const [message,setMessage]=useState("");
  const [working,setWorking]=useState(false);

  useEffect(()=>{(async()=>{
    const session=(await supabase.auth.getSession()).data.session;
    if(!session?.access_token){window.location.replace("/");return;}
    const response=await fetch("/api/universal/bootstrap",{method:"POST",headers:{Authorization:"Bearer "+session.access_token}});
    const payload=await response.json();
    if(!response.ok){setMessage(payload.error||"Could not load profile.");return;}
    setProfile(payload.profile);setName(payload.profile?.display_name||"");
  })();},[supabase]);

  async function save(){
    const session=(await supabase.auth.getSession()).data.session;if(!session?.access_token)return;
    setWorking(true);setMessage("");
    const response=await fetch("/api/universal/profile",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({displayName:name})});
    const payload=await response.json();setWorking(false);
    if(!response.ok){setMessage(payload.error||"Could not save profile.");return;}
    setProfile(payload.profile);setMessage("Profile updated.");
  }
  async function signOut(){await supabase.auth.signOut();clearClientSession();window.location.replace("/");}

  return <div className="app-shell universal-settings-shell">
    <header className="scoreboard-header"><div className="scoreboard-main"><div className="brand-lockup"><Image className="header-wordmark" src="/football-pickem-wordmark.png" alt="Football Pick'em" width={800} height={100} priority/></div><div className="test-week-chip">PROFILE</div></div></header>
    <main className="container universal-settings-container">
      <Link href="/" className="universal-settings-back"><ArrowLeft size={15}/>My Leagues</Link>
      <section className="panel universal-settings-panel">
        <div className="section-title"><div><h2>Profile</h2><p>Your account details follow you across every league.</p></div></div>
        <label className="universal-input simple"><span>Display name</span><input value={name} onChange={e=>setName(e.target.value)} /></label>
        <label className="universal-input simple"><span>Email</span><input value={profile?.email||""} disabled /></label>
        {message&&<div className="notice-card">{message}</div>}
        <button className="btn gold full" disabled={working||!name.trim()} onClick={save}>{working?"Saving…":<><Check size={16}/>Save Profile</>}</button>
        <button className="btn full universal-signout-button" onClick={signOut}><LogOut size={16}/>Sign Out</button>
      </section>
    </main>
  </div>;
}
