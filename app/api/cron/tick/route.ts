import { NextRequest, NextResponse } from "next/server";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function callCronEndpoint(origin: string, path: string, secret: string) {
  const url = new URL(path, origin);
  url.searchParams.set("secret", secret);

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store"
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = await response.text();
  }

  return {
    ok: response.ok,
    status: response.status,
    payload
  };
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return unauthorized();

  const origin = req.nextUrl.origin;

  const odds = await callCronEndpoint(origin, "/api/cron/odds", process.env.CRON_SECRET);
  const lock = await callCronEndpoint(origin, "/api/cron/lock", process.env.CRON_SECRET);

  const ok = odds.ok && lock.ok;

  return NextResponse.json(
    {
      ok,
      odds,
      lock,
      message: ok
        ? "Odds refreshed and closed games locked."
        : "At least one scheduled task failed. Check odds and lock details."
    },
    { status: ok ? 200 : 502 }
  );
}
