"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * A natural, iOS-style downward-dismiss gesture for the two game detail sheets.
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
    let dismissTimer = 0;
    let snapTimer = 0;
    let isClosing = false;
    const originalTransform = sheet.style.transform;
    const originalTransition = sheet.style.transition;

    const scrollerSelector = ".game-tracker-scroll, .matchup-preview-scroll";
    const headerSelector = ".game-tracker-header, .matchup-preview-header, .matchup-preview-hero, .game-tracker-scoreboard";
    const dismissTime = 275;
    const settleTime = 240;

    // Matching the X and swipe-down exits avoids sudden unmounts or jumps.
    const animateClose = () => {
      if (isClosing) return;
      isClosing = true;
      window.clearTimeout(snapTimer);
      sheet.style.transition = `transform ${dismissTime}ms cubic-bezier(.32, 0, .75, 1)`;
      sheet.style.transform = "translate3d(0, calc(100% + 4px), 0)";
      dismissTimer = window.setTimeout(() => closeRef.current(), dismissTime);
    };
    animatedCloseRef.current = animateClose;

    function start(event: TouchEvent) {
      if (event.touches.length !== 1 || isClosing) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const isHeader = target.closest(headerSelector) !== null && target.closest("button") === null;
      const scrollElement = target.closest<HTMLElement>(scrollerSelector);
      // Do not steal touches from nested horizontally scrollable box-score tables.
      const isNestedScroller = target.closest(".game-tracker-player-table-scroll") != null;
      candidate = isHeader || Boolean(scrollElement && scrollElement.scrollTop <= 1 && !isNestedScroller);
      dragging = false;
      dragDistance = 0;
      if (!candidate) return;
      originX = event.touches[0].clientX;
      originY = event.touches[0].clientY;
      startedAt = performance.now();
      window.clearTimeout(snapTimer);
    }

    function move(event: TouchEvent) {
      if (!candidate || event.touches.length !== 1) return;
      const dx = event.touches[0].clientX - originX;
      const dy = event.touches[0].clientY - originY;
      if (!dragging) {
        if (dy < 10 || dy < Math.abs(dx) * 1.35) return;
        dragging = true;
      }
      if (event.cancelable) event.preventDefault();
      dragDistance = Math.min(Math.max(0, dy), sheet!.clientHeight);
      sheet!.style.transition = "none";
      sheet!.style.transform = `translate3d(0, ${dragDistance}px, 0)`;
    }

    function finish() {
      if (!candidate) return;
      candidate = false;
      if (!dragging) return;
      dragging = false;
      const duration = performance.now() - startedAt;
      const dismiss = dragDistance >= 110 || (dragDistance >= 62 && duration < 330);
      if (dismiss) {
        animateClose();
      } else {
        sheet!.style.transition = `transform ${settleTime}ms cubic-bezier(.22, 1, .36, 1)`;
        sheet!.style.transform = originalTransform;
        snapTimer = window.setTimeout(() => {
          sheet!.style.transition = originalTransition;
        }, settleTime);
      }
      dragDistance = 0;
    }

    sheet.addEventListener("touchstart", start, { passive: true, capture: true });
    sheet.addEventListener("touchmove", move, { passive: false, capture: true });
    sheet.addEventListener("touchend", finish, { capture: true });
    sheet.addEventListener("touchcancel", finish, { capture: true });
    return () => {
      sheet.removeEventListener("touchstart", start, true);
      sheet.removeEventListener("touchmove", move, true);
      sheet.removeEventListener("touchend", finish, true);
      sheet.removeEventListener("touchcancel", finish, true);
      window.clearTimeout(dismissTimer);
      window.clearTimeout(snapTimer);
      animatedCloseRef.current = () => closeRef.current();
      sheet.style.transform = originalTransform;
      sheet.style.transition = originalTransition;
    };
  }, [sheetRef, mounted]);
  return () => animatedCloseRef.current();
}
