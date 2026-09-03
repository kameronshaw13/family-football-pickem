"use client";

import type { AppSlug } from "@/lib/rulePresentation";
import PickemAppBase from "@/components/PickemAppBase";
import WeekScopeAndManualLockEnhancements from "@/components/WeekScopeAndManualLockEnhancements";
import AppPassFixes from "@/components/AppPassFixes";
import DateHeaderOrdinals from "@/components/DateHeaderOrdinals";

export default function PickemApp({ appSlug = "shaw-family" }: { appSlug?: AppSlug }) {
  return <><PickemAppBase appSlug={appSlug} /><WeekScopeAndManualLockEnhancements appSlug={appSlug} /><AppPassFixes appSlug={appSlug} /><DateHeaderOrdinals /></>;
}
