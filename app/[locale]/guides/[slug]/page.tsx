import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { compileMDX } from "next-mdx-remote/rsc";
import { Army } from "@/components/guides/Army";
import { Figure } from "@/components/guides/Figure";
import { GuideVideo } from "@/components/guides/GuideVideo";
import { LoadoutCallout } from "@/components/sim/LoadoutCallout";
import { Badge } from "@/components/ui/Badge";
import { bodyFor, getGuide, getGuides, localised } from "@/lib/content/guides";



export function generateStaticParams() {
  return getGuides().map((guide) => ({ slug: guide.meta.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/guides/[slug]">): Promise<Metadata> {
  const { slug, locale } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};

  // Each locale is separately indexable, so its metadata has to be its own.
  const text = localised(guide.meta, locale);
  return { title: text.title, description: text.summary };
}

export default async function GuidePage({ params }: PageProps<"/[locale]/guides/[slug]">) {
  const { slug, locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const guide = getGuide(slug);
  if (!guide) notFound();

  const components = {
    // Bound to the current locale so links inside guides stay in-language.
    LoadoutCallout: (props: React.ComponentProps<typeof LoadoutCallout>) => (
      <LoadoutCallout {...props} locale={locale} />
    ),
    GuideVideo,
    // Bound to this guide's Town Hall so army totals are measured against the
    // camps it actually has.
    Army: (props: React.ComponentProps<typeof Army>) => (
      <Army townHall={guide.meta.thLevel} {...props} />
    ),
    Figure,
  };

  const text = localised(guide.meta, locale);
  const body = bodyFor(guide, locale);
  const translated = body !== guide.body;

  const { content } = await compileMDX({
    source: body,
    components,
    options: { parseFrontmatter: false },
  });

  return (
    /*
      Wider than a pure prose column: the army board is a wide thing and at
      max-w-2xl it was squeezed into a third of a desktop window with the rest
      of the page empty. The prose itself is held to a readable measure below,
      so widening the page gives the board room without giving the paragraphs
      an unreadable line length.
    */
    <main className="mx-auto w-full max-w-4xl grow px-6 py-12">
      <p className="text-sm text-muted">
        <Link href={localePath(locale, "/guides")} className="hover:text-foreground">
          {t.guides.title}
        </Link>
      </p>

      <h1 className="mt-2 text-3xl font-bold tracking-tight">{text.title}</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge>TH{guide.meta.thLevel}</Badge>
        <Badge>{guide.meta.difficulty}</Badge>
        {guide.meta.draft && (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
            draft
          </Badge>
        )}
      </div>

      {/*
        Stale strategy content is worse than none, so freshness sits above the
        prose rather than buried at the bottom.
      */}
      {/*
        No unit list here. `armyComp` used to be rendered as a strip of every
        id in the guide — a flat run of thirty names mixing heroes, spells and
        siege machines — from before `<Army>` existed. The board in the body
        now shows the same army with its compartments, counts and levels, so
        the strip was the same information stated worse. `armyComp` still
        drives the index filter, which is what it is for.
      */}
      <div className="mt-4 border-y border-border py-3 text-sm text-muted">
        <p>
          Updated{" "}
          <time dateTime={guide.meta.updatedAt}>{guide.meta.updatedAt}</time> ·
          written against patch {guide.meta.patch}
        </p>
      </div>

      {/*
        Said plainly rather than hidden: a guide in the wrong language still
        beats no guide, but the reader should know why it switched.
      */}
      {locale !== DEFAULT_LOCALE && !translated && (
        <p className="mt-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          {t.guides.notTranslated}
        </p>
      )}

      {/*
        Text is held to a readable measure, everything else — the army board,
        figures, clips — gets the full width of the page.

        Headings are styled with `>` rather than a descendant selector on
        purpose. The prose rules are for the guide's own markdown, and an
        `h2`/`h3` from MDX is a direct child of this article; a descendant
        selector also reached into the components, where it put `mt-6` on
        every compartment ribbon's `<h3>` and knocked the label out of line
        with its counters.
      */}
      <article className="prose mt-8 flex flex-col gap-4 leading-relaxed text-foreground/80 [&>h2]:mt-8 [&>h2]:max-w-prose [&>h2]:text-xl [&>h2]:font-medium [&>h2]:tracking-tight [&>h2]:text-foreground [&>h3]:mt-6 [&>h3]:max-w-prose [&>h3]:font-medium [&>h3]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ol]:max-w-prose [&_ol_li]:list-decimal [&_p]:max-w-prose [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:max-w-prose">
        {content}
      </article>
    </main>
  );
}
