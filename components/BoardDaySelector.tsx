"use client";

import { useEffect, useRef } from "react";

const FORMAT = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago" });

export default function BoardDaySelector({ days, value, today, onChange }: {
  days: string[]; value: string; today: string; onChange: (day: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const dayListSignature = days.join("|");
  useEffect(() => {
    const container = scroller.current;
    const selected = container?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!container || !selected) return;
    const left = selected.offsetLeft - (container.clientWidth - selected.offsetWidth) / 2;
    container.scrollTo({ left, behavior: "smooth" });
  }, [value, dayListSignature]);
  if (!days.length) return null;
  return <div className="board-day-selector" role="tablist" ref={scroller} aria-label="Select game day">
    {days.map(day => {
      const [year, month, date] = day.split("-").map(Number);
      const dateValue = new Date(Date.UTC(year, month - 1, date, 18));
      const label = day === today ? "Today" : FORMAT.format(dateValue);
      return <button type="button" role="tab" key={day} aria-selected={value === day}
        aria-label={`${FORMAT.format(dateValue)}${day === today ? ", today" : ""}`}
        className={value === day ? "active" : ""} onClick={() => onChange(day)}>{label}</button>;
    })}
  </div>;
}
