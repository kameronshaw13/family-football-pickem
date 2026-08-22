"use client";

import { useEffect } from "react";

export default function SideBetSurfaceWake() {
  useEffect(() => {
    let hadLedger = Boolean(document.querySelector(".ledger-list"));
    let hadCenter = Boolean(document.querySelector(".side-bet-center"));
    let frame = 0;

    function wake() {
      window.dispatchEvent(new Event("focus"));
    }

    const observer = new MutationObserver(() => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const hasLedger = Boolean(document.querySelector(".ledger-list"));
        const hasCenter = Boolean(document.querySelector(".side-bet-center"));
        if ((hasLedger && !hadLedger) || (hasCenter && !hadCenter)) wake();
        hadLedger = hasLedger;
        hadCenter = hasCenter;
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
