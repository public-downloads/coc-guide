import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DataQualityBadge, RarityBadge } from "@/components/ui/Badge";
import { ArtIcon } from "@/components/ui/UnitChip";
import { findEquipmentImage } from "@/lib/data/art";
import { getEquipmentCatalog } from "@/lib/data/catalog";
import { formatNumber, humaniseKey } from "@/lib/format";
import { cumulativeOreCost } from "@/lib/schema/equipment";
import { HEROES } from "@/lib/schema/hero";

export function generateStaticParams() {
  return getEquipmentCatalog().items.map((item) => ({ slug: item.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/equipment/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const item = getEquipmentCatalog().byId.get(slug);
  if (!item) return {};

  return {
    title: item.name,
    description: `${item.name} — ${item.rarity} ${HEROES[item.hero].name} equipment. ${item.ability.description}`,
  };
}

export default async function EquipmentDetailPage({
  params,
}: PageProps<"/[locale]/equipment/[slug]">) {
  const { slug, locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const item = getEquipmentCatalog().byId.get(slug);
  if (!item) notFound();

  const effectKeys = item.effectKeys;

  return (
    <main className="mx-auto w-full max-w-4xl grow px-6 py-12">
      <p className="text-sm text-muted">
        <Link href={localePath(locale, "/equipment")} className="hover:text-foreground">
          {t.equipment.title}
        </Link>
        {" / "}
        <Link
          href={localePath(locale, `/sim/${HEROES[item.hero].dirSlug}`)}
          className="hover:text-foreground"
        >
          {HEROES[item.hero].name}
        </Link>
      </p>

      <div className="mt-2 flex items-center gap-3">
        <ArtIcon id={item.id} src={findEquipmentImage(item.id)} size="lg" />
        <h1 className="text-3xl font-bold tracking-tight">{item.name}</h1>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <RarityBadge rarity={item.rarity} />
        <DataQualityBadge quality={item.dataQuality} />
        <span className="text-xs text-muted">
          max level {item.maxLevel} · {item.ability.kind} · patch{" "}
          {item.gameVersion}
        </span>
      </div>

      <p className="mt-4 max-w-prose text-foreground/70">
        {item.ability.description}
      </p>

      <Link
        href={localePath(locale, `/sim/${HEROES[item.hero].dirSlug}?e1=${item.id}:${item.maxLevel}`)}
        className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-border-strong px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-raised"
      >
        Open in simulator
        <span aria-hidden="true">→</span>
      </Link>

      {item.levels.length === 0 ? (
        <section className="mt-10 rounded-xl border border-dashed border-border-strong px-5 py-8 text-center">
          <p className="font-medium">No level table yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            These numbers are compiled by hand from patch notes. Fill in{" "}
            <code className="font-mono text-xs">
              data/equipment/{HEROES[item.hero].dirSlug}/{item.id}.json
            </code>{" "}
            and set <code className="font-mono text-xs">dataQuality</code> to{" "}
            <code className="font-mono text-xs">unverified</code>; the table
            below renders itself from the file.
          </p>
        </section>
      ) : (
        <section className="mt-10">
          <h2 className="text-xl font-medium tracking-tight">Level table</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-2xl border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-4 font-medium">Lvl</th>
                  <th className="py-2 pr-4 text-right font-medium">DPS</th>
                  <th className="py-2 pr-4 text-right font-medium">HP</th>
                  {effectKeys.map((key) => (
                    <th key={key} className="py-2 pr-4 text-right font-medium">
                      {humaniseKey(key)}
                    </th>
                  ))}
                  <th className="py-2 pr-4 text-right font-medium">Shiny</th>
                  <th className="py-2 pr-4 text-right font-medium">Glowy</th>
                  <th className="py-2 pr-4 text-right font-medium">Starry</th>
                  <th className="py-2 text-right font-medium">Total shiny</th>
                </tr>
              </thead>
              <tbody>
                {item.levels.map((level) => (
                  <tr
                    key={level.lvl}
                    className="border-b border-border tabular-nums"
                  >
                    <td className="py-2 pr-4 font-medium">{level.lvl}</td>
                    <td className="py-2 pr-4 text-right">{level.dmg}</td>
                    <td className="py-2 pr-4 text-right">{level.hp}</td>
                    {effectKeys.map((key) => (
                      <td key={key} className="py-2 pr-4 text-right">
                        {level.effect[key] ?? "—"}
                      </td>
                    ))}
                    <td className="py-2 pr-4 text-right text-muted">
                      {formatNumber(level.oreCost.shiny)}
                    </td>
                    <td className="py-2 pr-4 text-right text-muted">
                      {formatNumber(level.oreCost.glowy)}
                    </td>
                    <td className="py-2 pr-4 text-right text-muted">
                      {formatNumber(level.oreCost.starry)}
                    </td>
                    <td className="py-2 text-right text-muted">
                      {formatNumber(cumulativeOreCost(item, level.lvl).shiny)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {item.sources.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Sources
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {item.sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </section>
      )}

      {item.notes.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Notes
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {item.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
