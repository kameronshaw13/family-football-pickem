import { renderHubAppIcon } from "@/lib/hubAppIcon";

export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return renderHubAppIcon(size.width);
}
