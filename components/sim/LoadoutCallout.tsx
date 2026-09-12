import Link from "next/link";
import { DataQualityBadge } from "@/components/ui/Badge";
import { getEquipmentCatalog } from "@/lib/data/catalog";
import { HEROES, heroFromDirSlug } from "@/lib/schema/hero";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/lib/i18n/config";

/**
 * Embedded in guide MDX to state the loadout an attack assumes:
 *
 *   <LoadoutCallout hero="queen" e1="frozen-arrow:12" e2="healer-puppet:18" />
 *
 * It renders from the live catalog rather than a screenshot, so it goes stale
 * loudly (an unknown piece shows as missing) instead of quietly.
 */
export function LoadoutCallout({
  hero,
  e1,
  e2,
  note,
  locale = DEFAULT_LOCALE,
}: {
  hero: string;
  e1?: string;
  e2?: string;
  note?: string;
  locale?: Locale;
}) {
  const heroId = heroFromDirSlug(hero);
  if (!heroId) {
    return <Callout>Unknown hero &ldquo;{hero}&rdquo;.</Callout>;
  }

  const catalog = getEquipmentCatalog();
  const slots = [e1, e2].filter((s): s is string => Boolean(s)).map((raw) => {
    const [id, rawLevel] = raw.split(":");
    const equipment = catalog.byId.get(id);
    const level = Number(rawLevel ?? 1);
    return { id, equipment, level: Number.isInteger(level) ? level : 1 };
  });

  const query = [e1 && `e1=${e1}`, e2 && `e2=${e2}`]
    .filter(Boolean)
    .join("&");

  return (
    <Callout>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        Assumed loadout
      </p>
      <p className="mt-1 font-medium">{HEROES[heroId].name}</p>

      <ul className="mt-3 space-y-2 text-sm">
        {slots.map((slot) => (
          <li key={slot.id} className="flex flex-wrap items-center gap-2">
            {slot.equipment ? (
              <>
                <Link
                  href={localePath(locale, `/equipment/${slot.id}`)}
                  className="font-medium underline decoration-foreground/20 underline-offset-4 hover:decoration-foreground/60"
                >
                  {slot.equipment.name}
                </Link>
                <span className="text-muted">level {slot.level}</span>
                <DataQualityBadge quality={slot.equipment.dataQuality} />
              </>
            ) : (
              <span className="text-amber-700 dark:text-amber-300">
                {slot.id} is not in the catalogue — this guide may be out of date
              </span>
            )}
          </li>
        ))}
      </ul>

      {note && (
        <p className="mt-3 text-sm leading-relaxed text-muted">{note}</p>
      )}

      <Link
        href={localePath(locale, `/sim/${hero}${query ? `?${query}` : ""}`)}
        className="mt-4 inline-flex items-center gap-2 text-sm font-medium underline decoration-foreground/20 underline-offset-4 hover:decoration-foreground/60"
      >
        Open this build in the simulator
        <span aria-hidden="true">→</span>
      </Link>
    </Callout>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <aside className="my-8 rounded-xl border border-border bg-foreground/[0.02] p-5">
      {children}
    </aside>
  );
}
