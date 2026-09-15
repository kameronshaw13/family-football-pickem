"use client";

import { useEffect } from "react";
import type { AppSlug } from "@/lib/rulePresentation";

const FRIEND_DISPLAY_AMOUNTS = [40, 30, 20, 10] as const;
const FRIEND_REQUEST_AMOUNT_MAP: Record<string, number> = {
  "20": 40,
  "15": 30,
  "10": 20,
  "5": 10
};

function applyFriendsAmountLabels() {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".side-bet-amount-grid button"));
  if (buttons.length !== FRIEND_DISPLAY_AMOUNTS.length) return;
  buttons.forEach((button, index) => {
    const amount = FRIEND_DISPLAY_AMOUNTS[index];
    button.dataset.friendsAmount = String(amount);
    const token = button.querySelector<HTMLElement>(".numeric-token");
    if (token && token.textContent !== `$${amount}`) token.textContent = `$${amount}`;
  });
}

function patchedSideBetFetch(originalFetch: typeof window.fetch, appSlug: AppSlug) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    let isSingleCreate = false;
    let nextInit = init;

    try {
      const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : input.url;
      const url = new URL(rawUrl, window.location.origin);
      if (url.pathname === "/api/side-bets" && typeof init?.body === "string") {
        const body = JSON.parse(init.body) as { action?: string; amount?: number };
        isSingleCreate = body.action === "create";

        if (appSlug === "friends" && isSingleCreate) {
          const mapped = FRIEND_REQUEST_AMOUNT_MAP[String(body.amount)];
          if (mapped != null) {
            nextInit = { ...init, body: JSON.stringify({ ...body, amount: mapped }) };
          }
        }
      }
    } catch {
      // If a request is not JSON or is unrelated, leave it untouched.
    }

    const response = await originalFetch(input, nextInit);

    if (isSingleCreate && response.ok) {
      // Clear the native selection before createBet switches back to Offers.
      // SideBetBatchEnhancements listens to this same clear button, so one
      // click resets both React's selected game and its private batch array.
      document.querySelector<HTMLButtonElement>(".side-bet-slip-selection .side-bet-selection-clear")?.click();
    }

    return response;
  }) as typeof window.fetch;
}

export default function PickemUiCorrections({ appSlug }: { appSlug: AppSlug }) {
  useEffect(() => {
    let frame = 0;
    let applying = false;
    const originalFetch = window.fetch;
    const sideBetFetch = patchedSideBetFetch(originalFetch.bind(window), appSlug);
    window.fetch = sideBetFetch;

    // Remove any lock icons left behind by the previous correction layer.
    // PickemAppBase is the sole source of truth for lock indicators now and
    // renders them only for picks whose actual app state is locked.
    document.querySelectorAll(".ui-correction-lock-icon").forEach((icon) => icon.remove());

    const apply = () => {
      frame = 0;
      if (applying) return;
      applying = true;
      try {
        if (appSlug === "friends") applyFriendsAmountLabels();
      } finally {
        applying = false;
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(apply);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    schedule();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.querySelectorAll(".ui-correction-lock-icon").forEach((icon) => icon.remove());
      if (window.fetch === sideBetFetch) window.fetch = originalFetch;
    };
  }, [appSlug]);

  return null;
}
