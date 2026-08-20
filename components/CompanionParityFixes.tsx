"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Send } from "lucide-react";
import NumericText from "@/components/NumericText";

type AppSlug = "other-family" | "friends";
type Payload = any;

const CACHE_PREFIX = "pickem_app_data_v1:";

function latestPayload(slug: AppSlug): Payload | null {
  try {
    let best: { cachedAt: number; payload: Payload } | null = null;
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      const parsed = JSON.parse(window.sessionStorage.getItem(key) || "null");
      if (parsed?.payload?.activeGroup?.slug !== slug) continue;
      if (!best || Number(parsed.cachedAt || 0) > best.cachedAt) best = parsed;
    }
    return best?.payload || null;
  } catch {
    return null;
  }
}

function normalizeUrl(value: string | null | undefined) {
  try {
    return new URL(value || "", window.location.origin).href;
  } catch {
    return value || "";
  }
}

function ensureHost(key: string, parent: Element, after: Element | null) {
  let host = parent.querySelector<HTMLElement>(`:scope > [data-companion-parity-host="${key}"]`);
  if (!host) {
    host = document.createElement("div");
    host.dataset.companionParityHost = key;
  }
  if (after?.parentElement === parent) after.insertAdjacentElement("afterend", host);
  else if (host.parentElement !== parent) parent.appendChild(host);
  return host;
}

function clearGroupCache(slug: AppSlug) {
  try {
    const remove: string[] = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      const parsed = JSON.parse(window.sessionStorage.getItem(key) || "null");
      if (parsed?.payload?.activeGroup?.slug === slug) remove.push(key);
    }
    remove.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // Cache is only an optimization.
  }
}

function RuleItem({ title, children }: { title: string; children: React.ReactNode }) {
  return <details className="rule-item">
    <summary><strong>{title}</strong><ChevronDown className="rule-chevron" size={17} /></summary>
    <div className="rule-copy">{children}</div>
  </details>;
}

function CalebFamilyRules() {
  return <div className="rules-list companion-parity-rules">
    <RuleItem title="Season Schedule"><ul>
      <li><NumericText text="The season runs for 20 weeks." /></li>
      <li><NumericText text="It begins with two CFB-only weeks before NFL games start and ends after the final NFL regular-season games." /></li>
      <li>Each week runs from Tuesday through the following Monday.</li>
    </ul></RuleItem>
    <RuleItem title="Weekly Card"><ul>
      <li><NumericText text="Every week: 5 regular spread picks plus 1 underdog." /></li>
      <li><NumericText text="Weeks 1–2: all 5 regular picks are CFB." /></li>
      <li><NumericText text="Weeks 3–20: at least 1 CFB and 1 NFL regular pick." /></li>
      <li>A game cannot be used as both a regular pick and the underdog pick.</li>
    </ul></RuleItem>
    <RuleItem title="Confidence Points"><ul>
      <li><NumericText text="Rank the 5 regular picks in My Card from 5 points (most confident) down to 1 point." /></li>
      <li>A winning spread pick earns its assigned confidence points.</li>
      <li>A loss or push earns 0 confidence points.</li>
      <li>Confidence order locks once a regular pick on the card locks.</li>
    </ul></RuleItem>
    <RuleItem title="Eligible Games"><ul>
      <li>Chargers games are ineligible.</li>
      <li>Each CFB game must include at least one FBS team.</li>
      <li>Conference title games, bowl games, and CFP games are eligible.</li>
      <li>NFL playoff games are not included.</li>
    </ul></RuleItem>
    <RuleItem title="Underdog"><ul>
      <li><NumericText text="+7 to +9.5: +1 point." /></li>
      <li><NumericText text="+10 to +19.5: +2 points." /></li>
      <li><NumericText text="+20 or more: +3 points." /></li>
      <li>The dog must win outright.</li>
      <li>A losing dog earns 0 points and does not subtract points.</li>
    </ul></RuleItem>
    <RuleItem title="Standings"><ul>
      <li>Season and weekly standings are ranked by total points.</li>
      <li>Point ties are broken by regular-pick wins, then losses, then pushes before an exact tie remains.</li>
      <li>The season prize is winner-take-all using the season amount Caleb enters.</li>
      <li>If first place remains tied, the tied winners split the season pot.</li>
    </ul></RuleItem>
    <RuleItem title="Weekly Bank"><ul>
      <li>The weekly prize is winner-take-all.</li>
      <li>Caleb enters the winner-take-all amount for each week in the Bank tab.</li>
      <li>If first place remains tied, the tied winners split that week's pot.</li>
      <li>The configured pot is split evenly across the non-winners as their contribution so the ledger stays balanced.</li>
    </ul></RuleItem>
    <RuleItem title="Pick Locks"><ul>
      <li><NumericText text="Tuesday–Friday lines freeze 1 hour before kickoff." /></li>
      <li>Tuesday–Friday picks lock at kickoff.</li>
      <li><NumericText text="Saturday–Monday lines freeze Friday at 7:00 PM CT." /></li>
      <li><NumericText text="Saturday–Monday picks lock Friday at 8:00 PM CT." /></li>
      <li>Other players' picks stay hidden until that game closes.</li>
    </ul></RuleItem>
    <RuleItem title="Side Bets"><ul>
      <li>Spread bets only.</li>
      <li>Enter any positive dollar amount manually.</li>
      <li>There is no fixed dollar cap and no weekly side-bet count limit.</li>
      <li><NumericText text="Offers open Tuesday at 8:00 AM CT with the new week." /></li>
      <li><NumericText text="Tuesday–Friday lines freeze 1 hour before kickoff." /></li>
      <li><NumericText text="Saturday–Monday lines freeze Friday at 7:00 PM CT." /></li>
      <li>Offers may be sent or accepted until kickoff.</li>
      <li>Settled bets post directly to the bank.</li>
    </ul></RuleItem>
  </div>;
}

