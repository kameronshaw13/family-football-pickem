import Image from "next/image";
import type { PickemAppSlug } from "@/lib/authUsers";

/** Use the same header element for every league, including basketball. */
export default function LeagueHeaderWordmark({ slug }: { slug: PickemAppSlug }) {
  const basketball = slug === "friends-basketball";
  const shaw = slug === "shaw-family";
  const src = basketball ? "/basketball-pickem-header-v2.png" : shaw ? "/header-wordmark.png" : "/football-pickem-wordmark.png";
  const alt = basketball ? "Basketball Pick'em" : shaw ? "Shaw Family Pick'em" : "Football Pick'em";
  return <div className="brand-lockup">
    <Image className="header-wordmark" unoptimized src={src} alt={alt} width={800} height={shaw ? 96 : 100} decoding="sync" fetchPriority="high" />
  </div>;
}
