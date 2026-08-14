import NumericText from "@/components/NumericText";

export default function NotificationBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  const displayCount = count > 9 ? "9+" : String(count);

  return <span
    className={`notification-badge ${className}`.trim()}
    aria-label={`${count} unread notification${count === 1 ? "" : "s"}`}
  ><NumericText text={displayCount} /></span>;
}
