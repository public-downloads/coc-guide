import Image from "next/image";
import { humaniseTag } from "@/lib/format";

/**
 * A troop, spell, siege or pet as icon + label. Presentational on purpose: the
 * caller resolves the art path (`lib/data/art.ts` touches the filesystem), so
 * this can be rendered from the client index as well as from a guide.
 *
 * With no `src` it degrades to an initials tile rather than a broken image —
 * art is drop-in and arrives one file at a time, so half a set is the normal
 * state, not an error.
 */

const SIZES = {
  sm: { box: 20, text: "text-[9px]" },
  md: { box: 28, text: "text-[10px]" },
  lg: { box: 40, text: "text-xs" },
} as const;

export type UnitChipSize = keyof typeof SIZES;

/**
 * Nothing here is unit-specific beyond the name — equipment art uses the same
 * id-plus-optional-src shape, so the equipment pages render `ArtIcon` too.
 * `UnitIcon` is the alias the guide surfaces were already written against.
 */
export function ArtIcon({
  id,
  src,
  size = "md",
}: {
  id: string;
  src?: string;
  size?: UnitChipSize;
}) {
  const { box, text } = SIZES[size];
  const name = humaniseTag(id);

  if (!src) {
    return (
      <span
        aria-hidden
        title={name}
        style={{ width: box, height: box }}
        className={`inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-surface-raised font-medium uppercase text-muted ${text}`}
      >
        {initials(name)}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={box}
      height={box}
      // Already hand-sized art (128 px webp); the optimizer would add a build
      // step and nothing else, and it rejects SVG unless explicitly allowed.
      unoptimized
      className="shrink-0 rounded-md object-contain"
      style={{ width: box, height: box }}
    />
  );
}

export const UnitIcon = ArtIcon;

export function UnitChip({
  id,
  src,
  size = "md",
}: {
  id: string;
  src?: string;
  size?: UnitChipSize;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 text-sm">
      <ArtIcon id={id} src={src} size={size} />
      {humaniseTag(id)}
    </span>
  );
}

/** `Hog Rider` -> `HR`, `Balloon` -> `BA`. Shared with `UnitCard`. */
export function initials(name: string): string {
  const words = name.split(" ").filter(Boolean);
  return words.length > 1
    ? words
        .slice(0, 2)
        .map((word) => word[0])
        .join("")
    : name.slice(0, 2);
}
