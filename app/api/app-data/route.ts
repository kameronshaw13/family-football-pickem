import { NextRequest, NextResponse } from "next/server";
import { GET as getAppDataV2 } from "@/app/api/app-data-v2/route";
import { finalizeIncompleteCardsAfterWeekendLock } from "@/lib/finalizeIncompleteCards";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export { dynamic, revalidate } from "@/app/api/app-data-v2/route";
export const maxDuration = 30;

function pickStart(pick: any) {
  return new Date(pick?.game?.commence_time || 0).getTime();
}

async function readPayload(req: NextRequest) {
  const response = await getAppDataV2(req);
  if (!response.ok) return { response, payload: null };
  return { response, payload: await response.json() };
}

export async function GET(req: NextRequest) {
  let { response, payload } = await readPayload(req);
  if (!response.ok || !payload) return response;

  const groupId = payload.activeGroup?.id;
  const seasonYear = Number(payload.seasonYear);
  const week = Number(payload.week);
  if (groupId && Number.isInteger(seasonYear) && Number.isInteger(week)) {
    const finalized = await finalizeIncompleteCardsAfterWeekendLock(getSupabaseAdmin(), { groupId, seasonYear, week });
    if (finalized.cardsFinalized > 0) {
      const refreshed = await readPayload(req);
      response = refreshed.response;
      if (!response.ok || !refreshed.payload) return response;
      payload = refreshed.payload;
    }
  }

  if (Array.isArray(payload.picks)) {
    const confidenceMode = payload.activeGroup?.slug === "other-family";
    payload.picks = [...payload.picks].sort((a, b) => {
      const dogOrder = Number(a.pick_type === "underdog") - Number(b.pick_type === "underdog");
      if (dogOrder !== 0) return dogOrder;
      if (confidenceMode) {
        const confidenceOrder = Number(b.confidence_points || 0) - Number(a.confidence_points || 0);
        if (confidenceOrder !== 0) return confidenceOrder;
      }
      return pickStart(a) - pickStart(b);
    });
  }
  return NextResponse.json(payload, { status: response.status, headers: { "Cache-Control": "no-store, max-age=0" } });
}
