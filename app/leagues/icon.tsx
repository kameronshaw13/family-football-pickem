import { renderHubAppIcon } from "@/lib/hubAppIcon";

export const runtime = "nodejs";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default async function Icon() {
  return renderHubAppIcon(size.width);
}
