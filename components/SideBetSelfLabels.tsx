"use client";

import { useEffect } from "react";

type SideBetRow = {
  id: string;
  creator_id: string;
  status: string;
  created_at: string;
  accepted_by?: string | null;
  creator?: { display_name?: string | null } | null;
  accepted_by_profile?: { display_name?: string | null } | null;
  targets?: Array<{
    recipient_id: string;
    response: string;
    recipient?: { display_name?: string | null } | null;
  }> | null;
};

type AppDataPayload = {
  currentUser?: { id: string; display_name?: string | null };
  sideBets?: SideBetRow[];
};

function actorForAction(bet: SideBetRow, action: string) {
  if (action === "accepted" && bet.accepted_by) {
    return { id: bet.accepted_by, name: bet.accepted_by_profile?.display_name?.trim() || "" };
  }

  if (action === "declined") {
    const target = bet.targets?.find((row) => row.response === "declined");
    return target ? { id: target.recipient_id, name: target.recipient?.display_name?.trim() || "" } : null;
  }

  if (action === "cancelled" || action === "canceled") {
    return { id: bet.creator_id, name: bet.creator?.display_name?.trim() || "" };
  }

  return null;
}

function replaceActorLabel(status: HTMLElement, label: string) {
  const parent = status.parentElement;
  if (!parent) return;
  const nodes = Array.from(parent.childNodes);
  const statusIndex = nodes.indexOf(status);
  if (statusIndex < 0) return;

  for (let index = statusIndex - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if (node.nodeType !== Node.TEXT_NODE) continue;
    if (!(node.textContent || "").trim()) continue;
    node.textContent = `${label} `;
    return;
  }
}

function sortedBets(payload: AppDataPayload, mode: "received" | "sent") {
  const currentUserId = payload.currentUser?.id;
  if (!currentUserId) return [];
  const rows = (payload.sideBets || []).filter((bet) => mode === "sent"
    ? bet.creator_id === currentUserId
    : bet.creator_id !== currentUserId && bet.targets?.some((target) => target.recipient_id === currentUserId));

  return [...rows].sort((a, b) => Number(b.status === "open") - Number(a.status === "open") || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function applySelfLabels(payload: AppDataPayload | null) {
  const currentUserId = payload?.currentUser?.id;
  if (!payload || !currentUserId) return;

  for (const mode of ["received", "sent"] as const) {
    const bets = sortedBets(payload, mode);
    const cards = Array.from(document.querySelectorAll<HTMLElement>(`.side-bet-card.mode-${mode}:not(.test-incoming-side-bet):not(.optimistic-side-bet)`));

    cards.forEach((card, index) => {
      const bet = bets[index];
      const status = card.querySelector<HTMLElement>(".side-bet-offer-copy p .side-bet-response");
      if (!bet || !status) return;
      const action = status.textContent?.trim().toLowerCase() || "";
      const actor = actorForAction(bet, action);
      if (!actor) return;
      replaceActorLabel(status, actor.id === currentUserId ? "You" : actor.name);
    });
  }
}

async function loadPayload() {
  const token = window.localStorage.getItem("pickem_session_token");
  if (!token) return null;
  try {
    const response = await fetch("/api/app-data", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    return response.ok ? await response.json() as AppDataPayload : null;
  } catch {
    return null;
  }
}

export default function SideBetSelfLabels() {
  useEffect(() => {
    let active = true;
    let frame = 0;
    let payload: AppDataPayload | null = null;
    let loading = false;
    let lastLoaded = 0;

    async function refresh(force = false) {
      if (!active || loading) return;
      if (!force && payload && Date.now() - lastLoaded < 2000) {
        applySelfLabels(payload);
        return;
      }

      loading = true;
      try {
        const next = await loadPayload();
        if (next && active) {
          payload = next;
          lastLoaded = Date.now();
          applySelfLabels(payload);
        }
      } finally {
        loading = false;
      }
    }

    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => void refresh());
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });

    const refreshAfterAction = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(".side-bet-card .actions button")) return;
      window.setTimeout(() => void refresh(true), 350);
      window.setTimeout(() => void refresh(true), 1100);
    };

    const onFocus = () => void refresh(true);
    document.addEventListener("click", refreshAfterAction, true);
    window.addEventListener("focus", onFocus);
    void refresh(true);

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("click", refreshAfterAction, true);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return null;
}