function FriendsRules() {
  return <div className="rules-list companion-parity-rules">
    <RuleItem title="Season Schedule"><ul>
      <li><NumericText text="The season runs for 20 weeks." /></li>
      <li><NumericText text="It begins before the NFL season and ends after the final NFL regular-season games." /></li>
      <li>Each week runs from Tuesday through the following Monday.</li>
    </ul></RuleItem>
    <RuleItem title="Weekly Card"><ul>
      <li><NumericText text="Week 1: 3 regular picks plus 1 dog." /></li>
      <li><NumericText text="Week 2: 5 regular picks plus 1 dog." /></li>
      <li><NumericText text="Weeks 3–20: 5 regular picks plus 1 dog." /></li>
      <li>There is no required CFB/NFL mix. All regular picks may be college, all NFL, or any combination.</li>
      <li>A game cannot be used as both a regular pick and the underdog pick.</li>
    </ul></RuleItem>
    <RuleItem title="Eligible Games"><ul>
      <li>Chargers games are ineligible.</li>
      <li>Each CFB game must include at least one FBS team.</li>
      <li>Conference title games, bowl games, and CFP games are eligible.</li>
      <li>NFL playoff games are not included.</li>
    </ul></RuleItem>
    <RuleItem title="Underdog"><ul>
      <li><NumericText text="+7 to +9.5: +1 win." /></li>
      <li><NumericText text="+10 to +19.5: +2 wins." /></li>
      <li><NumericText text="+20 or more: +3 wins." /></li>
      <li>The dog must win outright.</li>
      <li>A losing dog does not add a loss.</li>
    </ul></RuleItem>
    <RuleItem title="Standings"><ul>
      <li>Season and weekly standings are ranked by win percentage.</li>
      <li>Win-percentage ties are broken by total wins.</li>
      <li><NumericText text="Season: 1st +$150, 2nd $0, 3rd -$50, 4th -$50, 5th -$50." /></li>
      <li>If finishing positions remain tied, the payouts for those occupied positions are averaged evenly across the tied players.</li>
    </ul></RuleItem>
    <RuleItem title="Weekly Bank"><ul>
      <li><NumericText text="Weekly: 1st +$20, 2nd $0, 3rd $0, 4th -$10, 5th -$10." /></li>
      <li>The normal standings tiebreak sequence is used first.</li>
      <li>If positions remain tied, the payouts for those occupied positions are averaged evenly across the tied players.</li>
    </ul></RuleItem>
    <RuleItem title="Perfect Week"><ul>
      <li><NumericText text="Does not apply in Week 1." /></li>
      <li>A perfect card doubles every weekly payment.</li>
    </ul></RuleItem>
    <RuleItem title="Pick Locks"><ul>
      <li><NumericText text="Tuesday–Friday lines freeze 1 hour before kickoff." /></li>
      <li>Tuesday–Friday picks lock at kickoff.</li>
      <li><NumericText text="Saturday–Monday lines freeze Friday at 7:00 PM CT." /></li>
      <li><NumericText text="Saturday–Monday picks lock Friday at 8:00 PM CT." /></li>
      <li>Other players' picks stay hidden until that game closes.</li>
    </ul></RuleItem>
    <RuleItem title="Side Bets"><ul>
      <li>Spread bets only.</li>
      <li>Enter any positive dollar amount manually.</li>
      <li>There is no fixed dollar cap and no weekly side-bet count limit.</li>
      <li><NumericText text="Offers open Tuesday at 8:00 AM CT with the new week." /></li>
      <li><NumericText text="Tuesday–Friday lines freeze 1 hour before kickoff." /></li>
      <li><NumericText text="Saturday–Monday lines freeze Friday at 7:00 PM CT." /></li>
      <li>Offers may be sent or accepted until kickoff.</li>
      <li>Settled bets post directly to the bank.</li>
    </ul></RuleItem>
  </div>;
}

