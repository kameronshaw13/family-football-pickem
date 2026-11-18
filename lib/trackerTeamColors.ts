type RGB = [number, number, number];

function rgb(value: string | null | undefined): RGB | null {
  const hex = value?.replace(/^#/, "");
  return hex && /^[\da-f]{6}$/i.test(hex)
    ? [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16)) as RGB
    : null;
}

export function logoLuminance(red: number, green: number, blue: number) {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  };
  return .2126 * linear(red) + .7152 * linear(green) + .0722 * linear(blue);
}

function tint(color: RGB, multiplier: number) {
  return "#" + color.map(value => Math.round(value * multiplier).toString(16).padStart(2, "0")).join("");
}

export function trackerTeamColors(primary?: string | null, secondary?: string | null, artwork: string[] = []) {
  const first = rgb(primary);
  const second = rgb(secondary);
  const usable = (color: RGB | null): color is RGB => color != null && logoLuminance(...color) < .88;
  const base = usable(first) ? first : usable(second) ? second : [82, 96, 110] as RGB;
  const distinct = (color: RGB | null): color is RGB => usable(color)
    && color.some((value, index) => Math.abs(value - base[index]) >= 40);
  const alternate = distinct(second) ? second : artwork.map(rgb).find(distinct);
  const accent = alternate ? tint(alternate, 1)
    : Math.max(...base) < 90 ? tint(base.map(value => value * .64 + 92) as RGB, 1) : tint(base, .62);
  const backing = logoLuminance(...base) < .18 ? tint(base, 1) : tint(base, .55);
  return { primary: tint(base, 1), secondary: accent, backing };
}

export function readLogoEdges(data: Uint8ClampedArray, size: number): number[] {
  const alpha = (x: number, y: number) => x < 0 || y < 0 || x >= size || y >= size
    ? 0 : data[(y * size + x) * 4 + 3];
  const edges: number[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (alpha(x, y) < 200 || Math.min(alpha(x - 1, y), alpha(x + 1, y), alpha(x, y - 1), alpha(x, y + 1)) > 90) continue;
      const offset = (y * size + x) * 4;
      edges.push(logoLuminance(data[offset], data[offset + 1], data[offset + 2]));
    }
  }
  return edges;
}

export function logoNeedsOutline(edges: number[], background: string) {
  const color = rgb(background);
  if (!color || !edges.length) return false;
  const surface = logoLuminance(...color);
  if (1.05 / (surface + .05) < 2.4) return false;
  if (edges.filter(edge => edge >= .84).length / edges.length >= .45) return false;
  const blendsIn = edges.filter(edge => (Math.max(edge, surface) + .05) / (Math.min(edge, surface) + .05) < 2);
  return blendsIn.length / edges.length >= .3;
}

export function logoNeedsDarkBacking(edges: number[], palette: string[] = []) {
  if (!edges.length || edges.filter(edge => edge >= .54).length / edges.length < .7) return false;
  // White trim around a colored logo already has a visible interior.
  return !palette.map(rgb).some(color => color != null && logoLuminance(...color) < .48);
}

/** Quantize opaque logo pixels so the stripe can reuse an artwork color. */
export function readLogoPalette(data: Uint8ClampedArray): string[] {
  const colors = new Map<number, { color: string; count: number }>();
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] < 230) continue;
    const [red, green, blue] = [data[offset], data[offset + 1], data[offset + 2]];
    if (logoLuminance(red, green, blue) >= .88) continue;
    const key = (red >> 5) * 64 + (green >> 5) * 8 + (blue >> 5);
    const existing = colors.get(key);
    if (existing) existing.count++;
    else colors.set(key, { color: tint([red, green, blue], 1), count: 1 });
  }
  return [...colors.values()].filter(entry => entry.count >= 5)
    .sort((a, b) => b.count - a.count).slice(0, 8).map(entry => entry.color);
}
