"use client";

import NextImage, { type ImageProps } from "next/image";
import type { League } from "@/lib/types";

type Props = ImageProps & {
  scoreboardLeague?: League;
  logoBackground?: string;
  onLogoPalette?: (colors: string[]) => void;
};

/** Render ESPN's original team artwork everywhere, without alternate sources or saved choices. */
export default function TeamImage({
  scoreboardLeague: _scoreboardLeague,
  logoBackground: _logoBackground,
  onLogoPalette: _onLogoPalette,
  ...props
}: Props) {
  return <NextImage {...props} />;
}
