import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { TRANSLATED_LOCALES, guideFrontmatterSchema } from "./guide-frontmatter";
import type { GuideMeta } from "./guide-frontmatter";
import type { CatalogIssue } from "../data/catalog";

/**
 * Guides are MDX with validated frontmatter. `updatedAt` and `patch` are
 * required because stale strategy content is worse than none — both are shown
 * on every guide.
 *
 * The schema itself lives in `guide-frontmatter.ts` so the browser can import
 * it without this module's `node:fs`; it is re-exported here for callers that
 * are already server-side.
 */
export {
  DIFFICULTIES,
  TRANSLATED_LOCALES,
  difficultySchema,
  guideFrontmatterSchema,
  localised,
} from "./guide-frontmatter";
export type {
  Difficulty,
  GuideFrontmatter,
  GuideMeta,
  GuideTranslation,
  TranslatedLocale,
} from "./guide-frontmatter";

export interface Guide {
  meta: GuideMeta;
  /** Raw MDX body in the language the guide was written in — English. */
  body: string;
  /**
   * Translated bodies, keyed by locale, from sibling `<slug>.<locale>.mdx`
   * files. Absent for a language nobody has written yet, and the reader gets
   * the English body rather than an empty page.
   */
  bodies: Partial<Record<string, string>>;
}

export interface GuideCatalog {
  guides: Guide[];
  issues: CatalogIssue[];
}

export const DEFAULT_GUIDE_ROOT = path.join(process.cwd(), "content", "guides");

export function loadGuides(
  contentRoot: string = DEFAULT_GUIDE_ROOT,
): GuideCatalog {
  const guides: Guide[] = [];
  const issues: CatalogIssue[] = [];

  if (!fs.existsSync(contentRoot)) {
    issues.push({ file: contentRoot, message: "guide root does not exist" });
    return { guides, issues };
  }

  const files = fs.readdirSync(contentRoot).sort();

  for (const filename of files) {
    if (!filename.endsWith(".mdx")) continue;
    const slug = filename.replace(/\.mdx$/, "");
    // `sui-lalo-th13.de.mdx` is a translation of `sui-lalo-th13`, not a guide
    // called "sui-lalo-th13.de" — it is picked up below, with its guide.
    if (slug.includes(".")) continue;

    const raw = fs.readFileSync(path.join(contentRoot, filename), "utf8");
    const { data, content } = matter(raw);

    const result = guideFrontmatterSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const at = issue.path.length ? issue.path.join(".") : "(root)";
        issues.push({ file: filename, message: `${at}: ${issue.message}` });
      }
      continue;
    }

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      issues.push({
        file: filename,
        message: "filename must be a lowercase kebab-case slug",
      });
      continue;
    }

    // Sibling bodies: the frontmatter on a translation is ignored, since the
    // English file is the one that carries the guide's metadata.
    const bodies: Partial<Record<string, string>> = {};
    for (const locale of TRANSLATED_LOCALES) {
      const translated = path.join(contentRoot, `${slug}.${locale}.mdx`);
      if (!fs.existsSync(translated)) continue;
      bodies[locale] = matter(fs.readFileSync(translated, "utf8")).content;
    }

    guides.push({ meta: { ...result.data, slug }, body: content, bodies });
  }

  return { guides, issues };
}

/** The body to render for a locale, falling back to the English original. */
export function bodyFor(guide: Guide, locale: string): string {
  return guide.bodies[locale]?.trim() || guide.body;
}

let cached: Guide[] | undefined;
let cachedIssues: CatalogIssue[] = [];

/** Memoised in production, read fresh in development. See `getEquipmentCatalog`. */
export function getGuides(): Guide[] {
  if (cached && process.env.NODE_ENV === "production") return cached;

  const catalog = loadGuides();
  cachedIssues = catalog.issues;

  /*
   * A broken guide must never ship, but in development it must not take the
   * other guides down with it either — you hit save mid-frontmatter far more
   * often than you ship one. So: throw at build time (`validate:data` is the
   * real gate, this is the backstop), and in dev render what parsed and let
   * the index show the problems.
   */
  if (catalog.issues.length > 0 && process.env.NODE_ENV === "production") {
    throw new Error(
      `Invalid guide frontmatter:\n${catalog.issues
        .map((i) => `  ${i.file} — ${i.message}`)
        .join("\n")}`,
    );
  }
  // Freshest first — strategy content ages.
  cached = catalog.guides.sort((a, b) =>
    b.meta.updatedAt.localeCompare(a.meta.updatedAt),
  );
  return cached;
}

/** Guides that failed to parse — always empty in production, see above. */
export function getGuideIssues(): CatalogIssue[] {
  getGuides();
  return cachedIssues;
}

export function getGuide(slug: string): Guide | undefined {
  return getGuides().find((g) => g.meta.slug === slug);
}

/** Every army-comp tag in use, for the index filter. */
export function allArmyComps(guides: Guide[]): string[] {
  return [...new Set(guides.flatMap((g) => g.meta.armyComp))].sort();
}

/** Every TH level in use, descending — players filter from the top. */
export function allThLevels(guides: Guide[]): number[] {
  return [...new Set(guides.map((g) => g.meta.thLevel))].sort((a, b) => b - a);
}
