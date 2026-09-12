/**
 * Post-processing the static export for GitHub Pages. Runs after `next build`.
 *
 *   1. `.nojekyll` — Pages runs Jekyll by default, and Jekyll ignores any
 *      directory starting with an underscore. Without this, all of `_next/`
 *      is dropped and the site loads with no CSS or JS.
 *   2. `index.html` — every page lives under `/<locale>/`, and there is no
 *      server left to redirect `/`. This writes the entry stub that `proxy.ts`
 *      used to be, picking the language from the browser instead of from an
 *      Accept-Language header.
 */
import fs from "node:fs";
import path from "node:path";
import { LOCALES, DEFAULT_LOCALE } from "../lib/i18n/config";

const OUT = path.join(process.cwd(), "out");
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

if (!fs.existsSync(OUT)) {
  console.error("No out/ directory — run `next build` first.");
  process.exit(1);
}

fs.writeFileSync(path.join(OUT, ".nojekyll"), "");

const redirect = `<!doctype html>
<html lang="${DEFAULT_LOCALE}">
<head>
<meta charset="utf-8">
<title>CoC Companion</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${basePath}/${DEFAULT_LOCALE}/">
<script>
(function () {
  var locales = ${JSON.stringify(LOCALES)};
  var base = ${JSON.stringify(basePath)};
  var wanted = ${JSON.stringify(DEFAULT_LOCALE)};
  var preferred = (navigator.languages || [navigator.language || ""]);
  for (var i = 0; i < preferred.length; i++) {
    var tag = String(preferred[i]).toLowerCase().split("-")[0];
    if (locales.indexOf(tag) > -1) { wanted = tag; break; }
  }
  location.replace(base + "/" + wanted + "/" + location.search + location.hash);
})();
</script>
<meta http-equiv="refresh" content="0; url=${basePath}/${DEFAULT_LOCALE}/">
</head>
<body>
<p>Continue to <a href="${basePath}/${DEFAULT_LOCALE}/">CoC Companion</a>.</p>
</body>
</html>
`;

fs.writeFileSync(path.join(OUT, "index.html"), redirect, "utf8");

/*
 * Next 16 writes the segment-prefetch payloads as nested directories:
 *
 *   en/practice/__next.$d$locale/practice/__PAGE__.txt
 *
 * but the client asks for them with the segments joined by dots:
 *
 *   /en/practice/__next.$d$locale.practice.__PAGE__.txt
 *
 * A server routes around the difference; a static host returns 404 for every
 * hovered link, so prefetch never lands and the console fills up. Writing a
 * flat copy next to each one fixes both. Purely additive — delete this block
 * if a future Next emits the flat names itself.
 */
function flattenPrefetchPayloads(dir: string): number {
  let written = 0;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;

    if (entry.name.startsWith("__next.")) {
      const stack: string[] = [""];
      while (stack.length > 0) {
        const relative = stack.pop()!;
        const here = path.join(full, relative);
        for (const child of fs.readdirSync(here, { withFileTypes: true })) {
          const childRelative = path.join(relative, child.name);
          if (child.isDirectory()) {
            stack.push(childRelative);
            continue;
          }
          const flat = `${entry.name}.${childRelative.split(path.sep).join(".")}`;
          fs.copyFileSync(path.join(here, child.name), path.join(dir, flat));
          written++;
        }
      }
      continue;
    }

    written += flattenPrefetchPayloads(full);
  }

  return written;
}

const flattened = flattenPrefetchPayloads(OUT);

console.log(
  `\nout/ ready for Pages: .nojekyll written, / redirects to a locale ` +
    `(base path ${basePath || "none"}), ${flattened} prefetch payload(s) ` +
    `given flat names.\n`,
);
