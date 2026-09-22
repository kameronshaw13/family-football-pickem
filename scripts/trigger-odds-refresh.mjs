const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("Odds diagnostic skipped: CRON_SECRET unavailable.");
  process.exit(1);
}
const response = await fetch("https://family-football-pickem.vercel.app/api/cron/odds", {
  headers: { authorization: `Bearer ${secret}` },
  cache: "no-store"
});
const body = await response.text();
console.log("Odds diagnostic response:", response.status, body);
if (!response.ok) process.exit(1);
