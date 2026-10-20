"use client";
import NumericText from "@/components/NumericText";
import NotificationBadge from "@/components/NotificationBadge";

export default function SectionTabs({ items, value, onChange }: { items: Array<{ id: string; label: string; badge?: number }>; value: string; onChange: (value: string) => void }) {
  return <div className="section-tabs">{items.map((item) => <button key={item.id} className={value === item.id ? "active" : ""} onClick={() => onChange(item.id)}><span className="section-tab-label"><NumericText text={item.label} /><NotificationBadge count={item.badge || 0} /></span></button>)}</div>;
}

