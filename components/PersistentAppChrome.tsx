"use client";

import { createContext, useContext, useLayoutEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { usePathname } from "next/navigation";
import LeagueHeaderWordmark from "@/components/LeagueHeaderWordmark";
import PrimaryBottomNav from "@/components/PrimaryBottomNav";

type Chrome = { header: ReactNode; nav: ReactNode };
const ChromeContext = createContext<Dispatch<SetStateAction<Chrome | null>> | null>(null);
const appPaths = new Set(["/", "/friends", "/friends-basketball", "/caleb-family"]);
const ignoreSelection = () => undefined;

/** Root-layout ownership keeps fixed controls mounted across league routes and
 * data refreshes. Only the route's content is replaced by Next navigation. */
export function PersistentAppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [chrome, setChrome] = useState<Chrome | null>(null);
  const visible = appPaths.has(pathname);
  const slug = pathname === "/friends-basketball" ? "friends-basketball" : pathname === "/friends" ? "friends" : pathname === "/caleb-family" ? "other-family" : "shaw-family";
  return <ChromeContext.Provider value={setChrome}>
    {visible && (chrome?.header ?? <header className="scoreboard-header"><div className="scoreboard-main"><LeagueHeaderWordmark slug={slug} /><div className="header-actions"><div className="header-slate"><span>Week</span></div></div></div></header>)}
    {visible && (chrome?.nav ?? <PrimaryBottomNav activeTab="picks" counts={{}} onSelect={ignoreSelection} />)}
    {children}
  </ChromeContext.Provider>;
}

/** Publish before paint; retain the previous controls during route handoff. */
export function AppChrome({ header, nav }: Chrome) {
  const publish = useContext(ChromeContext);
  useLayoutEffect(() => { publish?.({ header, nav }); }, [publish, header, nav]);
  return null;
}
