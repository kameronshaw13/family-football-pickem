"use client";

import { useEffect } from "react";

const RESUME_GRACE_MS = 1600;
const TRANSIENT_LOAD_COPY = ["could not load app data", "could not load app"];

function isTransientLoadCard(element: HTMLElement) {
  const text = element.textContent?.replace(/\s+/g, " ").trim().toLowerCase() || "";
  return TRANSIENT_LOAD_COPY.some((copy) => text.includes(copy));
}

export default function ShawResumeErrorGuard() {
  useEffect(() => {
    let graceUntil = 0;
    let timer = 0;

    function restoreCards() {
      document.querySelectorAll<HTMLElement>(".error-card[data-shaw-resume-suppressed]").forEach((card) => {
        card.style.removeProperty("display");
        card.removeAttribute("data-shaw-resume-suppressed");
      });
    }

    function suppressTransientCards() {
      if (Date.now() >= graceUntil) return;
      document.querySelectorAll<HTMLElement>(".error-card").forEach((card) => {
        if (!isTransientLoadCard(card)) return;
        card.style.setProperty("display", "none", "important");
        card.dataset.shawResumeSuppressed = "true";
      });
    }

    function beginGrace() {
      graceUntil = Date.now() + RESUME_GRACE_MS;
      window.clearTimeout(timer);
      suppressTransientCards();
      timer = window.setTimeout(restoreCards, RESUME_GRACE_MS);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") beginGrace();
    }

    const observer = new MutationObserver(suppressTransientCards);
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    window.addEventListener("focus", beginGrace);
    window.addEventListener("online", beginGrace);
    window.addEventListener("pageshow", beginGrace);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("focus", beginGrace);
      window.removeEventListener("online", beginGrace);
      window.removeEventListener("pageshow", beginGrace);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      restoreCards();
    };
  }, []);

  return null;
}
