"use client";

import { useEffect } from "react";

type AppSlug = "shaw-family" | "other-family" | "friends";

const CACHE_PREFIX = "pickem_app_data_v1:";

export default function RouteAppBootstrap({ slug }: { slug: AppSlug }) {
  useEffect(() => {
    try {
      const prior = window.sessionStorage.getItem("pickem_route_app");
      if (prior !== slug) {
        const remove: string[] = [];
        for (let index = 0; index < window.sessionStorage.length; index += 1) {
          const key = window.sessionStorage.key(index);
          if (key?.startsWith(CACHE_PREFIX)) remove.push(key);
        }
        remove.forEach((key) => window.sessionStorage.removeItem(key));
        window.sessionStorage.setItem("pickem_route_app", slug);
      }
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
