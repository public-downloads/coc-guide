"use client";

import { useSyncExternalStore, type ReactNode } from "react";

/**
 * Renders `fallback` until mounted, then the children.
 *
 * Needed for anything whose first render depends on the URL query. With
 * `output: "export"` there is no request at build time, so `useSearchParams`
 * yields nothing and the prerendered HTML holds the fallback; the client then
 * renders real content into that slot and React reports a hydration mismatch
 * (#418) before recovering. Matching the first client render to the HTML
 * removes the mismatch, at the cost of one extra render.
 */
export function ClientOnly({
  fallback,
  children,
}: {
  fallback: ReactNode;
  children: ReactNode;
}) {
  // Nothing to subscribe to — the two snapshots are the whole point: `false`
  // while rendering to HTML, `true` once running in a browser. Same mechanism
  // ThemeToggle uses, and unlike a setState-in-effect it is a single render.
  const hydrated = useSyncExternalStore(subscribe, onClient, onServer);

  return <>{hydrated ? children : fallback}</>;
}

const subscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;
