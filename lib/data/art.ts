import fs from "node:fs";
import path from "node:path";

/**
 * Drop-in art. A file named after an id appears wherever that id is rendered —
 * no registry to update, no code change. Buildings use `public/buildings/`,
 * troops/spells/sieges/pets use `public/units/`, and the unit id is exactly
 * the slug guides already write in `armyComp`.
 *
 * Server-only (`node:fs`). Pages resolve the paths and pass plain strings to
 * client components.
 */

/** Priority order: the first extension present wins. */
export const IMAGE_EXTENSIONS = ["webp", "png", "svg", "jpg", "jpeg", "avif"];

export const UNIT_IMAGE_DIR = path.join(process.cwd(), "public", "units");
export const EQUIPMENT_IMAGE_DIR = path.join(
  process.cwd(),
  "public",
  "equipment",
);

/** `<dir>/<id>.<ext>` -> the public URL for it, or undefined if absent. */
export function findImage(
  dir: string,
  id: string,
  urlPrefix: string,
): string | undefined {
  for (const extension of IMAGE_EXTENSIONS) {
    if (fs.existsSync(path.join(dir, `${id}.${extension}`))) {
      return `${urlPrefix}/${id}.${extension}`;
    }
  }
  return undefined;
}

export function findUnitImage(id: string): string | undefined {
  return findImage(UNIT_IMAGE_DIR, id, "/units");
}

/** `public/equipment/<equipment id>.webp`, keyed by the id in `/data`. */
export function findEquipmentImage(id: string): string | undefined {
  return findImage(EQUIPMENT_IMAGE_DIR, id, "/equipment");
}

export function equipmentArt(ids: readonly string[]): ArtMap {
  return artFor(ids, findEquipmentImage);
}

/**
 * Does `/guides/foo/shot.webp` exist under `public/`? Guide components check
 * their own assets so a typo shows the author a warning at build time instead
 * of showing the reader a broken box.
 */
export function existsInPublic(publicPath: string): boolean {
  if (!publicPath.startsWith("/")) return false;
  // Normalise away any `..` before touching the filesystem.
  const relative = path.normalize(publicPath).replace(/^[/\\]+/, "");
  const root = path.join(process.cwd(), "public");
  const full = path.join(root, relative);
  if (!full.startsWith(root)) return false;
  return fs.existsSync(full);
}

/** Only the ids that have art — a missing key means "no image yet". */
export type ArtMap = Record<string, string>;

/**
 * Isometric building renders, for the 2.5D board.
 *
 * These need more than a path. A flat tile drawn `xMidYMid slice` only has to
 * know where the file is; an isometric sprite has to be *placed* — an Air
 * Defense is a tall thin thing and a Barracks a squat wide one, and each has
 * to stand on its tile at its own proportions. So the shape travels with the
 * path, out of the manifest `scripts/fetch-building-art.ts` writes.
 *
 * A file with no manifest entry still renders: dropping one in by hand stays
 * as easy as it is for every other art directory, and a square guess is only
 * ever a little wrong. A type with no file at all falls back to the drawn box.
 */
export const ISO_IMAGE_DIR = path.join(process.cwd(), "public", "buildings-iso");

export interface IsoArt {
  src: string;
  /** width / height of the image, so it can be drawn at its true shape. */
  aspect: number;
}

export type IsoArtMap = Record<string, IsoArt>;

interface IsoManifest {
  art?: Record<string, { file: string; width: number; height: number }>;
}

let isoCache: IsoArtMap | undefined;

export function isoBuildingArt(): IsoArtMap {
  if (isoCache && process.env.NODE_ENV === "production") return isoCache;
  if (!fs.existsSync(ISO_IMAGE_DIR)) return (isoCache = {});

  const manifestPath = path.join(ISO_IMAGE_DIR, "manifest.json");
  const manifest: IsoManifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    : {};
  const sizes = manifest.art ?? {};

  const out: IsoArtMap = {};
  for (const file of fs.readdirSync(ISO_IMAGE_DIR)) {
    const extension = file.split(".").pop()?.toLowerCase();
    if (!extension || !IMAGE_EXTENSIONS.includes(extension)) continue;
    const id = file.slice(0, -(extension.length + 1));
    const known = sizes[id];
    out[id] = {
      src: `/buildings-iso/${file}`,
      aspect: known && known.height > 0 ? known.width / known.height : 1,
    };
  }

  isoCache = out;
  return out;
}

export function unitArt(ids: readonly string[]): ArtMap {
  return artFor(ids, findUnitImage);
}

function artFor(
  ids: readonly string[],
  lookup: (id: string) => string | undefined,
): ArtMap {
  const art: ArtMap = {};
  for (const id of new Set(ids)) {
    const src = lookup(id);
    if (src) art[id] = src;
  }
  return art;
}
