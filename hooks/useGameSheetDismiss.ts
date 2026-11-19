"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";

export function sheetScrollBeyondBoundary(scrollTop: number, height: number, scrollHeight: number, deltaY: number) {
  return (scrollTop <= 1 && deltaY > 0) || (scrollTop + height >= scrollHeight - 1 && deltaY < 0);
}

/**
 * A natural, iOS-style downward-dismiss gesture for the game detail and player profile sheets.
 * Drag the header/handle, or pull down on the main content when it is at the top.
 * Normal scrolling, horizontal box-score scrolling, taps, and the X still work.
 */
export default function useGameSheetDismiss(
  sheetRef: RefObject<HTMLElement | null>,
  mounted: boolean,
  onClose: () => void
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Consumers can use the same animated dismissal for the X button.
  const animatedCloseRef = useRef<() => void>(() => closeRef.current());

  useEffect(() => {
    if (!mounted) return;
    const sheet = sheetRef.current;
    if (!sheet) return;

    let originX = 0;
    let originY = 0;
    let startedAt = 0;
    let candidate = false;
    let dragging = false;
    let dragDistance = 0;
    let recentVelocity = 0;
    let previousY = 0;
    let previousMoveAt = 0;
    let dismissTimer = 0;
    let snapTimer = 0;
    let isClosing = false;
    let activeScroller: HTMLElement | null = null;
    const originalTransform = sheet.style.transform;
    const originalTransition = sheet.style.transition;

    const scrollerSelector = ".game-tracker-scroll, .matchup-preview-scroll, .player-profile-content";
    const headerSelector = ".game-tracker-header, .matchup-preview-header, .matchup-preview-hero, .game-tracker-scoreboard, .player-profile-head";
    const gameDetail = sheet.matches(".game-tracker-sheet, .matchup-preview-sheet");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dismissTime = reducedMotion ? 1 : gameDetail ? 380 : 300;
    const settleTime = reducedMotion ? 1 : gameDetail ? 365 : 280;
    const dismissEase = gameDetail ? "cubic-bezier(.2, .68, .18, 1)" : "cubic-bezier(.22, .61, .36, 1)";
    const settleEase = gameDetail ? "cubic-bezier(.2, .9, .26, 1)" : "cubic-bezier(.22, 1, .36, 1)";

    // Matching the X and swipe-down exits avoids sudden unmounts or jumps.
    const animateClose = () => {
      if (isClosing) return;
      isClosing = true;
      window.clearTimeout(snapTimer);
      sheet.style.transition = `transform ${dismissTime}ms ${dismissEase}`;
      sheet.style.transform = "translate3d(0, calc(100% + 4px), 0)";
      dismissTimer = window.setTimeout(() => closeRef.current(), dismissTime);
    };
    animatedCloseRef.current = animateClose;

    function start(event: TouchEvent) {
      if (event.touches.length !== 1 || isClosing) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const isHeader = target.closest(headerSelector) !== null && target.closest("button, input, select, textarea, .custom-select") === null;
      const scrollElement = target.closest<HTMLElement>(scrollerSelector);
      activeScroller = scrollElement;
      // Do not steal touches from nested horizontally scrollable box-score tables.
      const isNestedScroller = target.closest(".game-tracker-player-table-scroll, .basketball-table-scroll, .cbb-player-table-scroll, .basketball-probability-chart") != null;
      candidate = isHeader || Boolean(scrollElement && scrollElement.scrollTop <= 1 && !isNestedScroller);
      dragging = false;
      dragDistance = 0;
      recentVelocity = 0;
      originX = event.touches[0].clientX;
      originY = event.touches[0].clientY;
      previousY = originY;
      startedAt = performance.now();
      previousMoveAt = startedAt;
      window.clearTimeout(snapTimer);
    }

    function move(event: TouchEvent) {
      if (event.touches.length !== 1) return;
      const currentY = event.touches[0].clientY;
      const dy = currentY - originY;
      // The top-edge downward gesture belongs to dismissal; other profile
      // boundary gestures stay contained instead of revealing elastic space.
      if (activeScroller?.matches(".player-profile-content") && (!candidate || dy < 0) &&
          sheetScrollBeyondBoundary(activeScroller.scrollTop, activeScroller.clientHeight, activeScroller.scrollHeight, dy)) {
        if (event.cancelable) event.preventDefault();
        return;
      }
      if (!candidate) return;
      const dx = event.touches[0].clientX - originX;
      if (!dragging) {
        if (dy < 10 || dy < Math.abs(dx) * 1.35) return;
        dragging = true;
      }
      if (event.cancelable) event.preventDefault();
      const now = performance.now();
      const elapsed = now - previousMoveAt;
      if (elapsed > 0 && elapsed < 100) {
        // Damp noisy per-frame velocity so a flick dismisses naturally without
        // accidentally closing on an ordinary short slow pull.
        const velocity = (currentY - previousY) / elapsed;
        recentVelocity = recentVelocity * .5 + velocity * .5;
      }
      previousY = currentY;
      previousMoveAt = now;
      const rawDistance = Math.max(0, dy);
      dragDistance = Math.min(
        gameDetail && rawDistance > 180 ? 180 + (rawDistance - 180) * .82 : rawDistance,
        sheet!.clientHeight
      );
      sheet!.style.transition = "none";
      sheet!.style.transform = `translate3d(0, ${dragDistance}px, 0)`;
    }

    function finish(cancelled = false) {
      activeScroller = null;
      if (!candidate) return;
      candidate = false;
      if (!dragging) return;
      dragging = false;
      const duration = performance.now() - startedAt;
      const dismiss = !cancelled && (
        gameDetail
          ? dragDistance >= 114 || (dragDistance >= 52 && recentVelocity >= .42 && duration < 700)
          : dragDistance >= 110 || (dragDistance >= 62 && duration < 330)
      );
      if (dismiss) {
        animateClose();
      } else {
        sheet!.style.transition = `transform ${settleTime}ms ${settleEase}`;
        sheet!.style.transform = originalTransform;
        snapTimer = window.setTimeout(() => {
          sheet!.style.transition = originalTransition;
        }, settleTime);
      }
      dragDistance = 0;
    }

    sheet.addEventListener("touchstart", start, { passive: true, capture: true });
    sheet.addEventListener("touchmove", move, { passive: false, capture: true });
    const onEnd = () => finish();
    const onCancel = () => finish(true);
    sheet.addEventListener("touchend", onEnd, { capture: true });
    sheet.addEventListener("touchcancel", onCancel, { capture: true });
    return () => {
      sheet.removeEventListener("touchstart", start, true);
      sheet.removeEventListener("touchmove", move, true);
      sheet.removeEventListener("touchend", onEnd, true);
      sheet.removeEventListener("touchcancel", onCancel, true);
      window.clearTimeout(dismissTimer);
      window.clearTimeout(snapTimer);
      animatedCloseRef.current = () => closeRef.current();
      sheet.style.transform = originalTransform;
      sheet.style.transition = originalTransition;
    };
  }, [sheetRef, mounted]);
  return useCallback(() => animatedCloseRef.current(), []);
}