function ManualAmountEntry({ value, onChange, slug }: { value: string; onChange: (value: string) => void; slug: AppSlug }) {
  return <div className="parity-side-bet-amount">
    <div className="parity-side-bet-input">
      <span>$</span>
      <input
        id={`parity-side-bet-amount-${slug}`}
        aria-label="Side bet amount"
        inputMode="decimal"
        type="number"
        min="0.01"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  </div>;
}

function ManualSubmit({ saving, message, onSend }: { saving: boolean; message: string; onSend: () => void }) {
  return <div className="parity-side-bet-submit-wrap">
    {message && <small className="parity-side-bet-error">{message}</small>}
    <button className="btn accent side-bet-slip-submit parity-side-bet-submit" type="button" disabled={saving} onClick={onSend}>
      <Send size={15} /> {saving ? "Sending…" : "Send offer"}
    </button>
  </div>;
}

export default function CompanionParityFixes({ slug }: { slug: AppSlug }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [sheet, setSheet] = useState<HTMLElement | null>(null);
  const [amountHost, setAmountHost] = useState<HTMLElement | null>(null);
  const [submitHost, setSubmitHost] = useState<HTMLElement | null>(null);
  const [rulesHost, setRulesHost] = useState<HTMLElement | null>(null);
  const [amount, setAmount] = useState("20");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const apply = useCallback(() => {
    const currentPayload = latestPayload(slug);
    if (currentPayload) setPayload(currentPayload);

    const rulesPanel = document.querySelector<HTMLElement>(".rules-panel");
    if (rulesPanel) {
      const oldRules = rulesPanel.querySelector<HTMLElement>('[data-companion-host="rules"]');
      if (oldRules) oldRules.style.display = "none";
      const notification = rulesPanel.querySelector<HTMLElement>(".notification-settings");
      const title = rulesPanel.querySelector<HTMLElement>(".section-title");
      setRulesHost(ensureHost("rules", rulesPanel, notification || title));
    } else {
      setRulesHost(null);
    }

    const currentSheet = document.querySelector<HTMLElement>(".side-bet-slip-sheet");
    if (!currentSheet) {
      setSheet(null);
      setAmountHost(null);
      setSubmitHost(null);
      return;
    }

    const amountSection = Array.from(currentSheet.querySelectorAll<HTMLElement>(".side-bet-slip-section"))
      .find((node) => node.querySelector(".side-bet-slip-section-head")?.textContent?.trim() === "Amount") || null;
    const amountHead = amountSection?.querySelector<HTMLElement>(".side-bet-slip-section-head") || null;
    const oldManual = amountSection?.querySelector<HTMLElement>('[data-companion-host="manual-side-bet"]') || null;
    if (oldManual) oldManual.style.display = "none";
    const presetGrid = amountSection?.querySelector<HTMLElement>(".side-bet-amount-grid") || null;
    if (presetGrid) presetGrid.style.display = "none";
    const baseSubmit = currentSheet.querySelector<HTMLButtonElement>(".side-bet-slip-submit:not(.parity-side-bet-submit)");
    if (baseSubmit) baseSubmit.style.display = "none";

    if (!amountSection) return;
    const summary = currentSheet.querySelector<HTMLElement>(".side-bet-slip-summary");
    setSheet(currentSheet);
    setAmountHost(ensureHost("amount", amountSection, amountHead));
    setSubmitHost(ensureHost("submit", currentSheet, summary));
  }, [slug]);

  useEffect(() => {
    let active = true;
    const timers = new Set<number>();
    const schedule = (delay: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (active) apply();
      }, delay);
      timers.add(timer);
    };
    const burst = () => [0, 70, 180, 420, 850, 1400].forEach(schedule);
    burst();
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(".primary-nav button, .section-tabs button, .side-bet-slip-bar, .team-row.selectable, .side-bet-selection-clear, .custom-select-option")) return;
      burst();
    };
    const onFocus = () => burst();
    document.addEventListener("click", onClick, true);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("focus", onFocus);
    };
  }, [apply]);

  async function sendOffer() {
    if (!sheet || !payload) return;
    const stake = Number(amount);
    if (!Number.isFinite(stake) || stake <= 0) {
      setMessage("Enter an amount greater than $0.");
      return;
    }

    const selectedImg = sheet.querySelector<HTMLImageElement>(".side-bet-slip-selection img");
    const selectedSrc = normalizeUrl(selectedImg?.src);
    const game = (payload.games || []).find((item: any) => [item.home_logo_url, item.away_logo_url].some((url: string) => normalizeUrl(url) === selectedSrc));
    if (!game) {
      setMessage("Could not identify the selected game. Close the slip and choose the team again.");
      return;
    }

    const creatorTeam = normalizeUrl(game.home_logo_url) === selectedSrc ? game.home_team : game.away_team;
    const recipientIds = Array.from(sheet.querySelectorAll<HTMLLabelElement>(".side-bet-recipient-grid label"))
      .filter((label) => label.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked)
      .flatMap((label) => {
        const name = label.querySelector("span")?.textContent?.trim().toLowerCase();
        const profile = (payload.profiles || []).find((item: any) => item.display_name?.trim().toLowerCase() === name);
        return profile ? [profile.id] : [];
      });
    if (!recipientIds.length) {
      setMessage("Choose at least one person to send the bet to.");
      return;
    }

    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/side-bets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "create", gameId: game.id, creatorTeam, amount: stake, recipientIds, viewWeek: payload.week })
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "Could not send the side bet.");
        return;
      }
      clearGroupCache(slug);
      window.location.reload();
    } catch {
      setMessage("Could not send the side bet.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    {rulesHost && createPortal(slug === "other-family" ? <CalebFamilyRules /> : <FriendsRules />, rulesHost)}
    {amountHost && createPortal(<ManualAmountEntry value={amount} onChange={setAmount} slug={slug} />, amountHost)}
    {submitHost && createPortal(<ManualSubmit saving={saving} message={message} onSend={() => void sendOffer()} />, submitHost)}
  </>;
}
