import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import Link from "next/link";
import { DataQualityBadge, RarityBadge } from "@/components/ui/Badge";
import { ArtIcon } from "@/components/ui/UnitChip";
import { equipmentArt } from "@/lib/data/art";
import { getEquipmentCatalog } from "@/lib/data/catalog";
import { HERO_IDS, HEROES } from "@/lib/schema/hero";
import type { Equipment } from "@/lib/schema/equipment";

export const metadata: Metadata = {
  title: "Equipment",
  description:
    "Every hero equipment piece, its rarity, level cap, and how far its stat table has been compiled.",
};

const ABILITY_LABEL: Record<Equipment["ability"]["kind"], string> = {
  passive: "Passive",
  instant: "Instant",
  duration: "Duration",
};

export default async function EquipmentIndexPage({ params }: PageProps<"/[locale]/equipment">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  const catalog = getEquipmentCatalog();
  // Resolved here: the art lookup reads the filesystem.
  const art = equipmentArt(catalog.items.map((item) => item.id));
  const withStats = catalog.items.filter((e) => e.dataQuality !== "stub");
  const heroes = HERO_IDS.filter((id) => catalog.byHero[id].length > 0);

  return (
    <main className="mx-auto w-full max-w-4xl grow px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{t.equipment.title}</h1>
      <p className="mt-3 max-w-prose text-muted">
        {t.equipment.intro}
      </p>

      <p className="mt-6 rounded-lg border border-border px-4 py-3 text-sm text-foreground/70">
        <span className="font-medium text-foreground">
          {withStats.length} of {catalog.items.length}
        </span>{" "}
        pieces have a level table.
      </p>

      {heroes.map((heroId) => (
        <section key={heroId} className="mt-12">
          <h2 className="text-xl font-medium tracking-tight">
            {HEROES[heroId].name}
          </h2>

          <ul className="mt-4 divide-y divide-border border-y border-border">
            {catalog.byHero[heroId].map((item) => (
              <li key={item.id}>
                <Link
                  href={localePath(locale, `/equipment/${item.id}`)}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 py-4 transition-colors hover:bg-surface-raised"
                >
                  <ArtIcon id={item.id} src={art[item.id]} size="md" />
                  <span className="font-medium">{item.name}</span>
                  <RarityBadge rarity={item.rarity} />
                  <span className="text-xs text-muted">
                    max {item.maxLevel} · {ABILITY_LABEL[item.ability.kind]}
                  </span>
                  <span className="ml-auto">
                    <DataQualityBadge quality={item.dataQuality} />
                  </span>
                  <p className="w-full text-xs leading-relaxed text-muted">
                    {item.ability.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
