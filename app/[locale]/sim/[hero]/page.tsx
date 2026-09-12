import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { Simulator } from "@/components/sim/Simulator";
import { getEquipmentCatalog } from "@/lib/data/catalog";
import { getHeroStats } from "@/lib/data/heroes";
import { HERO_IDS, HEROES, heroFromDirSlug } from "@/lib/schema/hero";

export function generateStaticParams() {
  return HERO_IDS.map((heroId) => ({ hero: HEROES[heroId].dirSlug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sim/[hero]">): Promise<Metadata> {
  const { hero } = await params;
  const heroId = heroFromDirSlug(hero);
  if (!heroId) return {};

  return {
    title: `${HEROES[heroId].name} simulator`,
    description: `Compare ${HEROES[heroId].name} equipment loadouts and share the build as a link.`,
  };
}

export default async function HeroSimPage({ params }: PageProps<"/[locale]/sim/[hero]">) {
  const { hero: dirSlug, locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const heroId = heroFromDirSlug(dirSlug);
  if (!heroId) notFound();

  const stats = getHeroStats().byId.get(heroId);
  if (!stats) notFound();

  const equipment = getEquipmentCatalog().byHero[heroId];

  return (
    <main className="mx-auto w-full max-w-4xl grow px-6 py-12">
      <p className="text-sm text-muted">
        <Link href={localePath(locale, "/sim")} className="hover:text-foreground">
          {t.sim.title}
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        {HEROES[heroId].name}
      </h1>

      {equipment.length === 0 ? (
        <p className="mt-6 rounded-lg border border-border px-4 py-3 text-sm text-muted">
          No equipment catalogued for {HEROES[heroId].name} yet. Add files under{" "}
          <code className="font-mono text-xs">
            data/equipment/{dirSlug}/
          </code>{" "}
          and they will appear here.
        </p>
      ) : (
        <Suspense
          fallback={
            <p className="mt-8 text-sm text-muted">Loading build…</p>
          }
        >
          <Simulator hero={stats} equipment={equipment} t={t} />
        </Suspense>
      )}
    </main>
  );
}
