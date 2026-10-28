/** Compact, football-style wordmark. The square artwork remains the installed app icon only. */
export default function BasketballHeaderWordmark({ className = "" }: { className?: string }) {
  return <div className={`basketball-header-wordmark ${className}`} role="img" aria-label="Basketball Pick'em">
    <svg className="basketball-header-ball" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="46" fill="#0569c5" stroke="#fff" strokeWidth="3" />
      <circle cx="50" cy="50" r="40" fill="#0b2d59" stroke="#fff" strokeWidth="4" />
      <path d="M50 10V90 M10 50H90 M24 20C52 42 52 58 24 80 M76 20C48 42 48 58 76 80" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    </svg>
    <span aria-hidden="true">Basketball Pick&apos;em</span>
  </div>;
}
