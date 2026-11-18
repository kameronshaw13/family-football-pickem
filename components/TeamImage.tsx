"use client";

import { useState } from "react";
import NextImage, { type ImageProps } from "next/image";
import { isTeamLogoSource, teamSvgLogo } from "@/lib/teamLogoSource";
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
  const [failed, setFailed] = useState<string | null>(null);
  const [opaqueRetry, setOpaqueRetry] = useState<string | null>(null);
  const [sample, setSample] = useState<{ source: string; values: LogoSample } | null>(null);
  const svg = typeof src === "string" ? teamSvgLogo(src) : null;
  const preferred = svg && svg !== failed ? svg : undefined;
  const values = preferred ? (sample?.source === preferred ? sample.values : sampledLogos.get(preferred)) : undefined;
  const edges = values?.edges ?? [];
  const backing = Boolean(scoreboardLeague && logoNeedsDarkBacking(edges, values?.colors));
  const outline = backing ? undefined : logoBackground && logoNeedsOutline(edges, logoBackground)
    ? "team" : logoNeedsOutline(edges, "#20282d") ? "dark" : undefined;

  if (typeof src === "string" && isTeamLogoSource(src) && !preferred) {
    const className = [props.className, scoreboardLeague ? "game-tracker-logo-fallback" : "team-artwork-fallback"].filter(Boolean).join(" ");
    return <span className={className} role={props.alt ? "img" : undefined} aria-label={props.alt || undefined}
      aria-hidden={props.alt ? undefined : true} style={{ ...props.style, width: props.width, height: props.height }}>
      {props.alt?.slice(0, 2).toUpperCase()}
    </span>;
  }

  return <NextImage {...props} key={preferred} src={preferred ?? src}
    // Retry the SAME CBS SVG without CORS if the CDN rejects canvas sampling.
    // Never fall back to a different ESPN artwork for the same team.
    crossOrigin={preferred?.startsWith("https://sports.cbsimg.net/") && opaqueRetry !== preferred ? "anonymous" : props.crossOrigin}
    data-white-outline={outline} data-logo-backing={backing || undefined}
    unoptimized={Boolean(preferred) || props.unoptimized}
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
      if (preferred && opaqueRetry !== preferred) setOpaqueRetry(preferred);
      else if (preferred) setFailed(preferred);
      onError?.(event);
    }} />;
}
