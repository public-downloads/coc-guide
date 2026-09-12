/**
 * Scaffold a guide so writing one starts at the prose, not at the frontmatter:
 *
 *   npm run new:guide -- "Queen Charge Hybrid" --th 15 --army hog-rider,miner,healer
 *
 * Writes `content/guides/<slug>.mdx`, creates `public/guides/<slug>/` for its
 * screenshots and clips, and reports which army icons are still missing from
 * `public/units/`. Never overwrites an existing guide.
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_GUIDE_ROOT, DIFFICULTIES } from "../lib/content/guides";
import {
  CURRENT_PATCH,
  DEFAULT_DIFFICULTY,
  guideSlug,
  isDifficulty,
  renderGuide,
  today,
} from "../lib/content/scaffold";
import { findUnitImage } from "../lib/data/art";

const USAGE = `
  npm run new:guide -- "<title>" --th <level> --army <slug,slug,...> [options]

  --th <1-20>           town hall the guide is written for      (required)
  --army <slugs>        comma-separated troops/spells/pets      (required)
  --difficulty <name>   ${DIFFICULTIES.join(" | ")}   (default: ${DEFAULT_DIFFICULTY})
  --summary "<text>"    index blurb; a TODO is written if omitted
  --patch <YYYY.M>      default: ${CURRENT_PATCH}
  --slug <slug>         override the slug derived from the title

  e.g. npm run new:guide -- "Sui Lalo" --th 13 --army lava-hound,balloon
`;

function fail(message: string): never {
  console.error(`\n${message}\n${USAGE}`);
  process.exit(1);
}

/** Bare words are positional; `--flag value` pairs are options. */
function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags = new Map<string, string>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    // `--flag=value` and `--flag value` both work; only the first `=` splits.
    const body = arg.slice(2);
    const eq = body.indexOf("=");
    const name = eq === -1 ? body : body.slice(0, eq);
    const value = eq === -1 ? argv[++i] : body.slice(eq + 1);
    if (value === undefined) fail(`--${name} needs a value.`);
    flags.set(name, value);
  }

  return { positional, flags };
}

const { positional, flags } = parseArgs(process.argv.slice(2));

const title = positional.join(" ").trim();
if (!title) fail("A title is required.");

const thRaw = flags.get("th");
const thLevel = Number(thRaw);
if (!thRaw || !Number.isInteger(thLevel) || thLevel < 1 || thLevel > 20) {
  fail("--th must be a town hall level between 1 and 20.");
}

const armyComp = (flags.get("army") ?? "")
  .split(",")
  .map((tag) => tag.trim().toLowerCase())
  .filter(Boolean);
if (armyComp.length === 0) fail("--army needs at least one unit slug.");

const badTags = armyComp.filter((tag) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(tag));
if (badTags.length > 0) {
  fail(`Not kebab-case slugs: ${badTags.join(", ")} (e.g. "hog-rider").`);
}

const difficulty = flags.get("difficulty") ?? DEFAULT_DIFFICULTY;
if (!isDifficulty(difficulty)) {
  fail(`--difficulty must be one of ${DIFFICULTIES.join(", ")}.`);
}

const slug = flags.get("slug") ?? guideSlug(title, thLevel);
const file = path.join(DEFAULT_GUIDE_ROOT, `${slug}.mdx`);
if (fs.existsSync(file)) {
  fail(`content/guides/${slug}.mdx already exists — edit it, or pass --slug.`);
}

const body = renderGuide(
  {
    title,
    summary: flags.get("summary") ?? `TODO — one sentence for the index.`,
    thLevel,
    armyComp,
    difficulty,
    updatedAt: today(),
    patch: flags.get("patch") ?? CURRENT_PATCH,
  },
  slug,
);

fs.mkdirSync(DEFAULT_GUIDE_ROOT, { recursive: true });
fs.writeFileSync(file, body, "utf8");

// Git will not track an empty directory, and the point of creating it now is
// that the guide's asset path exists before there are assets.
const assetDir = path.join(process.cwd(), "public", "guides", slug);
fs.mkdirSync(assetDir, { recursive: true });
const keep = path.join(assetDir, ".gitkeep");
if (!fs.existsSync(keep)) fs.writeFileSync(keep, "");

console.log(`
  content/guides/${slug}.mdx
  public/guides/${slug}/          screenshots and clips go here

  npm run dev  ->  http://localhost:3000/en/guides/${slug}
`);

const missingArt = armyComp.filter((tag) => !findUnitImage(tag));
if (missingArt.length > 0) {
  console.log(
    `  No icon yet for ${missingArt.join(", ")} — drop ` +
      `public/units/<id>.webp and the chips light up on reload.\n`,
  );
}
