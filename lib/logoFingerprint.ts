import { createHash } from "node:crypto";

function hash(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

/** Treat colorway-only SVGs as the same mark; keep geometrically different logos. */
export function contentFingerprint(bytes: Uint8Array, mime: string): string {
  if (!mime.includes("svg") && !Buffer.from(bytes).subarray(0, 256).toString().includes("<svg")) return hash(bytes);
  const xml = Buffer.from(bytes).toString("utf8");
  const shapes = [...xml.matchAll(/<(path|polygon|polyline|rect|circle|ellipse|line)\b([^>]*?)\/?>/gi)]
    .map(match => {
      const attrs = [...match[2].matchAll(/\b(d|points|x|y|x1|y1|x2|y2|cx|cy|rx|ry|r|width|height)\s*=\s*(["'])(.*?)\2/gi)]
        .map(a => [a[1].toLowerCase(), a[3].replace(/[\s,]+/g, " ").trim()])
        .sort(([a], [b]) => a.localeCompare(b));
      return match[1].toLowerCase() + ":" + JSON.stringify(attrs);
    });
  if (!shapes.length) return hash(bytes);
  const viewBox = xml.match(/\bviewBox\s*=\s*(["'])(.*?)\1/i)?.[2] || "";
  return hash("svg:" + viewBox.replace(/[\s,]+/g, " ").trim() + ":" + shapes.join("|"));
}
