"use client";

import { useEffect } from "react";

const MONTH_DAY_PATTERN = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?![a-z])/gi;

function ordinalSuffix(day: number) {
  const lastTwo = day % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return "th";
  if (day % 10 === 1) return "st";
  if (day % 10 === 2) return "nd";
  if (day % 10 === 3) return "rd";
  return "th";
}

function withOrdinalDay(text: string) {
  const uppercase = text === text.toUpperCase();
  return text.replace(MONTH_DAY_PATTERN, (_match, month: string, dayText: string) => {
    const day = Number(dayText);
    if (!Number.isInteger(day) || day < 1 || day > 31) return `${month} ${dayText}`;
    const suffix = ordinalSuffix(day);
    return `${month} ${day}${uppercase ? suffix.toUpperCase() : suffix}`;
  });
}

export default function DateHeaderOrdinals() {
  useEffect(() => {
    const apply = () => {
      document.querySelectorAll<HTMLElement>(".game-day-marker > strong").forEach((element) => {
        const current = element.textContent || "";
        const next = withOrdinalDay(current);
        if (next !== current) element.textContent = next;
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
