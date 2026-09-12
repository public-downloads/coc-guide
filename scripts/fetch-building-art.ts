/**
 * Pulls one isometric render per building type from the Clash of Clans wiki.
 *
 *   npm run fetch:art -- --dry-run        # report what it would take
 *   npm run fetch:art                     # fetch everything missing
 *   npm run fetch:art -- --only cannon,x-bow
 *   npm run fetch:art -- --force          # re-fetch even if present
 *
 * The wiki's HTML is behind Cloudflare and refuses a script, but its
 * MediaWiki API answers fine and hands back direct CDN URLs — so this goes
 * through the API rather than scraping pages.
 *
 * Art is Supercell's, used under the Fan Content Policy on the same terms as
 * everything in `public/units/`: non-commercial, disclaimer on every page,
 * revocable. See `public/units/README.md`. Every file's source URL is written
 * into the manifest so any of it can be traced or removed.
 *
 * Deliberately a one-off script rather than a build step. The site is a static
 * export and the wiki is someone else's server; a build that reaches out to it
 * would be slow, flaky and rude.
 */
import fs from "node:fs";
import path from "node:path";
import { loadPracticeData } from "../lib/data/bases";

const API = "https://clashofclans.fandom.com/api.php";
const OUT = path.join(process.cwd(), "public", "buildings-iso");
const MANIFEST = path.join(OUT, "manifest.json");

/** Fandom asks for a real agent; an unidentified script is what gets blocked. */
const HEADERS = {
  "user-agent":
    "coc-companion-art-fetcher/1.0 (fan project; contact via repository)",
};

const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const only = (() => {
  const raw = process.argv.slice(2).find((a) => a.startsWith("--only"));
  if (!raw) return null;
  const list = raw.includes("=")
    ? raw.split("=")[1]
    : process.argv[process.argv.indexOf(raw) + 1];
  return new Set((list ?? "").split(",").map((s) => s.trim()).filter(Boolean));
})();
const dryRun = flags.has("--dry-run");
const force = flags.has("--force");

