import Link from "next/link";
import { notFound } from "next/navigation";
import { getEquipmentCatalog } from "@/lib/data/catalog";
import { getPracticeData } from "@/lib/data/bases";
import { getGuides } from "@/lib/content/guides";
import { isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  const catalog = getEquipmentCatalog();
  const guides = getGuides();
  const { bases } = getPracticeData();
  const withStats = catalog.items.filter((e) => e.dataQuality !== "stub");

  return (
    <main className="mx-auto w-full max-w-4xl grow px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">
        {t.site.tagline}
      </p>
      <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
        {t.home.title}
      </h1>
      <p className="mt-5 max-w-prose text-lg leading-relaxed text-muted">
        {t.home.intro}
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Card
          href={localePath(locale, "/practice")}
          title={t.home.practiceTitle}
          body={`${bases.length} bases, or build your own.`}
          featured
        />
        <Card
          href={localePath(locale, "/sim")}
          title={t.home.simTitle}
          body={t.home.simBody}
        />
        <Card
          href={localePath(locale, "/guides")}
          title={t.site.nav.guides}
          body={`${guides.length} · ${t.guides.title}`}
        />
        <Card
          href={localePath(locale, "/equipment")}
          title={t.site.nav.equipment}
          body={`${withStats.length} ${t.equipment.of} ${catalog.items.length} ${t.equipment.haveTable}`}
        />
      </div>

      <section className="card mt-16 p-6">
        <h2 className="font-medium">{t.home.statusTitle}</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          {t.site.footer.dataNote}
        </p>
      </section>
    </main>
  );
}

function Card({
  href,
  title,
  body,
  featured = false,
}: {
  href: string;
  title: string;
  body: string;
  featured?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`card flex flex-col p-5 transition-colors hover:bg-surface-raised ${
        featured ? "sm:col-span-2" : ""
      }`}
    >
      <span className={`font-medium ${featured ? "text-lg" : ""}`}>
        {title}
      </span>
      <span className="mt-2 text-sm leading-relaxed text-muted">{body}</span>
    </Link>
  );
}

export type { Locale };
