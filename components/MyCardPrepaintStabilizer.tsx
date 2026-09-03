"use client";

import { useLayoutEffect } from "react";

function textWidth(text: string, element: HTMLElement) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return Number.POSITIVE_INFINITY;
  const style = window.getComputedStyle(element);
  const size = Number.parseFloat(style.fontSize) || 14;
  context.font = `${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`;
  const spacing = Number.parseFloat(style.letterSpacing);
  return context.measureText(text).width + (Number.isFinite(spacing) ? Math.max(0, text.length - 1) * spacing : 0);
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

function fitPickTeam(team: HTMLElement, title: HTMLElement, market: HTMLElement | null, fullTeam: string, compactTeam: string) {
  team.classList.add("app-pass-full-team");
  team.style.removeProperty("font-size");
  const titleStyle = window.getComputedStyle(title);
  const gap = Number.parseFloat(titleStyle.columnGap || titleStyle.gap) || 4;
  const marketWidth = market?.getBoundingClientRect().width || 0;
  const available = Math.max(0, title.clientWidth - marketWidth - (market ? gap : 0));
  const chosen = available > 0 && textWidth(fullTeam, team) <= available + 0.5 ? fullTeam : compactTeam;
  if (team.textContent?.trim() !== chosen) team.textContent = chosen;
}

function metadataWidthBeforeActions(row: HTMLElement, responsive: HTMLElement) {
  const top = row.querySelector<HTMLElement>(".pick-top");
  const actions = row.querySelector<HTMLElement>(".pick-row-actions");
  if (!top || !actions) {
    responsive.style.removeProperty("max-width");
    responsive.style.removeProperty("width");
    return responsive.clientWidth + 0.5;
  }

  const responsiveRect = responsive.getBoundingClientRect();
  const actionsRect = actions.getBoundingClientRect();
  const topStyle = window.getComputedStyle(top);
  const gridGap = Number.parseFloat(topStyle.columnGap || topStyle.gap) || 0;
  const boundaryWidth = Math.max(0, actionsRect.left - gridGap - responsiveRect.left);

  responsive.style.setProperty("width", "100%");
  responsive.style.setProperty("max-width", `${boundaryWidth}px`);
  return Math.min(responsive.clientWidth, boundaryWidth) + 0.5;
}

function stabilizeMyCardText() {
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
    fitPickTeam(team, title, market, fullTeam, compactTeam);

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
    const available = metadataWidthBeforeActions(row, responsive);
    const candidates = [fullMeta, intermediateMeta, compactMeta];
    const chosen = candidates.find((candidate) => textWidth(candidate, value) <= available) || compactMeta;
    if (value.textContent?.trim() !== chosen) value.textContent = chosen;
  });
}

export default function MyCardPrepaintStabilizer() {
  useLayoutEffect(() => {
    stabilizeMyCardText();

    const observer = new MutationObserver(() => stabilizeMyCardText());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const onResize = () => stabilizeMyCardText();
    window.addEventListener("resize", onResize);
    void document.fonts?.ready.then(stabilizeMyCardText).catch(() => undefined);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return null;
}