interface ImageInfo {
  title: string;
  url: string;
  width: number;
  height: number;
  mime: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(params: Record<string, string>): Promise<unknown> {
  const url = new URL(API);
  for (const [k, v] of Object.entries({ format: "json", ...params })) {
    url.searchParams.set(k, v);
  }
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

/** Every File: on a page, in the order the wiki lists them. */
async function imagesOn(page: string): Promise<string[]> {
  const data = (await api({
    action: "query",
    prop: "images",
    imlimit: "500",
    // Follow a redirect: some ids point at a page under another name.
    redirects: "1",
    titles: page,
  })) as { query?: { pages?: Record<string, { images?: { title: string }[] }> } };

  const pages = Object.values(data.query?.pages ?? {});
  return pages.flatMap((p) => (p.images ?? []).map((i) => i.title));
}

/**
 * These draw at roughly 20–90 px on the board, and the originals run to
 * 3700 px and a megabyte each. `iiurlwidth` makes the wiki's own thumbnailer
 * do the resizing, so what lands on disk is already the right size — less to
 * download, less to ship, and less of their bandwidth than pulling full-size
 * art and throwing most of it away.
 */
const THUMB_WIDTH = 256;

async function infoFor(titles: string[]): Promise<ImageInfo[]> {
  if (titles.length === 0) return [];
  const data = (await api({
    action: "query",
    prop: "imageinfo",
    iiprop: "url|size|mime",
    iiurlwidth: String(THUMB_WIDTH),
    titles: titles.join("|"),
  })) as {
    query?: {
      pages?: Record<
        string,
        {
          title: string;
          imageinfo?: {
            url: string;
            thumburl?: string;
            thumbwidth?: number;
            thumbheight?: number;
            width: number;
            height: number;
            mime: string;
          }[];
        }
      >;
    };
  };

  return Object.values(data.query?.pages ?? {}).flatMap((p) => {
    const info = p.imageinfo?.[0];
    if (!info) return [];
    // Fall back to the original when the file is already small enough that the
    // wiki does not bother making a thumbnail.
    return [
      {
        title: p.title,
        url: info.thumburl ?? info.url,
        width: info.thumbwidth ?? info.width,
        height: info.thumbheight ?? info.height,
        mime: info.mime,
      },
    ];
  });
}

/**
 * No building has more levels than this. The cap is not fussiness: the wiki
 * carries files like `Air Defense2012.png`, and a naive "highest number wins"
 * reads that as level 2012 and ships a screenshot from 2012 as the model.
 */
const MAX_BUILDING_LEVEL = 40;

/** Variants that are not the building standing there looking like itself. */
const REJECTED_SUFFIX = /depleted|destroy|broken|info|icon|menu|old|clash royale/i;

/**
 * `Air Defense13.png` -> level 13. `X-Bow10 Ground.png` -> level 10, variant
 * "Ground". Anything else -> null.
 *
 * Matched against the real filename rather than an alphanumerics-only
 * squash: squashing turns `Town Hall17-5.png` into `TownHall175` and invents
 * a level 175. The separator has to stay visible to be rejected.
 */
function parseRender(
  title: string,
  name: string,
): { level: number; sub: number; variant: string } | null {
  const file = title.replace(/^File:/, "").replace(/\.[^.]+$/, "");
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // `-N` is a sub-level, as in `Town Hall17-5.png` — the Town Hall at 17 with
  // its weapon at 5. The building is still level 17; squashing the separator
  // away would have called it level 175.
  const match = new RegExp(
    `^${escaped}[ _]?(\\d+)(?:-(\\d+))?(?:[ _](.+))?$`,
    "i",
  ).exec(file);
  if (!match) return null;

  const level = Number(match[1]);
  const variant = match[3] ?? "";
  if (level < 1 || level > MAX_BUILDING_LEVEL) return null;
  if (REJECTED_SUFFIX.test(variant)) return null;
  return { level, sub: Number(match[2] ?? 0), variant };
}

/**
 * The best render for a building: its top level, then the plainest form of
 * it — `X-Bow10.png` before `X-Bow10 Ground.png`, `Town Hall17` before
 * `Town Hall17-5`.
 *
 * There is deliberately no aspect-ratio filter. The obvious one — "isometric
 * renders are wider than tall" — is wrong: an Air Defense or a Wizard Tower
 * is a tall thing and its render is portrait. Matching `Name<level>` is
 * already enough to tell a render from the currency glyphs and screenshots
 * on the same page, and the real proportions are what make a tall building
 * look tall on the board.
 */
function pickRender(name: string, images: ImageInfo[]): ImageInfo | null {
  const ranked = images
    .map((image) => {
      const parsed = parseRender(image.title, name);
      return parsed ? { image, ...parsed } : null;
    })
    .filter(
      (v): v is { image: ImageInfo; level: number; sub: number; variant: string } =>
        v !== null,
    )
    .sort(
      (a, b) =>
        b.level - a.level ||
        a.sub - b.sub ||
        a.variant.length - b.variant.length,
    );

  return ranked[0]?.image ?? null;
}

async function main() {
  const { buildings } = loadPracticeData();
  const types = (buildings?.types ?? []).filter(
    (type) => !type.retired && (!only || only.has(type.id)),
  );

  if (types.length === 0) {
    console.error("no building types matched");
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const manifest: Record<string, { file: string; width: number; height: number; source: string }> =
    fs.existsSync(MANIFEST)
      ? (JSON.parse(fs.readFileSync(MANIFEST, "utf8")).art ?? {})
      : {};

  let fetched = 0;
  let bytes = 0;
  const missing: string[] = [];

  for (const type of types) {
    if (!force && manifest[type.id] && fs.existsSync(path.join(OUT, manifest[type.id].file))) {
      continue;
    }

    try {
      const titles = await imagesOn(type.name);
      // Only ask for details on the plausible ones; the pages carry dozens of
      // icons, currency glyphs and screenshots alongside the renders.
      const candidates = titles.filter((t) => parseRender(t, type.name) !== null);
      const best = pickRender(type.name, await infoFor(candidates.slice(0, 50)));

      if (!best) {
        missing.push(type.id);
        console.log(`  ${type.id.padEnd(22)} no isometric render found`);
        await sleep(200);
        continue;
      }

      // From the title, not the URL: a Fandom CDN path ends `/revision/latest`,
      // so splitting the URL on "." yields "png/revision/latest".
      const extension = best.title.split(".").pop()!.toLowerCase();
      const file = `${type.id}.${extension}`;

      if (dryRun) {
        console.log(
          `  ${type.id.padEnd(22)} ${best.title.replace("File:", "").padEnd(24)} ${best.width}x${best.height}`,
        );
      } else {
        const response = await fetch(best.url, { headers: HEADERS });
        if (!response.ok) throw new Error(`${response.status} on the image`);
        const data = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(path.join(OUT, file), data);
        bytes += data.length;
        console.log(
          `  ${type.id.padEnd(22)} ${best.width}x${best.height}  ${Math.round(data.length / 1024)} kB`,
        );
      }

      manifest[type.id] = {
        file,
        width: best.width,
        height: best.height,
        source: best.url.split("/revision")[0],
      };
      fetched += 1;
      // The wiki is someone else's server; do not hammer it.
      await sleep(250);
    } catch (error) {
      missing.push(type.id);
      console.log(
        `  ${type.id.padEnd(22)} failed — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (!dryRun && fetched > 0) {
    fs.writeFileSync(
      MANIFEST,
      `${JSON.stringify(
        {
          _note:
            "Written by scripts/fetch-building-art.ts. Art is Supercell's, used under the Fan Content Policy — see public/units/README.md. `source` is where each file came from.",
          art: Object.fromEntries(Object.entries(manifest).sort()),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }

  console.log(
    `\n${dryRun ? "would fetch" : "fetched"} ${fetched}/${types.length}` +
      (bytes > 0 ? `, ${Math.round(bytes / 1024)} kB total` : ""),
  );
  if (missing.length > 0) {
    console.log(
      `${missing.length} without a usable render (they keep the drawn fallback): ${missing.join(", ")}`,
    );
  }
}

void main();
