import Image from "next/image";
import { memo } from "react";
import type { PickemAppSlug } from "@/lib/authUsers";

/** All three leagues render their original, unmodified wordmark assets. */
function LeagueHeaderWordmark({ slug }: { slug: PickemAppSlug }) {
  const basketball = slug === "friends-basketball";
  const shaw = slug === "shaw-family";
  const src = basketball ? "/basketball-pickem-header-v2.png" : shaw ? "/header-wordmark.png" : "/football-pickem-wordmark.png";
  const alt = basketball ? "Basketball Pick'em" : shaw ? "Shaw Family Pick'em" : "Football Pick'em";

  return <div className="brand-lockup">
    <Image className="header-wordmark" unoptimized src={src} alt={alt} width={800} height={shaw ? 96 : 100} decoding="sync" fetchPriority="high" />
  </div>;
}

export default memo(LeagueHeaderWordmark);
