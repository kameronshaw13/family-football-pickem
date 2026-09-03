"use client";

import { useEffect } from "react";

type FontGeometry = { baseline: number; lineHeight: number };

const OPTICAL_PRECISION = 4096;
const FALLBACK_METRIC_TEXT = "Hg";

const OPTICALLY_CENTERED_TEXT_SELECTOR = [
  ".section-tab-label",
  ".heading-with-badge",
  ".primary-nav button > span:last-child",
  ".test-week-chip",
  ".custom-select-label",
  ".custom-select-option",
  ".custom-select-group-label",
  ".game-day-marker > b",
  ".game-day-marker > strong",
  ".responsive-text-value",
  ".game-time",
  ".game-final-status",
  ".game-live-status",
  ".game-live-situation",
  ".team-name",
  ".team-spread",
  ".team-board-market",
  ".team-result-score",
  ".pick-section h3",
  ".group-card h3",
  ".card-panel .pick-section > h3",
  ".card-panel .group-card > h3",
  ".group-empty-picks",
  ".card-empty-picks",
  ".pick-title-team",
  ".pick-title-market",
  ".pick-meta",
  ".visible-pick-copy strong",
  ".visible-pick-copy p",
  ".badge:not(.notification-badge)",
  ".test-result",
  ".score-bug-score",
  ".side-bet-list-section > h3",
  ".side-bet-list-empty",
  ".side-bet-offer-copy > strong",
  ".side-bet-offer-copy > p",
  ".side-bet-response-value",
  ".side-bet-offer-amount",
  ".leaderboard-labels > span",
  ".leaderboard-rank",
  ".leaderboard-player strong",
  ".leaderboard-stat",
  ".leaderboard-pct",
  ".leaderboard-points",
  ".standings-heading-row h2",
  ".test-standings-label",
  ".bank-summary-head > span",
  ".money-card > span",
  ".money-card > strong",
  ".bank-results-labels > span",
  ".bank-result-player",
  ".bank-result-record",
  ".bank-result-amount",
  ".bank-game-result > div > strong",
  ".bank-game-result > div > p",
  ".ledger-row strong",
  ".ledger-row p",
  ".side-bet-ledger-title",
  ".side-bet-ledger-amount",
  ".confidence-order-head strong",
  ".confidence-order-head > span",
  ".confidence-order-row > strong",
  ".confidence-value",
  ".group-money-controls-head strong",
  ".group-money-controls-head small",
  ".side-bet-slip-title h2",
  ".side-bet-slip-title p",
  ".side-bet-slip-team-choice .team-name",
  ".side-bet-slip-team-choice .team-spread",
  ".side-bet-slip-section-head > span",
  ".side-bet-amount-grid button > .numeric-token",
  ".side-bet-recipient-grid label > span",
  ".side-bet-recipient-grid label > small",
  ".side-bet-slip-summary > div > span",
  ".side-bet-slip-summary strong",
  ".confirmation-heading h2",
  ".confirmation-amount-row > span",
  ".confirmation-amount-row > strong",
  ".confirmation-matchup > div > span",
  ".confirmation-matchup > div > strong",
  ".confirmation-kickoff > .numeric-token",
  ".scoreboard-heading h2",
  ".player-profile-head-copy > span",
  ".player-profile-head h2",
  ".player-profile-section-heading h3",
  ".player-profile-record-mark strong",
  ".player-profile-win-mark strong",
  ".player-profile-legacy-row span",
  ".player-profile-legacy-row > strong",
  ".player-profile-highlight-stack span",
  ".player-profile-highlight-stack strong",
  ".player-profile-highlight-stack small",
  ".player-profile-side-bet-metrics span",
  ".player-profile-side-bet-metrics strong",
  ".rule-item summary strong",
  ".notification-settings-heading"
].join(", ");

