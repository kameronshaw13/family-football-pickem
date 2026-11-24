"use client";

import { useEffect, useRef, useState } from "react";

/** Show the full school/city name whenever it fits. Only fall back to
 * the shorter scoreboard label when the available pill width is insufficient. */
export default function TrackerTeamLabel({ full, short }: { full: string; short: string }) {
  const host = useRef<HTMLSpanElement>(null);
  const meter = useRef<HTMLSpanElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const label = host.current;
    const measure = meter.current;
    if (!label || !measure) return;
    const button = label.parentElement;
    if (!button) return;
    const update = () => {
      const style = getComputedStyle(button);
      const logoWidth = label.previousElementSibling?.getBoundingClientRect().width ?? 0;
      const logoGap = logoWidth ? parseFloat(style.columnGap) || 0 : 0;
      const available = button.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - logoWidth - logoGap;
      setCompact(measure.getBoundingClientRect().width > available);
    };
    const observer = new ResizeObserver(update);
    observer.observe(button);
    void document.fonts?.ready.then(update).catch(() => undefined);
    update();
    return () => observer.disconnect();
  }, [full]);
  return <span className="tracker-adaptive-team-label" ref={host} title={compact ? full : undefined}>
    <span className="tracker-adaptive-team-label-value">{compact ? short : full}</span>
    <span className="tracker-adaptive-team-label-meter" ref={meter} aria-hidden="true">{full}</span>
  </span>;
}
