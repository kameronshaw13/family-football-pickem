"use client";

import type { AppSlug } from "@/lib/rulePresentation";
import PickemAppBase from "@/components/PickemAppBase";
import Batch1UiEnhancements from "@/components/Batch1UiEnhancements";
import Batch1bSideBetStyles from "@/components/Batch1bSideBetStyles";
import WeekScopeAndManualLockEnhancements from "@/components/WeekScopeAndManualLockEnhancements";

export default function PickemApp({ appSlug = "shaw-family" }: { appSlug?: AppSlug }) {
  return <><PickemAppBase appSlug={appSlug} /><Batch1UiEnhancements /><Batch1bSideBetStyles /><WeekScopeAndManualLockEnhancements appSlug={appSlug} /></>;
}
