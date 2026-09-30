"use client";

import PickemAppBase from "@/components/PickemAppBase";
import WeekScopeAndManualLockEnhancements from "@/components/WeekScopeAndManualLockEnhancements";

export default function PickemApp({ appSlug = "shaw-family" }: { appSlug?: string }) {
  return <><PickemAppBase appSlug={appSlug} /><WeekScopeAndManualLockEnhancements appSlug={appSlug} /></>;
}
