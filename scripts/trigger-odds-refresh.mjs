const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("Manual odds refresh skipped: CRON_SECRET is unavailable.");
  process.exit(1);
}

const response = await fetch("https://family-football-pickem.vercel.app/api/cron/odds", {
  method: "GET",
  headers: { authorization: `Bearer ${secret}` },
  cache: "no-store"
});

const body = await response.text();

if (!response.ok) {
  console.error(`Manual odds refresh failed with status ${response.status}: ${body}`);
  process.exit(1);
}

console.log(`Manual odds refresh complete: ${body}`);
