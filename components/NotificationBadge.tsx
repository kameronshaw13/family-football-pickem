export default function NotificationBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  const displayCount = count > 9 ? "9+" : String(count);
  const valueClass = displayCount === "1" ? "notification-badge-value notification-badge-value-one" : "notification-badge-value";

  return <span
    className={`notification-badge ${className}`.trim()}
    aria-label={`${count} unread notification${count === 1 ? "" : "s"}`}
  ><span className={valueClass} aria-hidden="true">{displayCount}</span></span>;
}
