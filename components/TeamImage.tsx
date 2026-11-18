"use client";

import { useState, useSyncExternalStore } from "react";
import NextImage, { type ImageProps } from "next/image";
import { teamVectorFallbackLogo, teamVectorLogo } from "@/lib/teamLogoSource";
import { getLogoStudioPreferences, LOGO_STUDIO_EVENT, resolvePersonalLogo } from "@/lib/logoStudio";
import type { League } from "@/lib/types";

type Props = ImageProps & {
  scoreboardLeague?: League;
  logoBackground?: string;
  onLogoPalette?: (colors: string[]) => void;
};

function subscribeLogoChoices(callback: () => void) {
  window.addEventListener(LOGO_STUDIO_EVENT, callback);
  return () => window.removeEventListener(LOGO_STUDIO_EVENT, callback);
}

/** Consistent team logo resolution across scoreboards, picks, and game previews. */
export default function TeamImage({
  src, onError, scoreboardLeague: _scoreboardLeague,
  logoBackground: _logoBackground, onLogoPalette: _onLogoPalette, ...props
}: Props) {
  useSyncExternalStore(subscribeLogoChoices, getLogoStudioPreferences, () => null);
  const [failedPreferred, setFailedPreferred] = useState<string | null>(null);
  const [failedCbs, setFailedCbs] = useState<string | null>(null);
  const [failedNcaa, setFailedNcaa] = useState<string | null>(null);
  const original = typeof src === "string" ? src : "";
  const personal = original ? resolvePersonalLogo(original) : null;
  const cbs = original ? teamVectorFallbackLogo(original) : null;
  const ncaa = !cbs && original ? teamVectorLogo(original) : null;
  const usePreferred = Boolean(personal && personal !== failedPreferred);
  const useCbs = Boolean(cbs && cbs !== failedCbs);
  const useNcaa = Boolean(ncaa && ncaa !== failedNcaa);
  const selected = usePreferred ? personal! : useCbs ? cbs! : useNcaa ? ncaa! : src;

  return <NextImage {...props} key={typeof selected === "string" ? selected : undefined}
    src={selected} unoptimized={usePreferred || useCbs || useNcaa || props.unoptimized}
    onError={event => {
      if (usePreferred) setFailedPreferred(personal);
      else if (useCbs) setFailedCbs(cbs);
      else if (useNcaa) setFailedNcaa(ncaa);
      else onError?.(event);
    }} />;
}
