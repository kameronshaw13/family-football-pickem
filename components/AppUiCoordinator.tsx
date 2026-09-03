"use client";

import { useEffect } from "react";

function makeSeasonNamesInteractive() {
  const heading = Array.from(document.querySelectorAll<HTMLElement>(".standings-panel .scoreboard-heading h2"))
    .find((node) => node.textContent?.trim() === "Season Standings");
  const leaderboard = heading?.closest(".scoreboard-heading")?.nextElementSibling;
  if (!(leaderboard instanceof HTMLElement) || !leaderboard.classList.contains("leaderboard")) return;

  leaderboard.querySelectorAll<HTMLElement>(".leaderboard-player strong").forEach((name) => {
    name.classList.add("player-profile-link");
    name.dataset.playerProfileName = name.textContent?.trim() || "";
    name.setAttribute("role", "button");
    name.setAttribute("tabindex", "0");
    name.setAttribute("aria-label", `Open ${name.dataset.playerProfileName || "player"} profile`);
  });
}

function bankPanelIsActive() {
  const activeTab = document.querySelector<HTMLElement>(".standings-panel .section-tabs button.active");
  return activeTab?.textContent?.replace(/\s+/g, " ").trim().startsWith("Bank") || false;
}

function clearLegacyFontTranslations() {
  document.querySelectorAll<HTMLElement>(
    "[data-slab-optical-centered], [data-stable-font-wrapper-centered], [data-slab-optical-centered-block]"
  ).forEach((element) => {
    element.style.removeProperty("translate");
    element.removeAttribute("data-slab-optical-centered");
    element.removeAttribute("data-stable-font-wrapper-centered");
    element.removeAttribute("data-slab-optical-centered-block");
  });
  document.querySelectorAll<HTMLElement>("[data-slab-optical-probe]").forEach((probe) => probe.remove());
}

export default function AppUiCoordinator() {
  useEffect(() => {
    let frame = 0;
    let bankWasActive = false;

    const run = () => {
      frame = 0;
      clearLegacyFontTranslations();
      makeSeasonNamesInteractive();
      const bankActive = bankPanelIsActive();
      if (bankActive && !bankWasActive) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      bankWasActive = bankActive;
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(run);
    };

    const onKey = (event: KeyboardEvent) => {
      if (!["Enter", " "].includes(event.key)) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.classList.contains("player-profile-link")) target.click();
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", onKey);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("keydown", onKey);
      clearLegacyFontTranslations();
    };
  }, []);

  return null;
}
