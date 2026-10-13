"use client";

import { useEffect, useMemo, useState } from "react";

type Reading = {
  label: string;
  horizontal: number;
  vertical: number | null;
  threshold: number;
};
type AuditState = {
  state: "waiting" | "complete";
  checks: Reading[];
  hidden: number;
};

const CHECKS = [
  { selector: ".primary-nav button", child: ".nav-icon", label: "Bottom navigation icon", threshold: 1 },
  { selector: ".primary-nav button", child: ":scope > span:last-child", label: "Bottom navigation label", threshold: 1 },
  { selector: ".game-tracker-header button", child: "svg", label: "GameTracker close X", threshold: 0.7 },
  { selector: ".matchup-preview-close", child: "svg", label: "Matchup Preview close X", threshold: 0.7 },
  { selector: ".player-profile-close-wrap button", child: "svg", label: "Player profile close X", threshold: 0.7 },
  { selector: ".side-bet-slip-open", child: "svg", label: "Side Bet ticket action", threshold: 0.7 },
  { selector: ".side-bet-batch-remove", child: "svg", label: "Side Bet removal action", threshold: 0.7 },
  { selector: ".confidence-move button", child: "svg", label: "Confidence ordering arrows", threshold: 0.7 },
  { selector: ".settings-leading-icon", child: "svg", label: "Settings icon", threshold: 0.7 },
  { selector: ".matchup-preview-tabs button", child: ":scope > span", label: "Preview tab label", threshold: 1 },
  { selector: ".section-tabs button", child: ".section-tab-label", label: "Section tab label", threshold: 1 }
] as const;

function centerOf(rect: DOMRect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function takeReadings(): AuditState {
  const checks: Reading[] = [];
  let hidden = 0;
  for (const spec of CHECKS) {
    const elements = document.querySelectorAll<HTMLElement>(spec.selector);
    elements.forEach((element, index) => {
      const child = element.querySelector<HTMLElement>(spec.child);
      if (!child) { hidden++; return; }
      const outer = element.getBoundingClientRect();
      const inner = child.getBoundingClientRect();
      if (!outer.width || !outer.height || !inner.width || !inner.height) { hidden++; return; }
      const a = centerOf(outer), b = centerOf(inner);
      checks.push({
        label: `${spec.label} ${index + 1}`,
        horizontal: Number(Math.abs(a.x - b.x).toFixed(2)),
        vertical: spec.label === "Bottom navigation icon" || spec.label === "Bottom navigation label" ? null : Number(Math.abs(a.y - b.y).toFixed(2)),
        threshold: spec.threshold
      });
    });
  }
  return { state:"complete", checks, hidden };
}

/**
 * Preview-only, read-only geometry inspector. Hidden unless explicitly requested.
 * Visit /friends?alignmentAudit=1 on either design-preview branch.
 *
 * This inspects element boxes, not visual glyph contours. A zero delta confirms
 * CSS-box centering, not necessarily the optical center of the icon artwork.
 */
export default function DesignAlignmentAudit() {
  const [enabled, setEnabled] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [audit, setAudit] = useState<AuditState>({ state:"waiting", checks:[], hidden:0 });
  useEffect(() => {
    const visible = new URLSearchParams(window.location.search).get("alignmentAudit") === "1";
    setEnabled(visible);
    if (!visible) return;
    const measure = () => setAudit(takeReadings());
    measure();
    const id = window.setInterval(measure, 1100);
    return () => window.clearInterval(id);
  }, []);
  const failing = useMemo(()=>audit.checks.filter(check => check.horizontal > check.threshold || (check.vertical != null && check.vertical > check.threshold)),[audit]);
  if (!enabled) return null;
  return <aside aria-label="Design alignment audit" style={{
    position:"fixed",right:10,bottom:"calc(env(safe-area-inset-bottom) + 92px)",
    zIndex:10050,width:"min(320px, calc(100vw - 20px))",maxHeight:"min(48dvh, 460px)",
    overflow:"auto",padding:11,border:"1px solid #6bbdce",borderRadius:10,
    background:"#122631",color:"#f0fbff",font:"11px/1.4 Arial,sans-serif",
    boxShadow:"0 8px 25px rgba(0,0,0,.4)"
  }}>
    <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
      <strong style={{fontSize:12}}>ALIGNMENT AUDIT</strong>
      <button type="button" onClick={()=>setCollapsed(value=>!value)} style={{
        display:"grid",placeItems:"center",width:26,height:26,padding:0,
        border:"1px solid #73afc1",borderRadius:5,background:"#214251",color:"#fff",fontSize:16
      }} aria-label={collapsed?"Expand alignment audit":"Collapse alignment audit"}>{collapsed?"+":"−"}</button>
    </header>
    <div style={{color:failing.length?"#f5b4af":"#a0e8c4",marginTop:5,fontWeight:800}}>
      {audit.checks.length} measured · {failing.length} outside tolerance
    </div>
    {!collapsed && <>
      {failing.length ? failing.slice(0,20).map((check,i)=><div key={i} style={{paddingBlock:4,borderBottom:"1px solid #294451"}}>
        <strong>{check.label}</strong>
        <div>Horizontal: {check.horizontal}px · Vertical: {check.vertical==null?"n/a":`${check.vertical}px`}</div>
      </div>): <p style={{margin:"7px 0 0",color:"#b1cdd7"}}>Visible measured control boxes are centered within tolerance.</p>}
      <small style={{display:"block",marginTop:8,color:"#aabfc7",lineHeight:1.4}}>
        This checks element-box alignment, not the visual shape of SVG artwork.
        Open GameTracker, Matchup Preview, Settings or Side Bets to measure their controls.
      </small>
    </>}
  </aside>;
}
