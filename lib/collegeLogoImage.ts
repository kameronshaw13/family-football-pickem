/**
 * Historical NCAA artwork is served through a narrow same-origin image path.
 * This also avoids third-party hotlink/referrer rules when displaying thumbnails.
 * NBA/NFL and ordinary modern logos are intentionally left unchanged.
 */
const COLLEGE_IMAGE_PATH = /^\/logos\/(?:30|31|32|33|34|35)\/\d+\/full\/[a-zA-Z0-9_.-]+\.(?:png|gif|webp|jpe?g)$/;
const SPORTS_LOGO_HISTORY_PATH = /^\/wp-content\/uploads\/\d{4}\/\d{2}\/[a-zA-Z0-9_.-]+\.(?:png|gif|webp|jpe?g)$/;
function permittedVintageImage(url: URL) {
  return (url.hostname === "content.sportslogos.net" && COLLEGE_IMAGE_PATH.test(url.pathname))
    || (url.hostname === "sportslogohistory.com" && SPORTS_LOGO_HISTORY_PATH.test(url.pathname));
}
export function collegeHistoricalImageSource(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" && permittedVintageImage(parsed))
      return "/api/college-logo-image?src=" + encodeURIComponent(parsed.href);
  } catch { /* Ordinary local source. */ }
  return url;
}

export function isCollegeHistoricalImage(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && permittedVintageImage(u)
      && !u.search && !u.hash;
  } catch { return false; }
}