const OPTICALLY_CENTERED_TWO_LINE_BLOCKS = [
  {
    block: ".pick-copy",
    row: ".pick-card",
    top: [".pick-title-team .responsive-text-value", ".pick-title-team"],
    bottom: [".pick-meta .responsive-text-value", ".pick-meta"]
  },
  {
    block: ".visible-pick-copy",
    row: ".visible-pick",
    top: [".pick-title-team .responsive-text-value", ".pick-title-team", ":scope > strong"],
    bottom: [":scope > p .responsive-text-value", ":scope > p"]
  },
  {
    block: ".side-bet-offer-copy",
    row: ".side-bet-offer-row",
    top: [":scope > strong .responsive-text-value", ":scope > strong"],
    bottom: [":scope > .side-bet-response-line .side-bet-response-value", ":scope > p"]
  },
  {
    block: ".side-bet-ledger-copy",
    row: ".side-bet-ledger-row",
    top: [".side-bet-ledger-title .responsive-text-value", ".side-bet-ledger-title"],
    bottom: [":scope > p"]
  },
  {
    block: ".bank-game-result > div",
    row: ".bank-game-result",
    top: [".bank-game-pick-title .responsive-text-value", ".bank-game-pick-title"],
    bottom: [":scope > p .responsive-text-value", ":scope > p"]
  }
] as const;

function precise(value: number) {
  return Math.round(value * OPTICAL_PRECISION) / OPTICAL_PRECISION;
}

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

function fontKey(style: CSSStyleDeclaration) {
  return [
    style.fontFamily,
    style.fontSize,
    style.fontStyle,
    style.fontWeight,
    style.lineHeight,
    style.letterSpacing
  ].join("|");
}

