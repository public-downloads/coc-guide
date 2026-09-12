import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Metadata } from "next";
import { ClientOnly } from "@/components/ClientOnly";
import { Trainer } from "@/components/practice/Trainer";
import { getEquipmentCatalog } from "@/lib/data/catalog";
import { getPracticeData } from "@/lib/data/bases";
import { isoBuildingArt } from "@/lib/data/art";
import { encodeLayout } from "@/lib/practice/layout";
import { ABILITIES, ABILITY_IDS, type AbilityId } from "@/lib/practice/shot";
import type { Equipment } from "@/lib/schema/equipment";

export const metadata: Metadata = {
  title: "Ability practice",
  description:
    "Drill the Giant Arrow and Rocket Backpack: line up the shot on a base and see what it would actually hit.",
};

/**
 * Reserves the trainer's exact shape while it hydrates. Without this the board
 * pops in and shoves the rest of the page down.
 */
function TrainerSkeleton() {
  return (
    <div
      className="mt-8 grid animate-pulse gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]"
      aria-hidden="true"
    >
      <div className="aspect-square w-full rounded-xl border border-border bg-surface-raised" />
      <div className="flex flex-col gap-5">
        {[7, 9, 6, 5].map((rows, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface-raised"
            style={{ height: `${rows}rem` }}
          />
        ))}
      </div>
    </div>
  );
}

export default async function PracticePage({ params }: PageProps<"/[locale]/practice">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  const { buildings, bases } = getPracticeData();
  const catalog = getEquipmentCatalog();

  // Walled bases run to a few hundred buildings each. Shipping them as JSON
  // objects put ~20KB of coordinates in the page payload; the same codec the
  // share links use gets that to 3 characters per building.
  const typeIds = (buildings?.types ?? []).map((t) => t.id);
  const encodedBases = bases.map((base) => ({
    id: base.id,
    name: base.name,
    description: base.description,
    layout: encodeLayout(
      base.buildings.map((b, i) => ({ id: `b${i}`, ...b })),
      typeIds,
    ),
  }));

  const equipment: Partial<Record<AbilityId, Equipment>> = {};
  for (const id of ABILITY_IDS) {
    const piece = catalog.byId.get(ABILITIES[id].equipmentId);
    if (piece) equipment[id] = piece;
  }

  return (
    <main className="mx-auto w-full max-w-6xl grow px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{t.practice.title}</h1>
      <p className="mt-3 max-w-prose text-muted">
        {t.practice.intro}
      </p>

      {bases.length === 0 || !buildings ? (
        <p className="surface-inset mt-8 px-5 py-4 text-sm text-muted">
          No practice bases found. Add a layout under{" "}
          <code className="font-mono text-xs">data/bases/</code>.
        </p>
      ) : (
        // Suspense satisfies `useSearchParams` during prerender; ClientOnly
        // keeps the first client render equal to the exported HTML, which is
        // the skeleton. Without it the trainer hydrates into a slot holding
        // the skeleton and React throws a mismatch.
        <Suspense fallback={<TrainerSkeleton />}>
          <ClientOnly fallback={<TrainerSkeleton />}>
            <Trainer
              types={buildings.types}
              bases={encodedBases}
              equipment={equipment}
              isoArt={isoBuildingArt()}
              t={t}
              locale={locale}
            />
          </ClientOnly>
        </Suspense>
      )}

      <p className="mt-10 max-w-prose text-xs leading-relaxed text-muted">
        {t.practice.caveat}
      </p>
    </main>
  );
}
