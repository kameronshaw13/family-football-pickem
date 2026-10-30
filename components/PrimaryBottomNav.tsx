"use client";

import { memo, startTransition, useEffect, useState } from "react";
import { Settings, SquareCheck, Trophy, Zap } from "lucide-react";
import NotificationBadge from "@/components/NotificationBadge";
import type { Tab } from "@/components/PickemPresentationShared";

const ITEMS = [
  { id: "picks", label: "Picks", icon: Zap },
  { id: "card", label: "My Card", icon: SquareCheck },
  { id: "standings", label: "Standings", icon: Trophy },
  { id: "settings", label: "Settings", icon: Settings }
] as const;

/** Immediate button feedback, with expensive tab content rendered at low priority.
 * This isolates the nav from the main scoreboard/picks calculations on tap.
 */
function PrimaryBottomNav({ activeTab, counts, onSelect }: {
  activeTab: Tab;
  counts: Partial<Record<Tab, number>>;
  onSelect: (tab: Tab) => void;
}) {
  const [pressedTab, setPressedTab] = useState<Tab | null>(null);

  useEffect(() => {
    setPressedTab(null);
  }, [activeTab]);

  const visibleTab = pressedTab ?? activeTab;

  return <nav className="primary-nav" aria-label="Main navigation">
    <div className="primary-nav-inner">
      {ITEMS.map((item) => <button
        key={item.id}
        type="button"
        aria-current={visibleTab === item.id ? "page" : undefined}
        className={visibleTab === item.id ? "active" : ""}
        onClick={() => {
          setPressedTab(item.id);
          startTransition(() => onSelect(item.id));
        }}
      >
        <span className={`nav-icon nav-icon-${item.id}`}>
          <item.icon size={19} />
          <NotificationBadge count={counts[item.id] || 0} className="nav-notification-badge" />
        </span>
        <span>{item.label}</span>
      </button>)}
    </div>
  </nav>;
}

export default memo(PrimaryBottomNav);
