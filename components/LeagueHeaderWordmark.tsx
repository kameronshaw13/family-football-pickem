import Image from "next/image";
import { memo } from "react";
import type { PickemAppSlug } from "@/lib/authUsers";

/**
 * Keep every wordmark mounted so selecting a different league does not replace
 * the existing image element or introduce an image decode/paint gap.
 */
function LeagueHeaderWordmark({ slug }: { slug: PickemAppSlug }) {
  return <div className="brand-lockup">
    {([
      { slug: "shaw-family", src: "/header-wordmark.png", alt: "Shaw Family Pick'em", height: 96 },
      { slug: "friends", src: "/football-pickem-wordmark.png", alt: "Football Pick'em", height: 100 },
      { slug: "friends-basketball", src: "/basketball-pickem-header-v2.png", alt: "Basketball Pick'em", height: 100 }
    ] as const).map((item) => {
      const visible = item.slug === (slug === "friends-basketball" ? "friends-basketball" : slug === "shaw-family" ? "shaw-family" : "friends");
      return <Image
        key={item.slug}
        className="header-wordmark"
        src={item.src}
        alt={visible ? item.alt : ""}
        aria-hidden={!visible}
        width={800}
        height={item.height}
        unoptimized
        decoding="sync"
        fetchPriority={visible ? "high" : "low"}
        style={{ display: visible ? "block" : "none" }}
      />;
    })}
  </div>;
}

export default memo(LeagueHeaderWordmark);
