"use client";

import { useEffect } from "react";

type AppSlug = "shaw-family" | "other-family" | "friends";

export default function RouteAppBootstrap({ slug }: { slug: AppSlug }) {
  useEffect(() => {
    try {
      // App-data caches are already namespaced by app slug and validated against
      // the signed-in profile, so switching routes should not wipe another app's
      // warm startup state.
      window.sessionStorage.setItem("pickem_route_app", slug);
    } catch {
      // Storage is optional; route identity is still enforced server-side.
    }
    document.documentElement.dataset.pickemGroup = slug;
    document.documentElement.dataset.pickemTheme = "shaw-retro";
    return () => {
      if (document.documentElement.dataset.pickemGroup === slug) {
        delete document.documentElement.dataset.pickemGroup;
        delete document.documentElement.dataset.pickemTheme;
      }
    };
  }, [slug]);

  return null;
}