function canvasFont(style: CSSStyleDeclaration) {
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

function splitMetaText(text: string) {
  const divider = " · ";
  const index = text.indexOf(divider);
  return index < 0
    ? { matchup: text.trim(), suffix: "" }
    : { matchup: text.slice(0, index).trim(), suffix: text.slice(index) };
}

function splitMatchup(text: string) {
  const marker = " at ";
  const index = text.indexOf(marker);
  return index < 0 ? null : { away: text.slice(0, index).trim(), home: text.slice(index + marker.length).trim() };
}

export default function AppUiCoordinator() {
  useEffect(() => {
    let active = true;
    let frame = 0;
    let bankWasActive = false;
    const fontGeometryCache = new Map<string, FontGeometry>();
    const shiftCache = new Map<string, number>();
    const visibleGlyphMetricCache = new Map<string, { ascent: number; descent: number }>();
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    const probe = document.createElement("span");
    const probeText = document.createTextNode(FALLBACK_METRIC_TEXT);
    const baselineMarker = document.createElement("i");
    probe.dataset.slabOpticalProbe = "true";
    probe.style.position = "fixed";
    probe.style.left = "-10000px";
    probe.style.top = "-10000px";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    probe.style.whiteSpace = "nowrap";
    probe.style.padding = "0";
    probe.style.margin = "0";
    probe.style.border = "0";
    baselineMarker.style.display = "inline-block";
    baselineMarker.style.width = "0";
    baselineMarker.style.height = "0";
    baselineMarker.style.padding = "0";
    baselineMarker.style.margin = "0";
    baselineMarker.style.border = "0";
    baselineMarker.style.verticalAlign = "baseline";
    probe.append(probeText, baselineMarker);
    document.body.appendChild(probe);

    function geometryFor(style: CSSStyleDeclaration) {
      const key = fontKey(style);
      const cached = fontGeometryCache.get(key);
      if (cached) return cached;

      probe.style.fontFamily = style.fontFamily;
      probe.style.fontSize = style.fontSize;
      probe.style.fontStyle = style.fontStyle;
      probe.style.fontWeight = style.fontWeight;
      probe.style.lineHeight = style.lineHeight;
      probe.style.letterSpacing = style.letterSpacing;
      const rect = probe.getBoundingClientRect();
      const markerRect = baselineMarker.getBoundingClientRect();
      const geometry = {
        baseline: markerRect.top - rect.top,
        lineHeight: rect.height
      };
      fontGeometryCache.set(key, geometry);
      return geometry;
    }

    function stableShift(element: HTMLElement) {
      if (!context || !element.isConnected || element.getClientRects().length === 0) return null;
      if (element.closest(".responsive-text-measure, .side-bet-response-measure")) return null;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return null;
      if (!element.textContent?.replace(/\s+/g, " ").trim()) return null;

      const key = fontKey(style);
      const cached = shiftCache.get(key);
      if (cached !== undefined) return cached;
      const geometry = geometryFor(style);

      context.font = canvasFont(style);
      context.textBaseline = "alphabetic";
      const metrics = context.measureText(FALLBACK_METRIC_TEXT);
      const fontAscent = Number(metrics.fontBoundingBoxAscent || 0);
      const fontDescent = Number(metrics.fontBoundingBoxDescent || 0);
      const ascent = fontAscent > 0 ? fontAscent : Number(metrics.actualBoundingBoxAscent || 0);
      const descent = fontDescent > 0 ? fontDescent : Number(metrics.actualBoundingBoxDescent || 0);
      if (!(ascent > 0 || descent > 0)) return null;

      const fontCenterInLine = geometry.baseline + ((descent - ascent) / 2);
      const shift = precise((geometry.lineHeight / 2) - fontCenterInLine);
      shiftCache.set(key, shift);
      return shift;
    }

    function textWidth(text: string, element: HTMLElement) {
      if (!context) return Number.POSITIVE_INFINITY;
      const style = window.getComputedStyle(element);
      context.font = canvasFont(style);
      const spacing = Number.parseFloat(style.letterSpacing);
      return context.measureText(text).width + (Number.isFinite(spacing) ? Math.max(0, text.length - 1) * spacing : 0);
    }

    function fitMyCardText() {
      document.querySelectorAll<HTMLElement>(".card-panel .pick-section .pick-card").forEach((row) => {
        const title = row.querySelector<HTMLElement>(".pick-title");
        const team = title?.querySelector<HTMLElement>(".pick-title-team");
        const market = title?.querySelector<HTMLElement>(".pick-title-market") || null;
        if (!title || !team) return;

        const renderedTeam = team.textContent?.trim() || "";
        const fullTeam = team.getAttribute("aria-label")?.trim() || team.dataset.appPassFullTeam || renderedTeam;
        if (!fullTeam) return;
        const compactTeam = team.dataset.appPassCompactTeam || (renderedTeam && renderedTeam !== fullTeam ? renderedTeam : fullTeam);
        team.dataset.appPassFullTeam = fullTeam;
        team.dataset.appPassCompactTeam = compactTeam;

        const titleStyle = window.getComputedStyle(title);
        const titleGap = Number.parseFloat(titleStyle.columnGap || titleStyle.gap) || 4;
        const marketWidth = market?.getBoundingClientRect().width || 0;
        const teamWidth = Math.max(0, title.clientWidth - marketWidth - (market ? titleGap : 0));
        const chosenTeam = teamWidth > 0 && textWidth(fullTeam, team) <= teamWidth + 0.5 ? fullTeam : compactTeam;
        if (team.textContent?.trim() !== chosenTeam) team.textContent = chosenTeam;

        const responsive = row.querySelector<HTMLElement>(".pick-meta .responsive-text");
        const value = responsive?.querySelector<HTMLElement>(".responsive-text-value");
        if (!responsive || !value) return;

        const fullMeta = responsive.getAttribute("aria-label")?.trim() || "";
        if (!fullMeta) return;
        const fullParts = splitMetaText(fullMeta);
        const fullMatchup = splitMatchup(fullParts.matchup);
        if (!fullMatchup) return;

        const initialCompactMeta = responsive.dataset.appPassCompactMeta || value.textContent?.trim() || fullMeta;
        responsive.dataset.appPassCompactMeta = initialCompactMeta;
        const compactParts = splitMetaText(initialCompactMeta);
        const compactMatchup = splitMatchup(compactParts.matchup);
        if (!compactMatchup) return;

        const selectedAway = fullTeam === fullMatchup.away;
        const selectedHome = fullTeam === fullMatchup.home;
        const intermediateMatchup = selectedAway
          ? `${fullMatchup.away} at ${compactMatchup.home}`
          : selectedHome
            ? `${compactMatchup.away} at ${fullMatchup.home}`
            : `${fullMatchup.away} at ${compactMatchup.home}`;
        const intermediateMeta = `${intermediateMatchup}${fullParts.suffix}`;
        const compactMeta = `${compactMatchup.away} at ${compactMatchup.home}${fullParts.suffix}`;

        const actions = row.querySelector<HTMLElement>(".pick-row-actions");
        const responsiveRect = responsive.getBoundingClientRect();
        const actionsRect = actions?.getBoundingClientRect();
        const top = row.querySelector<HTMLElement>(".pick-top");
        const topStyle = top ? window.getComputedStyle(top) : null;
        const gridGap = Number.parseFloat(topStyle?.columnGap || topStyle?.gap || "0") || 0;
        const available = actionsRect
          ? Math.max(0, actionsRect.left - gridGap - responsiveRect.left) + 0.5
          : responsive.clientWidth + 0.5;
        const candidates = [fullMeta, intermediateMeta, compactMeta];
        const chosenMeta = candidates.find((candidate) => textWidth(candidate, value) <= available) || compactMeta;
        if (value.textContent?.trim() !== chosenMeta) value.textContent = chosenMeta;
      });
    }

    function firstVisibleMatch(block: HTMLElement, selectors: readonly string[]) {
      for (const selector of selectors) {
        const match = block.querySelector<HTMLElement>(selector);
        if (!match || !match.textContent?.replace(/\s+/g, " ").trim()) continue;
        if (match.getClientRects().length === 0) continue;
        return match;
      }
      return null;
    }

    function canonicalVisibleGlyphMetrics(style: CSSStyleDeclaration) {
      if (!context) return null;
      const key = fontKey(style);
      const cached = visibleGlyphMetricCache.get(key);
      if (cached) return cached;

      context.font = canvasFont(style);
      context.textBaseline = "alphabetic";
      const metrics = context.measureText(FALLBACK_METRIC_TEXT);
      const actualAscent = Number(metrics.actualBoundingBoxAscent || 0);
      const actualDescent = Number(metrics.actualBoundingBoxDescent || 0);
      const fontAscent = Number(metrics.fontBoundingBoxAscent || 0);
      const fontDescent = Number(metrics.fontBoundingBoxDescent || 0);
      const ascent = actualAscent > 0 ? actualAscent : fontAscent;
      const descent = actualDescent > 0 ? actualDescent : fontDescent;
      if (!(ascent > 0 || descent > 0)) return null;

      const visibleMetrics = { ascent, descent };
      visibleGlyphMetricCache.set(key, visibleMetrics);
      return visibleMetrics;
    }

    function visibleGlyphBounds(element: HTMLElement) {
      if (!element.isConnected || element.getClientRects().length === 0) return null;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return null;
      if (!element.textContent?.replace(/\s+/g, " ").trim()) return null;

      const geometry = geometryFor(style);
      const visibleMetrics = canonicalVisibleGlyphMetrics(style);
      if (!visibleMetrics) return null;

      const rect = element.getBoundingClientRect();
      return {
        top: rect.top + geometry.baseline - visibleMetrics.ascent,
        bottom: rect.top + geometry.baseline + visibleMetrics.descent
      };
    }

    function applyVisibleEdgeBlockCentering() {
      OPTICALLY_CENTERED_TWO_LINE_BLOCKS.forEach((config) => {
        document.querySelectorAll<HTMLElement>(config.block).forEach((block) => {
          block.style.removeProperty("translate");
          block.removeAttribute("data-slab-optical-centered-block");

          const row = block.closest<HTMLElement>(config.row);
          const topLine = firstVisibleMatch(block, config.top);
          const bottomLine = firstVisibleMatch(block, config.bottom);
          if (!row || !topLine || !bottomLine) return;

          const topBounds = visibleGlyphBounds(topLine);
          const bottomBounds = visibleGlyphBounds(bottomLine);
          if (!topBounds || !bottomBounds) return;

          const rowRect = row.getBoundingClientRect();
          const visibleCenter = (topBounds.top + bottomBounds.bottom) / 2;
          const rowCenter = rowRect.top + (rowRect.height / 2);
          const shift = precise(rowCenter - visibleCenter);
          block.style.setProperty("translate", `0 ${shift}px`);
          block.dataset.slabOpticalCenteredBlock = "true";
        });
      });
    }

    function clearOpticalTranslations() {
      document.querySelectorAll<HTMLElement>("[data-slab-optical-centered]").forEach((element) => {
        element.style.removeProperty("translate");
        element.removeAttribute("data-slab-optical-centered");
      });
      document.querySelectorAll<HTMLElement>("[data-stable-font-wrapper-centered]").forEach((wrapper) => {
        wrapper.style.removeProperty("translate");
        wrapper.removeAttribute("data-stable-font-wrapper-centered");
      });
      document.querySelectorAll<HTMLElement>("[data-slab-optical-centered-block]").forEach((block) => {
        block.style.removeProperty("translate");
        block.removeAttribute("data-slab-optical-centered-block");
      });
    }

    function applyStableTextCentering() {
      if (document.fonts?.status === "loading") return;
      clearOpticalTranslations();

      const matches = Array.from(document.querySelectorAll<HTMLElement>(OPTICALLY_CENTERED_TEXT_SELECTOR))
        .filter((element) => !element.closest(".notification-badge"));
      const matchSet = new Set(matches);
      const leafMatches = matches.filter((element) => {
        return !Array.from(element.querySelectorAll<HTMLElement>(OPTICALLY_CENTERED_TEXT_SELECTOR))
          .some((descendant) => matchSet.has(descendant) && Boolean(descendant.textContent?.trim()));
      });

      leafMatches.forEach((element) => {
        const shift = stableShift(element);
        if (shift === null) return;

        const responsiveWrapper = element.matches(".responsive-text-value")
          ? element.closest<HTMLElement>(".responsive-text")
          : null;

        if (responsiveWrapper) {
          element.style.setProperty("translate", "0 0");
          responsiveWrapper.style.setProperty("translate", `0 ${shift}px`);
          responsiveWrapper.dataset.stableFontWrapperCentered = "true";
        } else {
          element.style.setProperty("translate", `0 ${shift}px`);
        }
        element.dataset.slabOpticalCentered = "true";

        const teamName = element.closest(".team-name");
        const nameLine = teamName?.closest(".team-name-line");
        const possession = nameLine?.querySelector<HTMLElement>(".possession-icon");
        if (possession) {
          possession.style.setProperty("translate", `0 ${shift}px`);
          possession.dataset.slabOpticalCentered = "true";
        }
      });

      applyVisibleEdgeBlockCentering();
    }

    function run() {
      if (!active) return;
      fitMyCardText();
      makeSeasonNamesInteractive();
      applyStableTextCentering();
      const bankActive = bankPanelIsActive();
      if (bankActive && !bankWasActive) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
      bankWasActive = bankActive;
    }

    function schedule() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(run);
    }

    function onKey(event: KeyboardEvent) {
      if (!["Enter", " "].includes(event.key)) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.classList.contains("player-profile-link")) target.click();
    }

    function onFontsLoaded() {
      fontGeometryCache.clear();
      shiftCache.clear();
      visibleGlyphMetricCache.clear();
      schedule();
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    document.addEventListener("keydown", onKey);
    window.addEventListener("focus", schedule);
    window.addEventListener("resize", schedule);
    document.fonts?.addEventListener?.("loadingdone", onFontsLoaded);
    void document.fonts?.ready.then(onFontsLoaded);
    schedule();

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("focus", schedule);
      window.removeEventListener("resize", schedule);
      document.fonts?.removeEventListener?.("loadingdone", onFontsLoaded);
      clearOpticalTranslations();
      probe.remove();
    };
  }, []);
  return null;
}