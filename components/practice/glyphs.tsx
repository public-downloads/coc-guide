import type { ReactNode } from "react";
import type { BuildingCategory } from "@/lib/schema/building";

/**
 * Simple geometric pictograms, drawn in a 0..10 unit box and scaled to each
 * building's footprint.
 *
 * These are the fallback, not the intended final look: drop a file into
 * `public/buildings/<type id>.webp` and it replaces the glyph for that type.
 * They exist so a type with no art still reads as itself, which is what lets
 * the art set be filled in one file at a time.
 *
 * Being hand-drawn primitives, they also stay correct in all five themes —
 * they stroke with `currentColor` against `var(--glyph)`, where a dropped-in
 * image is baked. That only matters for line symbols; building art replaces
 * the whole tile, so it has no theme to clash with.
 */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.1,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const GLYPHS: Record<string, ReactNode> = {
  "town-hall": (
    <>
      <path d="M1.5 9V4.6L5 2l3.5 2.6V9z" {...stroke} />
      <path d="M5 9V6.2h0" {...stroke} />
      <path d="M5 2V0.6" {...stroke} />
    </>
  ),
  "air-defense": (
    <>
      <path d="M2.4 9L4 4m3.6 5L6 4" {...stroke} />
      <path d="M3 4.4l4-1.6M3.6 2.6l3.4 1.4" {...stroke} />
    </>
  ),
  cannon: (
    <>
      <circle cx="4" cy="6.6" r="2.2" {...stroke} />
      <path d="M5.6 5.1l2.8-2.2" {...stroke} strokeWidth={1.8} />
    </>
  ),
  "ricochet-cannon": (
    <>
      <circle cx="3.6" cy="6.8" r="2" {...stroke} />
      <path d="M5.2 5.4l3-2.2M6.4 6.6l2 1.4" {...stroke} />
    </>
  ),
  "archer-tower": (
    <>
      <path d="M3 9V4.4h4V9z" {...stroke} />
      <path d="M2.2 4.4L5 1.4l2.8 3" {...stroke} />
    </>
  ),
  "multi-archer-tower": (
    <>
      <path d="M2 9V4.8h2.6V9zm3.4 0V4.8H8V9z" {...stroke} />
      <path d="M1.4 4.8L3.3 2l1.9 2.8M4.8 4.8L6.7 2l1.9 2.8" {...stroke} />
    </>
  ),
  mortar: (
    <>
      <path d="M2.2 9h5.6l-1-3.4H3.2z" {...stroke} />
      <circle cx="5" cy="3" r="1.4" {...stroke} />
    </>
  ),
  "wizard-tower": (
    <>
      <path d="M3.2 9V5h3.6v4z" {...stroke} />
      <path d="M2.4 5L5 1.2 7.6 5" {...stroke} />
      <path d="M5 6.4l.5 1 1 .2-.75.8.2 1.05" {...stroke} strokeWidth={0.8} />
    </>
  ),
  "super-wizard-tower": (
    <>
      <path d="M3.2 9V5h3.6v4z" {...stroke} />
      <path d="M2.2 5L5 0.9 7.8 5" {...stroke} />
      <path d="M5 2.2v2M4 3.2h2" {...stroke} strokeWidth={0.8} />
    </>
  ),
  "x-bow": (
    <>
      <path d="M2 2.4l6 5.2M8 2.4L2 7.6" {...stroke} />
      <circle cx="5" cy="5" r="1.1" {...stroke} />
    </>
  ),
  "inferno-tower": (
    <>
      <path d="M5 1.4c1.8 2.2 2.6 3.5 2.6 5A2.6 2.6 0 015 9a2.6 2.6 0 01-2.6-2.6c0-1.5.8-2.8 2.6-5z" {...stroke} />
    </>
  ),
  "eagle-artillery": (
    <>
      <circle cx="5" cy="5.6" r="2.6" {...stroke} />
      <path d="M5 3V1M2.6 7.4L1.2 8.8M7.4 7.4l1.4 1.4" {...stroke} />
    </>
  ),
  scattershot: (
    <>
      <path d="M2.6 8.4l3-3.4" {...stroke} strokeWidth={1.6} />
      <circle cx="7" cy="3" r="0.8" {...stroke} strokeWidth={0.9} />
      <circle cx="8.4" cy="5.4" r="0.6" {...stroke} strokeWidth={0.9} />
      <circle cx="5.6" cy="1.8" r="0.6" {...stroke} strokeWidth={0.9} />
    </>
  ),
  "hidden-tesla": <path d="M5.8 1.2L3 5.4h2L4.2 8.8 7.4 4.4h-2z" {...stroke} />,
  monolith: (
    <>
      <path d="M3.4 9V2.6L5 1.2l1.6 1.4V9z" {...stroke} />
      <path d="M5 3.6v3.2" {...stroke} strokeWidth={0.8} />
    </>
  ),
  "spell-tower": (
    <>
      <path d="M3.2 9V5.2h3.6V9z" {...stroke} />
      <path d="M5 5.2V2.4M3.4 3.4L5 1.4l1.6 2" {...stroke} />
    </>
  ),
  "air-sweeper": (
    <>
      <path d="M2.4 8.4V5.6h2.2l3-2.2V8" {...stroke} />
      <path d="M2 3.2h3M2 1.8h4.4" {...stroke} strokeWidth={0.8} />
    </>
  ),
  "bomb-tower": (
    <>
      <circle cx="5" cy="6.2" r="2.4" {...stroke} />
      <path d="M6.4 4l1-1.4M7.4 2.6l1 .4" {...stroke} strokeWidth={0.9} />
    </>
  ),
  "clan-castle": (
    <>
      <path d="M2 9V4h6v5z" {...stroke} />
      <path d="M2 4V2.4h1.4V4M8 4V2.4H6.6V4M4.6 4V2.4h.8V4" {...stroke} strokeWidth={0.9} />
    </>
  ),
  "gold-storage": (
    <>
      <ellipse cx="5" cy="3.4" rx="3" ry="1.2" {...stroke} />
      <path d="M2 3.4v3.4c0 .7 1.35 1.2 3 1.2s3-.5 3-1.2V3.4" {...stroke} />
    </>
  ),
  "army-camp": (
    <>
      <path d="M5 1.6L1.6 8.4h6.8z" {...stroke} />
      <path d="M5 4.4V8.4" {...stroke} strokeWidth={0.8} />
    </>
  ),
};

// Storages and collectors share the barrel.
for (const id of [
  "elixir-storage",
  "dark-elixir-storage",
  "gold-mine",
  "elixir-collector",
  "dark-elixir-drill",
]) {
  GLYPHS[id] = GLYPHS["gold-storage"];
}

const CATEGORY_FALLBACK: Record<BuildingCategory, ReactNode> = {
  core: GLYPHS["town-hall"],
  defence: <circle cx="5" cy="5" r="2.6" {...stroke} />,
  // Walls are 1x1 and drawn as solid blocks; a glyph would be illegible.
  wall: null,
  resource: GLYPHS["gold-storage"],
  army: <path d="M2.4 8V3.2L5 1.8l2.6 1.4V8z" {...stroke} />,
  other: <rect x="3" y="3" width="4" height="4" rx="0.6" {...stroke} />,
};

export function glyphFor(
  typeId: string,
  category: BuildingCategory,
): ReactNode {
  return GLYPHS[typeId] ?? CATEGORY_FALLBACK[category];
}

/** True when a footprint is too small for a glyph to read. */
export function glyphFits(size: number): boolean {
  return size >= 2;
}
