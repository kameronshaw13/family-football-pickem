import Image from "next/image";
import type { PickemAppSlug } from "@/lib/authUsers";

/** Shared header for all leagues. Shaw reuses the original artwork, with only
 * "Family Pick'em" enlarged vertically to match the other Pick'em lettering. */
export default function LeagueHeaderWordmark({ slug }: { slug: PickemAppSlug }) {
  const basketball = slug === "friends-basketball";
  const shaw = slug === "shaw-family";
  const src = basketball ? "/basketball-pickem-header-v2.png" : shaw ? "/header-wordmark.png" : "/football-pickem-wordmark.png";
  const alt = basketball ? "Basketball Pick'em" : shaw ? "Shaw Family Pick'em" : "Football Pick'em";

  return <div className="brand-lockup">
    {shaw ? <svg className="header-wordmark" width="800" height="96" viewBox="0 0 800 96" role="img" aria-label={alt} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="shaw-original-mark"><rect x="0" y="0" width="461" height="96" /></clipPath>
        <clipPath id="shaw-family-lettering"><rect x="461" y="0" width="339" height="96" /></clipPath>
      </defs>
      <image href="/header-wordmark.png" width="800" height="96" clipPath="url(#shaw-original-mark)" />
      <g clipPath="url(#shaw-family-lettering)">
        <image href="/header-wordmark.png" width="800" height="96" transform="translate(0 -12) scale(1 1.25)" />
      </g>
    </svg> : <Image className="header-wordmark" unoptimized src={src} alt={alt} width={800} height={100} decoding="sync" fetchPriority="high" />}
  </div>;
}
