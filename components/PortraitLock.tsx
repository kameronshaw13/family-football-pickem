"use client";

import { useEffect } from "react";

type StandaloneNavigator = Navigator & { standalone?: boolean };
type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "portrait-primary") => Promise<void>;
};

export default function PortraitLock() {
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as StandaloneNavigator).standalone);
    const orientation = window.screen.orientation as LockableOrientation | undefined;
    if (!standalone || typeof orientation?.lock !== "function") return;
    const lock = orientation.lock.bind(orientation);

    function lockPortrait() {
      void lock("portrait-primary").catch(() => undefined);
    }
    function lockWhenVisible() {
      if (document.visibilityState === "visible") lockPortrait();
    }

    lockPortrait();
    window.addEventListener("orientationchange", lockPortrait);
    document.addEventListener("visibilitychange", lockWhenVisible);
    return () => {
      window.removeEventListener("orientationchange", lockPortrait);
      document.removeEventListener("visibilitychange", lockWhenVisible);
    };
  }, []);

  return null;
}
