"use client";

import { useState } from "react";
import NextImage, { type ImageProps } from "next/image";
import { teamLogoCandidates } from "@/lib/teamLogoSource";
import { logoNeedsDarkBacking, logoNeedsOutline, readLogoEdges, readLogoPalette } from "@/lib/trackerTeamColors";
import type { League } from "@/lib/types";

type LogoSample = { edges: number[]; colors: string[] };
const sampledLogos = new Map<string, LogoSample>();
const sampleSize = 32;

function sampleLogo(image: HTMLImageElement): LogoSample {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = sampleSize;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { edges: [], colors: [] };
  const scale = sampleSize / Math.max(image.naturalWidth, image.naturalHeight);
  const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
  try {
    context.drawImage(image, (sampleSize - width) / 2, (sampleSize - height) / 2, width, height);
    const { data } = context.getImageData(0, 0, sampleSize, sampleSize);
    return { edges: readLogoEdges(data, sampleSize), colors: readLogoPalette(data) };
  } catch {
    return { edges: [], colors: [] };
  }
}

type Props = ImageProps & { scoreboardLeague?: League; logoBackground?: string; onLogoPalette?: (colors: string[]) => void };

export default function TeamImage({ src, onError, onLoad, scoreboardLeague, logoBackground, onLogoPalette, ...props }: Props) {
  const [attempt, setAttempt] = useState<{ key: string; index: number } | null>(null);
  const [sample, setSample] = useState<{ source: string; values: LogoSample } | null>(null);
  const candidates = typeof src === "string" ? teamLogoCandidates(src, scoreboardLeague) : [];
  const key = candidates.join("|");
  const index = attempt?.key === key ? attempt.index : 0;
  const preferred = candidates[index];
  const values = preferred ? (sample?.source === preferred ? sample.values : sampledLogos.get(preferred)) : undefined;
  const edges = values?.edges ?? [];
  const backing = Boolean(scoreboardLeague && logoNeedsDarkBacking(edges, values?.colors));
  const outline = backing ? undefined : logoBackground && logoNeedsOutline(edges, logoBackground)
    ? "team" : logoNeedsOutline(edges, "#20282d") ? "dark" : undefined;

  return <NextImage {...props} key={preferred ?? key} src={preferred ?? src}
    crossOrigin={preferred?.startsWith("https://sports.cbsimg.net/") ? "anonymous" : props.crossOrigin}
    data-white-outline={outline} data-logo-backing={backing || undefined}
    unoptimized={Boolean(candidates.length) || props.unoptimized}
    onLoad={event => {
      if (preferred) {
        let values = sampledLogos.get(preferred);
        if (!values) {
          values = sampleLogo(event.currentTarget);
          if (sampledLogos.size >= 512) sampledLogos.clear();
          sampledLogos.set(preferred, values);
        }
        setSample({ source: preferred, values });
        onLogoPalette?.(values.colors);
      }
      onLoad?.(event);
    }}
    onError={event => {
      if (preferred) setAttempt({ key, index: index + 1 });
      else onError?.(event);
    }} />;
}
