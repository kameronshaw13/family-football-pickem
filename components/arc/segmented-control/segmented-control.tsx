"use client";

/**
 * Adapted from Arc UI's MIT-licensed segmented control:
 * https://github.com/kuratlielia/arc-library/tree/main/registry/components/segmented-control
 * The sliding selection is implemented with native CSS transitions rather than Motion,
 * keeping this experiment compatible with the app's existing dependency lockfile.
 */
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./segmented-control.module.css";

export interface Segment {
  value: string;
  label: string;
  accessory?: ReactNode;
}
export interface SegmentedControlProps {
  options: Segment[];
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  onOptionIntent?: (value: string) => void;
  className?: string;
}

export default function SegmentedControl({ options, value, onValueChange, label, onOptionIntent, className }: SegmentedControlProps) {
  const id = useId();
  const track = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [indicator, setIndicator] = useState({ x: 0, width: 0, visible: false });

  useLayoutEffect(() => {
    const node = track.current;
    if (!node) return;
    const update = () => {
      const buttons = node.querySelectorAll<HTMLButtonElement>("button[data-segment]");
      const chosen = buttons[selectedIndex];
      if (!chosen) return;
      const next = { x: chosen.offsetLeft, width: chosen.offsetWidth, visible: true };
      setIndicator((prev) => prev.x === next.x && prev.width === next.width && prev.visible ? prev : next);
      const end = chosen.offsetLeft + chosen.offsetWidth;
      if (node.scrollWidth > node.clientWidth) {
        if (chosen.offsetLeft < node.scrollLeft) node.scrollLeft = chosen.offsetLeft;
        else if (end > node.scrollLeft + node.clientWidth) node.scrollLeft = end - node.clientWidth;
      }
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(node);
    node.querySelectorAll("button[data-segment]").forEach((button) => observer?.observe(button));
    return () => observer?.disconnect();
  }, [selectedIndex, options.length]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    let target = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") target = selectedIndex === last ? 0 : selectedIndex + 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") target = selectedIndex === 0 ? last : selectedIndex - 1;
    if (event.key === "Home") target = 0;
    if (event.key === "End") target = last;
    if (target < 0 || !options[target]) return;
    event.preventDefault();
    onValueChange(options[target].value);
    track.current?.querySelectorAll<HTMLButtonElement>("button[data-segment]")[target]?.focus({ preventScroll: true });
  };

  return <div className={[styles.root, className].filter(Boolean).join(" ")} role="group" aria-label={label}>
    <div ref={track} className={styles.track}>
      <span
        className={styles.selection}
        aria-hidden="true"
        data-ready={indicator.visible || undefined}
        style={{ width: indicator.width, transform: `translateX(${indicator.x}px)` }}
      />
      {options.map((option, index) => (
        <button key={option.value} type="button" data-segment={option.value}
          className={styles.button} aria-pressed={value === option.value}
          tabIndex={index === selectedIndex ? 0 : -1} onKeyDown={onKeyDown}
          onClick={() => onValueChange(option.value)}
          onPointerEnter={onOptionIntent ? () => onOptionIntent(option.value) : undefined}
          onFocus={onOptionIntent ? () => onOptionIntent(option.value) : undefined}
          id={`${id}-${index}`}>
          <span className={styles.label}>{option.label}{option.accessory}</span>
        </button>
      ))}
    </div>
  </div>;
}
