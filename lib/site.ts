/**
 * Absolute base URL for sitemap and canonical links. Vercel exposes
 * VERCEL_PROJECT_PRODUCTION_URL; set NEXT_PUBLIC_SITE_URL once a real domain
 * exists (read the Supercell Fan Content Policy before choosing one — it
 * governs naming and branding).
 */
/**
 * GitHub Pages serves a project site from `/<repo>/`, so every absolute path
 * needs that prefix. `<Link>` and `next/image` add it themselves; raw `src` /
 * `href` attributes — the SVG `<image>` in the trainer, the `<video>` in a
 * guide — do not, and are the ones that need this.
 *
 * Never apply it to a path that also goes through `next/image`, or it lands
 * twice, and never to a path handed to `existsInPublic`, which resolves
 * against the filesystem rather than the URL space.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path: string): string {
  if (!BASE_PATH || !path.startsWith("/")) return path;
  return `${BASE_PATH}${path}`;
}

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "");
