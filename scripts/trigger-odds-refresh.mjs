const secret = process.env.CRON_SECRET;
if (!secret) process.exit(1);
const response = await fetch("https://family-football-pickem.vercel.app/api/cron/odds", {
  headers: { authorization: `Bearer ${secret}` },
  cache: "no-store"
});
console.log("Excluded-game diagnostic:", response.status, await response.text());
if (!response.ok) process.exit(1);
