"use client";

import { useEffect } from "react";

const SELF_ACTIONS = new Set(["accepted", "declined", "cancelled"]);

function currentDisplayName() {
  try {
    const profile = JSON.parse(window.localStorage.getItem("pickem_profile") || "null") as { display_name?: string | null } | null;
    return profile?.display_name?.trim() || "";
  } catch {
    return "";
  }
}

function applySelfLabels() {
  const displayName = currentDisplayName();
  if (!displayName) return;

  document.querySelectorAll<HTMLElement>(".side-bet-card .side-bet-offer-copy p .side-bet-response").forEach((status) => {
    const action = status.textContent?.trim().toLowerCase() || "";
    if (!SELF_ACTIONS.has(action)) return;

    const previous = status.previousSibling;
    if (!previous || previous.nodeType !== Node.TEXT_NODE) return;
    const text = previous.textContent || "";
    if (text.trim() !== displayName) return;

    previous.textContent = text.replace(displayName, "You");
  });
}

export default function SideBetSelfLabels() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(applySelfLabels);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    schedule();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return null;
}
