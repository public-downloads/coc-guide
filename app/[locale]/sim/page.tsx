import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { HeroQueryRedirect } from "@/components/sim/HeroQueryRedirect";
import { getEquipmentCatalog } from "@/lib/data/catalog";
import { getHeroStats } from "@/lib/data/heroes";
import { HERO_IDS, HEROES } from "@/lib/schema/hero";

export const metadata: Metadata = {
  title: "Simulator",
  description:
    "Compare hero equipment loadouts and share the result as a link.",
};

export default async function SimIndexPage({
  params: routeParams,
}: PageProps<"/[locale]/sim">) {
  const { locale } = await routeParams;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  const catalog = getEquipmentCatalog();
  const heroes = getHeroStats();

  return (
    <main className="mx-auto w-full max-w-4xl grow px-6 py-12">
      {/*
        The plan's shareable form is /sim?hero=queen&e1=… — still accepted, but
        the hop to the canonical per-hero path happens in the browser now. A
        static export has no server to redirect from.
      */}
      <Suspense fallback={null}>
        <HeroQueryRedirect
          locale={locale}
          heroSlugs={HERO_IDS.map((id) => HEROES[id].dirSlug)}
        />
      </Suspense>

      <h1 className="text-3xl font-bold tracking-tight">{t.sim.title}</h1>
      <p className="mt-3 max-w-prose text-muted">
        {t.sim.intro}
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {HERO_IDS.map((heroId) => {
          const pieces = catalog.byHero[heroId];
          const stats = heroes.byId.get(heroId);
          const ready = pieces.length > 0;

          return (
            <li key={heroId}>
              <Link
                href={localePath(locale, `/sim/${HEROES[heroId].dirSlug}`)}
                aria-disabled={!ready}
                className={`flex items-center justify-between rounded-xl border border-border px-5 py-4 transition-colors ${
                  ready ? "hover:bg-surface-raised" : "opacity-50"
                }`}
              >
                <span>
                  <span className="font-medium">{HEROES[heroId].name}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {pieces.length === 0
                      ? "no equipment catalogued yet"
                      : `${pieces.length} piece${pieces.length === 1 ? "" : "s"}`}
                    {stats?.maxLevel !== null && stats?.maxLevel !== undefined
                      ? ` · cap ${stats.maxLevel}`
                      : ""}
                  </span>
                </span>
                <span aria-hidden="true" className="text-foreground/30">
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
