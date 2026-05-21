import { NextRequest, NextResponse } from "next/server";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized. CRON_SECRET is missing or does not match." }, { status: 401 });
}

async function readResponsePayload(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 2000);
  }
}

async function callCronEndpoint(origin: string, path: string, secret: string) {
  try {
    const url = new URL(path, origin);
    url.searchParams.set("secret", secret);

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store"
    });

    const payload = await readResponsePayload(response);

    return {
      ok: response.ok,
      status: response.status,
      payload
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      payload: {
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

export async function GET(req: NextRequest) {
  try {
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
          : "At least one scheduled task failed. Read odds.payload and lock.payload for the exact reason."
      },
      { status: ok ? 200 : 502 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Tick route crashed before it could finish.",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
