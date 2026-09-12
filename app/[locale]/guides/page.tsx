import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { GuideIndex } from "@/components/guides/GuideIndex";
import { equipmentArt, unitArt } from "@/lib/data/art";
import { getUnits } from "@/lib/data/units";
import { LEVELLED } from "@/lib/schema/unit";
import {
  allArmyComps,
  allThLevels,
  getGuideIssues,
  getGuides,
} from "@/lib/content/guides";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Attack strategy guides, filterable by Town Hall level and army composition.",
};

export default async function GuidesIndexPage({ params }: PageProps<"/[locale]/guides">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  const guides = getGuides();
  // Heroes, pets and equipment can appear in a comp, but nobody filters the
  // index by "Frozen Arrow" — chips stay to troops, spells and sieges.
  const registry = getUnits().byId;
  const armyComps = allArmyComps(guides).filter((tag) => {
    const category = registry.get(tag)?.category;
    return !category || !LEVELLED.has(category);
  });
  // Only ever non-empty in development — a bad guide fails the build.
  const issues = getGuideIssues();

  return (
    <main className="mx-auto w-full max-w-4xl grow px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{t.guides.title}</h1>
      <p className="mt-3 max-w-prose text-muted">
        {t.guides.intro}
        <span className="mt-2 block text-xs">{t.guides.englishOnly}</span>
      </p>

      {issues.length > 0 && (
        // Untranslated on purpose: this is an authoring surface that never
        // reaches a reader.
        <aside className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-medium">
            {new Set(issues.map((issue) => issue.file)).size} guide file(s) not
            loading — fix the frontmatter and they appear here
          </p>
          <ul className="mt-2 flex flex-col gap-1 font-mono text-xs">
            {issues.map((issue) => (
              <li key={`${issue.file}-${issue.message}`}>
                {issue.file} — {issue.message}
              </li>
            ))}
          </ul>
        </aside>
      )}

      <GuideIndex
        guides={guides.map((g) => g.meta)}
        thLevels={allThLevels(guides)}
        armyComps={armyComps}
        // Resolved here because the index is a client component and the
        // lookup reads the filesystem.
        art={{ ...unitArt(allArmyComps(guides)), ...equipmentArt(allArmyComps(guides)) }}
        t={t}
        locale={locale}
      />
    </main>
  );
}
