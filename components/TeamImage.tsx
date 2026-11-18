"use client";

import { useState } from "react";
import NextImage, { type ImageProps } from "next/image";
import { teamVectorFallbackLogo, teamVectorLogo } from "@/lib/teamLogoSource";
import type { League } from "@/lib/types";

type Props = ImageProps & {
  scoreboardLeague?: League;
  logoBackground?: string;
  onLogoPalette?: (colors: string[]) => void;
};

/** Use CBS's verified directory artwork consistently, without unverified alternate variants. */
export default function TeamImage({
  src, onError, scoreboardLeague: _scoreboardLeague,
  logoBackground: _logoBackground, onLogoPalette: _onLogoPalette, ...props
}: Props) {
  const [failedCbs, setFailedCbs] = useState<string | null>(null);
  const [failedNcaa, setFailedNcaa] = useState<string | null>(null);
  const original = typeof src === "string" ? src : "";

  // The synced CBS mapping verifies this standard SVG path, not the /alt/ path.
  const cbs = original ? teamVectorFallbackLogo(original) : null;
  // Preserve NCAA artwork only for schools absent from the CBS directory.
  const ncaa = !cbs && original ? teamVectorLogo(original) : null;
  const useCbs = Boolean(cbs && failedCbs !== cbs);
  const useNcaa = Boolean(ncaa && failedNcaa !== ncaa);
  const selected = useCbs ? cbs! : useNcaa ? ncaa! : src;

  return <NextImage {...props} key={typeof selected === "string" ? selected : undefined}
    src={selected} unoptimized={useCbs || useNcaa || props.unoptimized}
    onError={event => {
      if (useCbs) setFailedCbs(cbs);
      else if (useNcaa) setFailedNcaa(ncaa);
      else onError?.(event);
    }} />;
}
