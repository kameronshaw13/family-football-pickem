import type { PickemAppSlug } from "./authUsers";

export const APP_IDENTITY_CONFIG: Record<PickemAppSlug, {
  name: string;
  homePath: string;
  loginPath: string;
  workerScope: string;
}> = {
  "shaw-family": {
    name: "Shaw Family Pick'em",
    homePath: "/",
    loginPath: "/login",
    workerScope: "/"
  },
  friends: {
    name: "Friends Pick'em",
    homePath: "/friends",
    loginPath: "/friends/login",
    workerScope: "/friends"
  },
  "other-family": {
    name: "Caleb Family Pick'em",
    homePath: "/caleb-family",
    loginPath: "/caleb-family/login",
    workerScope: "/caleb-family"
  }
};

export function isPickemAppSlug(value: string | null | undefined): value is PickemAppSlug {
  return value === "shaw-family" || value === "friends" || value === "other-family";
}

export function appSlugForPath(pathname: string): PickemAppSlug | null {
  const clean = pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;
  if (clean === "/friends" || clean.startsWith("/friends/")) return "friends";
  if (clean === "/caleb-family" || clean.startsWith("/caleb-family/") || clean === "/other-family" || clean.startsWith("/other-family/")) return "other-family";
  if (clean === "/" || clean === "/login") return "shaw-family";
  return null;
}

export function appHomePath(appSlug: PickemAppSlug) {
  return APP_IDENTITY_CONFIG[appSlug].homePath;
}

export function appLoginPath(appSlug: PickemAppSlug) {
  return APP_IDENTITY_CONFIG[appSlug].loginPath;
}

export function appWorkerScope(appSlug: PickemAppSlug) {
  return APP_IDENTITY_CONFIG[appSlug].workerScope;
}
