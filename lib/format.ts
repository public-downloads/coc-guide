/**
 * Client-safe formatting helpers. No filesystem access, so client components
 * can import these without dragging `node:fs` into the browser bundle.
 */

/**
 * Numbers are formatted against a fixed locale on purpose. `toLocaleString()`
 * with no argument uses the *server's* locale during SSR, which silently
 * renders German separators for every visitor if the build machine is set to
 * de-DE.
 */
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

export function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(value);
}

export function formatSigned(value: number): string {
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

/** `hog-rider` -> `Hog Rider`. */
export function humaniseTag(tag: string): string {
  return tag
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** `freezeDuration` -> `Freeze duration`. */
export function humaniseKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
