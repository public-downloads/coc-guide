import Image from "next/image";
import { initials } from "@/components/ui/UnitChip";
import { humaniseTag } from "@/lib/format";

/**
 * A unit as a training-card tile: art on a slab, count top-left, level
 * bottom-left, name underneath — the arrangement the army screen uses, so a
 * player reads the card without being taught how.
 *
 * The frame is drawn here rather than baked into the image on purpose. A PNG
 * with `x12` burnt into the corner is usable by exactly one guide and goes
 * stale the moment a level cap moves; keeping the art as a transparent cutout
 * means the numbers come from whatever the guide says. It is also why
 * `public/units/` wants cutouts with no background — this supplies one.
 *
 * The *arrangement* is the game's; the colours are the site's own theme
 * tokens, and every theme has to work. It is not a pixel copy of Supercell's
 * card, which is the thing the Fan Content Policy is explicit about.
 *
 * No gradient on the tile: `surface-raised` is darker than `surface` in the
 * light themes and lighter in the dark ones, so any gradient between them
 * shades in opposite directions depending on the theme. Depth comes from the
 * border and one inset shadow instead, which read the same everywhere.
 */

// The art sits close to the tile's edge, as it does on the game's own cards —
// a wide margin makes a slab look like a placeholder. It is a transparent
// cutout fitted with `object-contain`, so it never actually touches the border.
const SIZES = {
  // `sm` is the equipment strip that sits under a hero — no caption, so the
  // column is only as wide as the tile.
  sm: { w: 34, h: 34, art: { w: 30, h: 30 }, column: "2.125rem" },
  md: { w: 60, h: 60, art: { w: 53, h: 53 }, column: "4.75rem" },
  lg: { w: 80, h: 80, art: { w: 71, h: 71 }, column: "6rem" },
  // Heroes stand in a tall portrait in game rather than on a square tile.
  portrait: { w: 74, h: 102, art: { w: 70, h: 97 }, column: "5rem" },
} as const;

export type UnitCardSize = keyof typeof SIZES;

/**
 * What a category's slab is painted with — the one palette that does not
 * follow the theme. A card is a picture of a game object, so it keeps the
 * game's own colours whichever theme the reader picked: elixir blue, dark
 * elixir a deeper violet, supers dark red, heroes purple, epic gold.
 */
const TONES = {
  default: "border-tile-edge bg-tile",
  dark: "border-tile-dark-edge bg-tile-dark",
  super: "border-tile-super-edge bg-tile-super",
  epic: "border-tile-epic-edge bg-tile-epic",
  hero: "border-hero-tile-edge bg-hero-tile",
} as const;

export type UnitCardTone = keyof typeof TONES;

export function UnitCard({
  id,
  src,
  count,
  level,
  size = "md",
  tone = "default",
}: {
  id: string;
  src?: string;
  count?: number;
  level?: number;
  size?: UnitCardSize;
  /**
   * The elixir a unit is trained with: `hero` paints the purple backdrop the
   * army screen puts behind a hero, `dark` the deeper slab, `super` the red.
   */
  tone?: UnitCardTone;
}) {
  const { w, h, art, column } = SIZES[size];
  const name = humaniseTag(id);
  const label = [count && `${count}x`, name, level && `level ${level}`]
    .filter(Boolean)
    .join(" ");

  return (
    <figure
      style={{ width: column }}
      className="flex shrink-0 flex-col items-center gap-1.5"
    >
      {/* Badges sit outside the clipping box so they can overhang the tile. */}
      <div className="relative" style={{ width: w, height: h }}>
        <div
          title={label}
          className={`flex h-full w-full items-center justify-center overflow-hidden rounded-[var(--radius-tile)] border-2 shadow-[inset_0_-3px_0_rgb(0_0_0/0.18)] ${TONES[tone]}`}
        >
          {src ? (
            <Image
              src={src}
              alt=""
              width={art.w}
              height={art.h}
              // Hand-sized cutouts; see the note in UnitChip.
              unoptimized
              className="object-contain"
              style={{ width: art.w, height: art.h }}
            />
          ) : (
            <span
              aria-hidden
              // White rather than `text-muted`: the slab is a saturated colour
              // in every theme now, and the muted token is tuned for the page.
              className="text-xs font-semibold uppercase tracking-wide text-white/75"
            >
              {initials(name)}
            </span>
          )}
        </div>

        {/*
          Top-left for the count, bottom-left for the level — where the army
          screen puts them, so the eye lands on the right number first.
        */}
        {count !== undefined && (
          <span className="absolute -left-1.5 -top-1.5 rounded-md border border-border-strong bg-foreground px-1.5 py-px text-[11px] font-bold tabular-nums leading-tight text-background shadow-sm">
            ×{count}
          </span>
        )}
        {level !== undefined && (
          <span className="absolute bottom-1 left-1 rounded-md bg-surface/90 px-1 text-[10px] font-semibold tabular-nums leading-tight text-accent ring-1 ring-inset ring-border-strong">
            {level}
          </span>
        )}
      </div>

      {size !== "sm" && (
        <figcaption className="text-center text-[11px] font-medium leading-tight text-muted">
          {name}
        </figcaption>
      )}
    </figure>
  );
}
