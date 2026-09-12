"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { UnitIcon } from "@/components/ui/UnitChip";
import { humaniseTag } from "@/lib/format";
import type { GuideMeta } from "@/lib/content/guides";
import { localised } from "@/lib/content/guide-frontmatter";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Filtering is client-side on purpose: the whole guide index is a handful of
 * kilobytes, and keeping it in one static page beats a round trip per filter.
 */
export function GuideIndex({
  guides,
  thLevels,
  armyComps,
  art,
  t,
  locale,
}: {
  guides: GuideMeta[];
  thLevels: number[];
  armyComps: string[];
  /** unit id -> public art path, resolved server-side. Missing = no art yet. */
  art: Record<string, string>;
  t: Dictionary;
  locale: Locale;
}) {
  const [th, setTh] = useState<number | null>(null);
  const [comp, setComp] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      guides.filter(
        (guide) =>
          (th === null || guide.thLevel === th) &&
          (comp === null || guide.armyComp.includes(comp)),
      ),
    [guides, th, comp],
  );

  return (
    <>
      <div className="mt-8 flex flex-col gap-4">
        <FilterRow label={t.guides.townHall}>
          <Chip active={th === null} onClick={() => setTh(null)}>
            {t.guides.any}
          </Chip>
          {thLevels.map((level) => (
            <Chip
              key={level}
              active={th === level}
              onClick={() => setTh(th === level ? null : level)}
            >
              TH{level}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label={t.guides.army}>
          <Chip active={comp === null} onClick={() => setComp(null)}>
            {t.guides.any}
          </Chip>
          {armyComps.map((tag) => (
            <Chip
              key={tag}
              active={comp === tag}
              onClick={() => setComp(comp === tag ? null : tag)}
            >
              <span className="flex items-center gap-1.5">
                <UnitIcon id={tag} src={art[tag]} size="sm" />
                {humaniseTag(tag)}
              </span>
            </Chip>
          ))}
        </FilterRow>
      </div>

      <p className="mt-6 text-sm text-muted">
        {filtered.length} {t.guides.countOf} {guides.length} {t.guides.guidesWord}
      </p>

      {filtered.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border-strong px-5 py-8 text-center text-sm text-muted">
          {t.guides.noMatch}
        </p>
      ) : (
        // Slabs rather than a divided list: the game's menus are stacks of
        // thick-edged panels, and a guide is one entry in such a stack.
        <ul className="mt-4 flex flex-col gap-3">
          {filtered.map((guide) => {
            const text = localised(guide, locale);
            return (
            <li key={guide.slug}>
              <Link
                href={localePath(locale, `/guides/${guide.slug}`)}
                className="card block overflow-hidden p-0 transition-colors hover:border-accent"
              >
                <div className="ribbon">
                  <span className="normal-case tracking-normal">{text.title}</span>
                  <span className="counter">TH{guide.thLevel}</span>
                  <Badge>{guide.difficulty}</Badge>
                  {guide.draft && (
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                      draft
                    </Badge>
                  )}
                  <span className="ml-auto text-[0.65rem] font-normal normal-case tracking-normal text-muted">
                    {t.guides.updated} {guide.updatedAt} · {t.guides.patch} {guide.patch}
                  </span>
                </div>
                <div className="px-4 py-4">
                  <p className="max-w-prose text-sm leading-relaxed text-muted">
                    {text.summary}
                  </p>
                  <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    {guide.armyComp.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1.5">
                        <UnitIcon id={tag} src={art[tag]} size="sm" />
                        {humaniseTag(tag)}
                      </span>
                    ))}
                  </p>
                </div>
              </Link>
            </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  // `.btn` rather than a hairline pill: the game's filters are slabs that
  // press down onto their own edge, and that weight is set in globals.css.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`btn px-3 py-1 text-sm ${
        active ? "btn-active" : "bg-surface text-muted"
      }`}
    >
      {children}
    </button>
  );
}
