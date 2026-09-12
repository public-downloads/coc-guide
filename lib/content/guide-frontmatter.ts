import { z } from "zod";
import { gameVersionSchema, slugSchema } from "../schema/common";

/**
 * The guide frontmatter schema, kept apart from the loader in `guides.ts`
 * because that one reads the filesystem. Anything running in a browser — the
 * studio's forms, a client component — imports from here; importing the loader
 * drags `node:fs` into the bundle and breaks the build.
 *
 * `guides.ts` re-exports all of this, so server-side callers need not care.
 */

/** YAML parses an unquoted date into a Date; normalise back to YYYY-MM-DD. */
const isoDateSchema = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must look like 2026-01-14"),
);

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export const difficultySchema = z.enum(DIFFICULTIES);
export type Difficulty = z.infer<typeof difficultySchema>;

/**
 * Locales a guide can carry beyond the English it is written in. English is
 * not in here: `title` and `summary` are the English ones, so a guide with no
 * translations at all is still a complete file and nothing had to change in
 * the guides that already existed.
 */
export const TRANSLATED_LOCALES = ["de"] as const;
export type TranslatedLocale = (typeof TRANSLATED_LOCALES)[number];

const translationSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
});

export type GuideTranslation = z.infer<typeof translationSchema>;

export const guideFrontmatterSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  thLevel: z.number().int().min(1).max(20),
  armyComp: z.array(slugSchema).min(1),
  difficulty: difficultySchema,
  updatedAt: isoDateSchema,
  patch: gameVersionSchema,
  /** Written but not reviewed against live play. Surfaced in the UI. */
  draft: z.boolean().default(false),
  /**
   * Per-locale title and summary. Partial on purpose — a guide translated
   * into one language and not another is the normal state, and the reader
   * falls back to English rather than seeing a gap.
   *
   * The *body* is not here: prose belongs in MDX, so it lives in a sibling
   * `<slug>.de.mdx` alongside the English one.
   */
  translations: z.record(z.enum(TRANSLATED_LOCALES), translationSchema).optional(),
});

export type GuideFrontmatter = z.infer<typeof guideFrontmatterSchema>;
export type GuideMeta = GuideFrontmatter & { slug: string };

/**
 * The title and summary a reader in this locale should see, falling back to
 * the English the guide was written in. Not "hide the guide until it is
 * translated" — a strategy guide in the wrong language still beats no guide.
 */
export function localised(
  meta: { title: string; summary: string; translations?: Partial<Record<string, GuideTranslation>> },
  locale: string,
): GuideTranslation {
  const translation = meta.translations?.[locale];
  return {
    title: translation?.title || meta.title,
    summary: translation?.summary || meta.summary,
  };
}
