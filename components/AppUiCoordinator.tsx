"use client";

import { useEffect } from "react";

type UiGame = {
  away_logo_url?: string | null;
  home_logo_url?: string | null;
};

type UiPayload = {
  games?: UiGame[];
};

type CacheEntry = { cachedAt?: number; payload?: UiPayload };
type FontGeometry = { baseline: number; lineHeight: number };
type InkGeometry = { center: number; height: number };

const CACHE_PREFIX = "pickem_app_data_v1:";
const preloadImages = new Map<string, HTMLImageElement>();

const OPTICALLY_CENTERED_TEXT_SELECTOR = [
  ".section-tab-label",
  ".heading-with-badge",
  ".custom-select-label",
  ".responsive-text-value",
  ".game-time",
  ".game-final-status",
  ".game-live-status",
  ".game-live-situation",
  ".team-name",
  ".team-spread",
  ".team-board-market",
  ".team-result-score",
  ".pick-title-team",
  ".pick-title-market",
  ".pick-meta",
  ".visible-pick-copy strong",
  ".visible-pick-copy p",
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

const OPTICALLY_CENTERED_BLOCK_SELECTOR = [
  ".pick-copy",
  ".visible-pick-copy",
  ".side-bet-offer-copy",
  ".side-bet-ledger-copy",
  ".bank-game-result > div",
  ".side-bet-slip-title",
  ".player-profile-head-copy"
].join(", ");

const OPTICAL_EXCLUSION_SELECTOR = [
  ".responsive-text-measure",
  ".side-bet-response-measure",
  ".notification-badge",
  "svg",
  "[hidden]",
  "[aria-hidden=\"true\"]"
].join(", ");

function cachedPayload() {
  let best: { cachedAt: number; payload: UiPayload } | null = null;
  try {
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      const entry = JSON.parse(window.sessionStorage.getItem(key) || "null") as CacheEntry | null;
      if (!entry?.payload) continue;
      const cachedAt = Number(entry.cachedAt || 0);
      if (!best || cachedAt > best.cachedAt) best = { cachedAt, payload: entry.payload };
    }
  } catch {
    return null;
  }
  return best?.payload || null;
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

function preloadLogos(payload: UiPayload | null) {
  for (const game of payload?.games || []) {
    for (const url of [game.away_logo_url, game.home_logo_url]) {
      if (!url || preloadImages.has(url)) continue;
      const image = new Image();
      image.src = url;
      preloadImages.set(url, image);
      void image.decode?.().catch(() => undefined);
    }
  }
}

function transformedText(text: string, transform: string) {
  if (transform === "uppercase") return text.toLocaleUpperCase();
  if (transform === "lowercase") return text.toLocaleLowerCase();
  if (transform === "capitalize") {
    return text.replace(/(^|[\s-])([a-z])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase()}`);
  }
  return text;
}

function opticalText(element: HTMLElement) {
  let value = "";

  function visit(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      value += node.nodeValue || "";
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node !== element && node.matches(OPTICAL_EXCLUSION_SELECTOR)) return;
    node.childNodes.forEach(visit);
  }

  element.childNodes.forEach(visit);
  return value.replace(/\s+/g, " ").trim();
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

export default function AppUiCoordinator() {
  useEffect(() => {
    let active = true;
    let frame = 0;
    let bankWasActive = false;
    const fontGeometryCache = new Map<string, FontGeometry>();
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    const probe = document.createElement("span");
    const probeText = document.createTextNode("Hg");
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

    function opticalShift(element: HTMLElement): { shift: number; inkHeight: number } | null {
      if (!context || !element.isConnected || element.getClientRects().length === 0) return null;
      if (element.closest(".responsive-text-measure, .side-bet-response-measure")) return null;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return null;
      const rawText = opticalText(element);
      if (!rawText) return null;
      const text = transformedText(rawText, style.textTransform);
      const geometry = geometryFor(style);

      context.font = canvasFont(style);
      context.textBaseline = "alphabetic";
      const metrics = context.measureText(text);
      const ascent = Number(metrics.actualBoundingBoxAscent || 0);
      const descent = Number(metrics.actualBoundingBoxDescent || 0);
      if (!(ascent > 0 || descent > 0)) return null;

      const inkCenterInLine = geometry.baseline + ((descent - ascent) / 2);
      const shift = (geometry.lineHeight / 2) - inkCenterInLine;
      return {
        shift: Math.round(shift * 64) / 64,
        inkHeight: ascent + descent
      };
    }

    function clearOpticalTranslations() {
      document.querySelectorAll<HTMLElement>("[data-slab-optical-centered]").forEach((element) => {
        element.style.removeProperty("translate");
        element.removeAttribute("data-slab-optical-centered");
      });
      document.querySelectorAll<HTMLElement>("[data-slab-optical-centered-block]").forEach((element) => {
        element.style.removeProperty("translate");
        element.removeAttribute("data-slab-optical-centered-block");
      });
    }

    function applyOpticalTextCentering() {
      if (document.fonts?.status === "loading") return;
      clearOpticalTranslations();

      const matches = Array.from(document.querySelectorAll<HTMLElement>(OPTICALLY_CENTERED_TEXT_SELECTOR));
      const matchSet = new Set(matches);
      const leafMatches = matches.filter((element) => {
        return !Array.from(element.querySelectorAll<HTMLElement>(OPTICALLY_CENTERED_TEXT_SELECTOR))
          .some((descendant) => matchSet.has(descendant) && opticalText(descendant));
      });
      const inkByElement = new Map<HTMLElement, InkGeometry>();

      leafMatches.forEach((element) => {
        const measurement = opticalShift(element);
        if (!measurement) return;
        const rect = element.getBoundingClientRect();
        element.style.setProperty("translate", `0 ${measurement.shift}px`);
        element.dataset.slabOpticalCentered = "true";
        inkByElement.set(element, {
          center: rect.top + (rect.height / 2),
          height: measurement.inkHeight
        });

        const teamName = element.closest(".team-name");
        const nameLine = teamName?.closest(".team-name-line");
        const possession = nameLine?.querySelector<HTMLElement>(".possession-icon");
        if (possession) {
          possession.style.setProperty("translate", `0 ${measurement.shift}px`);
          possession.dataset.slabOpticalCentered = "true";
        }
      });

      document.querySelectorAll<HTMLElement>(OPTICALLY_CENTERED_BLOCK_SELECTOR).forEach((block) => {
        const descendants = Array.from(block.querySelectorAll<HTMLElement>(OPTICALLY_CENTERED_TEXT_SELECTOR))
          .map((element) => inkByElement.get(element))
          .filter((geometry): geometry is InkGeometry => Boolean(geometry));
        if (!descendants.length) return;
        const top = Math.min(...descendants.map((geometry) => geometry.center - (geometry.height / 2)));
        const bottom = Math.max(...descendants.map((geometry) => geometry.center + (geometry.height / 2)));
        const visibleCenter = (top + bottom) / 2;
        const rect = block.getBoundingClientRect();
        const blockCenter = rect.top + (rect.height / 2);
        const shift = Math.round((blockCenter - visibleCenter) * 64) / 64;
        block.style.setProperty("translate", `0 ${shift}px`);
        block.dataset.slabOpticalCenteredBlock = "true";
      });
    }

    function run() {
      if (!active) return;
      makeSeasonNamesInteractive();
      preloadLogos(cachedPayload());
      applyOpticalTextCentering();
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
