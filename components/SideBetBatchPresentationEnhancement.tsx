"use client";

import { useEffect } from "react";

function spreadOnly(value: string) {
  return value.split("·")[0]?.trim() || value.trim();
}

export default function SideBetBatchPresentationEnhancement() {
  useEffect(() => {
    let frame = 0;
    let applying = false;

    function applyPresentation() {
      document.querySelectorAll<HTMLElement>(".side-bet-batch-row").forEach((row) => {
        if (!row.classList.contains("side-bet-batch-native-row")) {
          row.classList.add("team-row", "side-bet-slip-selection", "side-bet-batch-native-row");
        }

        const copy = row.querySelector<HTMLElement>(".side-bet-batch-copy, .side-bet-batch-native-choice");
        if (!copy) return;
        if (!copy.classList.contains("side-bet-batch-native-choice")) {
          copy.className = "side-bet-slip-team-choice side-bet-batch-native-choice";
        }

        const team = copy.querySelector<HTMLElement>("strong, .team-name");
        if (team && !team.classList.contains("team-name")) team.classList.add("team-name");

        const market = copy.querySelector<HTMLElement>("span, .team-spread");
        if (market) {
          const nextText = spreadOnly(market.textContent || "");
          if (market.textContent !== nextText) market.textContent = nextText;
          if (!market.classList.contains("team-spread")) market.classList.add("team-spread");
        }
      });

      document.querySelectorAll<HTMLElement>(".side-bet-slip-bar[data-batch-count]").forEach((bar) => {
        const total = Number(bar.dataset.batchCount || 0);
        const more = total > 1 ? String(total - 1) : "";
        if (more) {
          if (bar.dataset.batchMore !== more) bar.dataset.batchMore = more;
        } else {
          delete bar.dataset.batchMore;
        }
      });
    }

    function schedule() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (applying) return;
        applying = true;
        try {
          applyPresentation();
        } finally {
          applying = false;
        }
      });
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-batch-count"] });
    schedule();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return null;
}
