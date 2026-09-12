"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { localePath, type Locale } from "@/lib/i18n/config";

/**
 * `/sim?hero=queen&e1=…` is the shareable form from the plan, and it used to
 * be redirected on the server. A static export has no server, so the hop
 * happens in the browser instead: the page renders normally and this replaces
 * the URL once, keeping old links working without adding a history entry.
 *
 * Renders nothing. Must sit inside a `<Suspense>` boundary — `useSearchParams`
 * opts a statically rendered page into client-side bailout otherwise.
 */
export function HeroQueryRedirect({
  locale,
  heroSlugs,
}: {
  locale: Locale;
  /** Directory slugs that have a page, so an unknown hero stays put. */
  heroSlugs: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const hero = params.get("hero");
    if (!hero || !heroSlugs.includes(hero)) return;

    const rest = new URLSearchParams(params.toString());
    rest.delete("hero");
    const query = rest.toString();

    router.replace(
      localePath(locale, query ? `/sim/${hero}?${query}` : `/sim/${hero}`),
    );
  }, [params, router, locale, heroSlugs]);

  return null;
}
