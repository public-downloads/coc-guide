import { DIFFICULTIES, type Difficulty } from "./guide-frontmatter";
import type { GuideFrontmatter } from "./guide-frontmatter";

/**
 * The text of a new guide file, as pure functions so `scripts/new-guide.ts`
 * stays a thin CLI and the template itself is testable — the test round-trips
 * the output back through `guideFrontmatterSchema`, so a template that would
 * fail `validate:data` fails the suite first.
 */

/**
 * The patch new content is written against. Bump this when a balance update
 * lands; it is only the scaffolder's default, never a stat — numbers carry
 * their own `gameVersion` in `/data`.
 */
export const CURRENT_PATCH = "2025.10";

export const DEFAULT_DIFFICULTY: Difficulty = "intermediate";

export interface GuideDraft {
  title: string;
  thLevel: number;
  armyComp: string[];
  difficulty: Difficulty;
  summary: string;
  patch: string;
  updatedAt: string;
  /**
   * What goes inside `<Army units="…" />` — the same ids as `armyComp` but
   * with the counts and levels the frontmatter cannot hold. Optional: the CLI
   * scaffolder takes a bare list, and then the tag is just that list.
   */
  armySpec?: string;
}

/**
 * `Queen Charge Hybrid` + 15 -> `queen-charge-hybrid-th15`. The TH level is
 * part of the slug because the same strategy gets rewritten per town hall and
 * the URL is the only thing telling two of them apart.
 */
export function guideSlug(title: string, thLevel: number): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    // Drop the combining marks NFKD just split off, so "Lalö" -> "lalo"
    // rather than "lal-o".
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const suffix = `th${thLevel}`;
  return base.endsWith(`-${suffix}`) || base === suffix
    ? base
    : `${base}-${suffix}`;
}

/** Today in the `YYYY-MM-DD` shape the frontmatter wants, in local time. */
export function today(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(value);
}

/** A double-quoted YAML scalar. JSON's escapes are a subset of YAML's. */
function yamlString(value: string): string {
  return JSON.stringify(value);
}

/**
 * Quotes only when YAML would otherwise misread the value. The studio rewrites
 * a whole file on every save, so quoting everything would put a cosmetic diff
 * on every guide the first time it is opened.
 *
 * Not used for `updatedAt` or `patch`: bare, YAML turns those into a Date and
 * a float.
 */
function yamlScalar(value: string): string {
  const risky =
    value !== value.trim() ||
    value === "" ||
    /^[-?:,[\]{}#&*!|>'"%@`]/.test(value) ||
    /:\s|\s#|[\n\r]/.test(value) ||
    value.endsWith(":") ||
    /^(true|false|null|~|-?\d+(\.\d+)?)$/i.test(value);

  return risky ? yamlString(value) : value;
}

/**
 * Frontmatter + body back into a file. Used by the studio when saving an edit,
 * where `renderGuide`'s template would throw away what the author wrote.
 *
 * Dates and the patch are quoted deliberately: unquoted, YAML parses
 * `2026-08-12` into a Date and `2025.10` into a float.
 */
export function serializeGuide(
  frontmatter: GuideFrontmatter,
  body: string,
): string {
  const lines = [
    `title: ${yamlScalar(frontmatter.title)}`,
    `summary: ${yamlScalar(frontmatter.summary)}`,
    `thLevel: ${frontmatter.thLevel}`,
    `armyComp: [${frontmatter.armyComp.join(", ")}]`,
    `difficulty: ${frontmatter.difficulty}`,
    `updatedAt: ${yamlString(frontmatter.updatedAt)}`,
    `patch: ${yamlString(frontmatter.patch)}`,
    `draft: ${frontmatter.draft}`,
  ];

  // Omitted entirely when empty, so an untranslated guide keeps the frontmatter
  // it has always had rather than growing an empty block.
  const translations = Object.entries(frontmatter.translations ?? {}).filter(
    ([, value]) => value && (value.title || value.summary),
  );
  if (translations.length > 0) {
    lines.push("translations:");
    for (const [locale, value] of translations) {
      lines.push(`  ${locale}:`);
      lines.push(`    title: ${yamlScalar(value!.title)}`);
      lines.push(`    summary: ${yamlScalar(value!.summary)}`);
    }
  }

  return `---\n${lines.join("\n")}\n---\n\n${body.replace(/\s*$/, "")}\n`;
}

/**
 * The body's `<Army units="…" />` tag — the one place a guide can hold counts
 * and levels, since the frontmatter's `armyComp` is a list of bare slugs.
 *
 * Only the *first* tag is read or written. The scaffolded body carries a
 * second one inside the trailing JSX comment as documentation, and rewriting
 * that would edit the instructions rather than the army.
 */
const ARMY_TAG = /<Army\b([^>]*?)units="([^"]*)"([^>]*?)\/>/;

export function readArmyTag(body: string): string | null {
  return ARMY_TAG.exec(body)?.[2] ?? null;
}

/**
 * Put `units` into the first tag, add one at the top if there is none, or drop
 * the tag when the army is emptied. Everything else in the body is left alone
 * — the prose is the part worth writing by hand.
 */
export function writeArmyTag(body: string, units: string): string {
  const match = ARMY_TAG.exec(body);

  if (!match) {
    return units ? `<Army units="${units}" />\n\n${body.replace(/^\s+/, "")}` : body;
  }

  if (!units) {
    return body.replace(ARMY_TAG, "").replace(/^\s*\n+/, "").replace(/\n{3,}/g, "\n\n");
  }

  // `match[3]` already carries the space before `/>`; adding another would put
  // a cosmetic diff on the line every time the army is touched.
  return body.replace(ARMY_TAG, `<Army${match[1]}units="${units}"${match[3]}/>`);
}

export function renderGuide(draft: GuideDraft, slug: string): string {
  const units = draft.armySpec?.trim() || draft.armyComp.join(", ");

  return `---
title: ${yamlString(draft.title)}
summary: ${yamlString(draft.summary)}
thLevel: ${draft.thLevel}
armyComp: [${draft.armyComp.join(", ")}]
difficulty: ${draft.difficulty}
updatedAt: ${yamlString(draft.updatedAt)}
patch: ${yamlString(draft.patch)}
draft: true
---

<Army units="${units}" />

TODO — open with what this attack does and when you reach for it. Two or three
sentences; the summary above is what shows in the index, this is the first
thing a reader sees on the page.

## Reading the base

What has to be true of the base before this attack is the right pick.

## Executing it

1. TODO
2. TODO

## When to pick something else

- TODO

{/*
  Components available inside a guide — delete the ones you do not use.

  <Army units="${units}" />
      Training cards for troops, spells, sieges and pets. Ids are the same
      slugs as \`armyComp\`; add \`xN\` for the count and \`lN\` for the level
      ("hog-rider x12 l10"). Art is drop-in at public/units/<id>.webp and a
      unit with no file yet still gets a card. Pass \`compact\` for a plain
      icon row instead.

  <LoadoutCallout hero="queen" e1="frozen-arrow:27" e2="healer-puppet:18"
    note="Why this loadout and not another." />

  <Figure src="/guides/${slug}/funnel.webp" alt="Describe what is shown"
    caption="Optional caption" />

  <GuideVideo src="/guides/${slug}/walkthrough.mp4"
    poster="/guides/${slug}/walkthrough.jpg" caption="The funnel, at 0.5x" />

  Screenshots and clips live in public/guides/${slug}/ — see the README there
  for encoding settings. Both components check the file exists at build time
  and show a visible warning rather than a broken box.

  Remove \`draft: true\` from the frontmatter once this has been checked
  against live play.
*/}
`;
}
