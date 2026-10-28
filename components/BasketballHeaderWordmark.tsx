import Image from "next/image";
import type { RefObject } from "react";

/** The icon and lettering are one composited asset, not independently laid out. */
export default function BasketballHeaderWordmark({ imageRef, ready, onReady }: {
  imageRef: RefObject<HTMLImageElement | null>;
  ready: boolean;
  onReady: () => void;
}) {
  return <div className="brand-lockup">
    <Image ref={imageRef} className="header-wordmark" src="/basketball-pickem-header-v2.png" alt="Basketball Pick'em" width={800} height={100} unoptimized decoding="sync" fetchPriority="high" onLoad={onReady} style={{ visibility: ready ? "visible" : "hidden", opacity: ready ? 1 : 0 }} />
  </div>;
}
