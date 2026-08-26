"use client";

import { useEffect } from "react";

const PRECISION = 4096;
const CALIBRATION_TEXT = "HgjpqyAOM0123456789";

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
    style.letterSpacing,
    style.textTransform
  ].join("|");
}

function canvasFont(style: CSSStyleDeclaration) {
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

function calibrationText(transform: string) {
  if (transform === "uppercase") return CALIBRATION_TEXT.toLocaleUpperCase();
  if (transform === "lowercase") return CALIBRATION_TEXT.toLocaleLowerCase();
  return CALIBRATION_TEXT;
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
      const metrics = context.measureText(calibrationText(style.textTransform));
      const ascent = Number(metrics.actualBoundingBoxAscent || 0);
      const descent = Number(metrics.actualBoundingBoxDescent || 0);
      if (!(ascent > 0 || descent > 0)) return null;

      const inkCenterInLine = baseline + ((descent - ascent) / 2);
      const shift = precise((lineHeight / 2) - inkCenterInLine);
      shiftCache.set(key, shift);
      return shift;
    }

    function applyStableMetrics() {
      if (document.fonts?.status === "loading") return;

      document.querySelectorAll<HTMLElement>("[data-slab-optical-centered]").forEach((element) => {
        const shift = stableShift(element);
        if (shift === null) return;
        element.style.setProperty("translate", `0 ${shift}px`);

        const teamName = element.closest(".team-name");
        const nameLine = teamName?.closest(".team-name-line");
        const possession = nameLine?.querySelector<HTMLElement>(".possession-icon");
        if (possession) possession.style.setProperty("translate", `0 ${shift}px`);
      });

      // Multi-line/container positioning belongs to fixed layout geometry. Exact glyphs
      // should never move an entire block up or down.
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
      probe.remove();
    };
  }, []);

  return null;
}
