import { Layers3 } from "lucide-react";
import type { AppSlug } from "@/lib/rulePresentation";

/** Arc-first experiment: product branding, not a screenshot or the legacy wordmark. */
export default function ArcBrand({ appSlug }: { appSlug: AppSlug }) {
  const league = appSlug === "shaw-family" ? "SHAW FAMILY" : appSlug === "friends" ? "FRIENDS LEAGUE" : "FOOTBALL LEAGUE";
  return (
    <div className="arc-brand">
      <span className="arc-brand-mark" aria-hidden="true"><Layers3 size={20} strokeWidth={2.1} /></span>
      <span className="arc-brand-type">
        <strong>FIELDHOUSE<span className="arc-brand-point">.</span></strong>
        <small>{league} <span className="arc-brand-divider">/</span> PICK&apos;EM</small>
      </span>
    </div>
  );
}
