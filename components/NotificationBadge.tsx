import { memo } from "react";

function NotificationBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  const displayCount = count > 9 ? "9+" : String(count);

  return <span
    className={`notification-badge ${className}`.trim()}
    aria-label={`${count} unread notification${count === 1 ? "" : "s"}`}
  ><span className="notification-badge-value" aria-hidden="true">{displayCount}</span></span>;
}

export default memo(NotificationBadge);
