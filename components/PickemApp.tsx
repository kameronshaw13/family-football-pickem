"use client";

import type { AppSlug } from "@/lib/rulePresentation";
import PickemAppBase from "@/components/PickemAppBase";
import WeekScopeAndManualLockEnhancements from "@/components/WeekScopeAndManualLockEnhancements";

export default function PickemApp({ appSlug = "shaw-family" }: { appSlug?: AppSlug }) {
  return <><PickemAppBase appSlug={appSlug} /><WeekScopeAndManualLockEnhancements appSlug={appSlug} /></>;
}
