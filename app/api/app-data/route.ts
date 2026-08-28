import { NextRequest, NextResponse } from "next/server";
import { GET as getAppDataV2 } from "@/app/api/app-data-v2/route";

export { dynamic, revalidate } from "@/app/api/app-data-v2/route";
export const maxDuration = 30;

function pickStart(pick: any) {
  return new Date(pick?.game?.commence_time || 0).getTime();
}

export async function GET(req: NextRequest) {
  const response = await getAppDataV2(req);
  if (!response.ok) return response;
  const payload = await response.json();
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
