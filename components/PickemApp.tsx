"use client";

import type { AppSlug } from "@/lib/rulePresentation";
import PickemAppBase from "@/components/PickemAppBase";
import WeekScopeAndManualLockEnhancements from "@/components/WeekScopeAndManualLockEnhancements";
import PickemUiCorrections from "@/components/PickemUiCorrections";
import LockedPickIconSync from "@/components/LockedPickIconSync";

export default function PickemApp({ appSlug = "shaw-family" }: { appSlug?: AppSlug }) {
  return <><PickemAppBase appSlug={appSlug} /><WeekScopeAndManualLockEnhancements appSlug={appSlug} /><PickemUiCorrections appSlug={appSlug} /><LockedPickIconSync appSlug={appSlug} /></>;
}
