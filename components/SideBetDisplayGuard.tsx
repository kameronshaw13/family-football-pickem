"use client";

import { useEffect } from "react";

type Target = { recipient_id?: string; response?: string; recipient?: { display_name?: string } };
type Bet = {
  id: string;
  creator_id: string;
  status: string;
  created_at: string;
  accepted_by_profile?: { display_name?: string } | null;
  targets?: Target[];
};
type AppData = { currentUser?: { id?: string }; sideBets?: Bet[] };

function groupSlug() {
  const path = window.location.pathname;
  if (path === "/friends" || path.startsWith("/friends/")) return "friends";
  if (path === "/caleb-family" || path.startsWith("/caleb-family/")) return "other-family";
  return "shaw-family";
}

function responseActor(bet: Bet) {
  if (bet.accepted_by_profile?.display_name) return bet.accepted_by_profile.display_name;
  const responded = bet.targets?.find((target) => target.response === "declined" || target.response === "accepted");
  if (responded?.recipient?.display_name) return responded.recipient.display_name;
  const recipients = (bet.targets || []).map((target) => target.recipient?.display_name).filter(Boolean) as string[];
  return recipients.join(" or ") || "Recipient";
}

export default function SideBetDisplayGuard() {
  useEffect(() => {
    let cancelled = false;
    let busy = false;

    async function correctSentActors() {
      if (cancelled || busy) return;
      const cards = Array.from(document.querySelectorAll<HTMLElement>(".side-bet-card.mode-sent"));
      const needsFix = cards.some((card) => {
        const first = card.querySelector(".side-bet-offer-copy p")?.firstChild;
        return first?.nodeType === Node.TEXT_NODE && /^\s*You\b/i.test(first.textContent || "");
      });
      if (!needsFix) return;
      const token = window.localStorage.getItem("pickem_session_token");
      if (!token) return;
      busy = true;
      try {
        const response = await fetch("/api/app-data", {
          headers: { Authorization: `Bearer ${token}`, "x-pickem-group": groupSlug() },
          cache: "no-store"
        });
        if (!response.ok) return;
        const payload = await response.json() as AppData;
        const userId = payload.currentUser?.id;
        if (!userId) return;
        const sent = (payload.sideBets || [])
          .filter((bet) => bet.creator_id === userId)
          .sort((a, b) => Number(b.status === "open") - Number(a.status === "open") || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        cards.forEach((card, index) => {
          const bet = sent[index];
          if (!bet) return;
          const first = card.querySelector(".side-bet-offer-copy p")?.firstChild;
          if (first?.nodeType !== Node.TEXT_NODE || !/^\s*You\b/i.test(first.textContent || "")) return;
          first.textContent = (first.textContent || "").replace(/^\s*You\b/i, responseActor(bet));
        });
      } catch {
        // The normal render remains usable; the next DOM update retries.
      } finally {
        busy = false;
      }
    }

    const observer = new MutationObserver(() => void correctSentActors());
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    void correctSentActors();
    const timer = window.setInterval(() => void correctSentActors(), 3000);
    return () => { cancelled = true; observer.disconnect(); window.clearInterval(timer); };
  }, []);

  return null;
}
