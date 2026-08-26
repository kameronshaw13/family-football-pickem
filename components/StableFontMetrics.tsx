"use client";

import { useEffect } from "react";

const PRECISION = 4096;
const FALLBACK_METRIC_TEXT = "Hg";

function precise(value: number) {
  return Math.round(value * PRECISION) / PRECISION;
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

export default function StableFontMetrics() {
  useEffect(() => {
    let active = true;
    let frame = 0;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const shiftCache = new Map<string, number>();

    const probe = document.createElement("span");
    const probeText = document.createTextNode("Hg");
    const baselineMarker = document.createElement("i");
    probe.dataset.stableFontMetricProbe = "true";
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

    function stableShift(element: HTMLElement) {
      if (!context || !element.isConnected || element.getClientRects().length === 0) return null;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return null;
      const key = fontKey(style);
      const cached = shiftCache.get(key);
      if (cached !== undefined) return cached;

      probe.style.fontFamily = style.fontFamily;
      probe.style.fontSize = style.fontSize;
      probe.style.fontStyle = style.fontStyle;
      probe.style.fontWeight = style.fontWeight;
      probe.style.lineHeight = style.lineHeight;
      probe.style.letterSpacing = style.letterSpacing;
      const probeRect = probe.getBoundingClientRect();
      const markerRect = baselineMarker.getBoundingClientRect();
      const baseline = markerRect.top - probeRect.top;
      const lineHeight = probeRect.height;

      context.font = canvasFont(style);
      context.textBaseline = "alphabetic";
      const metrics = context.measureText(FALLBACK_METRIC_TEXT);

      // Use font-level bounds when the browser exposes them. These describe the
      // typeface/style itself, so Georgia, Alabama, JSU, NDSU, etc. all receive
      // exactly the same vertical correction. The fallback is also fixed text,
      // never the displayed word, so content can no longer change positioning.
      const fontAscent = Number(metrics.fontBoundingBoxAscent || 0);
      const fontDescent = Number(metrics.fontBoundingBoxDescent || 0);
      const ascent = fontAscent > 0 ? fontAscent : Number(metrics.actualBoundingBoxAscent || 0);
      const descent = fontDescent > 0 ? fontDescent : Number(metrics.actualBoundingBoxDescent || 0);
      if (!(ascent > 0 || descent > 0)) return null;

      const fontCenterInLine = baseline + ((descent - ascent) / 2);
      const shift = precise((lineHeight / 2) - fontCenterInLine);
      shiftCache.set(key, shift);
      return shift;
    }

    function clearWrapperTranslations() {
      document.querySelectorAll<HTMLElement>("[data-stable-font-wrapper-centered]").forEach((wrapper) => {
        wrapper.style.removeProperty("translate");
        wrapper.removeAttribute("data-stable-font-wrapper-centered");
      });
    }

    function applyStableMetrics() {
      if (document.fonts?.status === "loading") return;
      clearWrapperTranslations();

      document.querySelectorAll<HTMLElement>("[data-slab-optical-centered]").forEach((element) => {
        const shift = stableShift(element);
        if (shift === null) return;

        // Responsive team names use overflow for horizontal ellipsis. Moving the
        // inner glyph layer can clip a descender/ascender against that box, so move
        // the entire clipping wrapper instead. The text and its clip boundary stay
        // together and the vertical glyph pixels remain intact.
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

        const teamName = element.closest(".team-name");
        const nameLine = teamName?.closest(".team-name-line");
        const possession = nameLine?.querySelector<HTMLElement>(".possession-icon");
        if (possession) possession.style.setProperty("translate", `0 ${shift}px`);
      });

      // Multi-line/container positioning belongs to fixed layout geometry. Exact
      // glyphs must never move an entire row/card block up or down.
      document.querySelectorAll<HTMLElement>("[data-slab-optical-centered-block]").forEach((block) => {
        block.style.setProperty("translate", "0 0");
      });
    }

    function schedule() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (active) applyStableMetrics();
      });
    }

    function onFontsLoaded() {
      shiftCache.clear();
      schedule();
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    window.addEventListener("focus", schedule);
    window.addEventListener("resize", schedule);
    document.fonts?.addEventListener?.("loadingdone", onFontsLoaded);
    void document.fonts?.ready.then(onFontsLoaded);
    schedule();

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("focus", schedule);
      window.removeEventListener("resize", schedule);
      document.fonts?.removeEventListener?.("loadingdone", onFontsLoaded);
      clearWrapperTranslations();
      probe.remove();
    };
  }, []);

  return null;
}
