"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  BOARD_OFFSET,
  BOARD_SIZE,
  VILLAGE_SIZE,
  type BuildingType,
  type PlacedBuilding,
} from "@/lib/schema/building";
import type { Point, Segment } from "@/lib/practice/geometry";
import {
  checkPlacement,
  footprintOf,
  exclusionRuns,
  snapFootprint,
  UNIT_CLEARANCE,
  type Footprint,
} from "@/lib/practice/placement";
import { withBasePath } from "@/lib/site";
import { glyphFits, glyphFor } from "./glyphs";

/**
 * How far the board is turned, in degrees. The village is a diamond in game,
 * not a square, and the grid reads as one at 45.
 *
 * Purely presentational: it lives in the CSS transform on the board and in the
 * counter-rotation on each sprite. No stored coordinate knows about it, and
 * pointer input comes back through the SVG's own matrix — so every bit of
 * geometry in `lib/practice/` is untouched by it.
 */
export const BOARD_TILT = 45;

const CATEGORY_FILL: Record<BuildingType["category"], string> = {
  core: "var(--cat-core)",
  defence: "var(--cat-defence)",
  wall: "var(--cat-wall)",
  resource: "var(--cat-resource)",
  army: "var(--cat-army)",
  other: "var(--cat-other)",
};

/**
 * One hero standing on the board, with the line they would fire.
 *
 * The board takes a list rather than a hero and a segment because the pair
 * drill puts the Queen and the Duke out at once, each with their own ability,
 * their own path width and their own colour. One unit is just a list of one.
 */
export interface BoardUnit {
  /** Stable across renders; also what a drag reports back. */
  slot: string;
  name: string;
  at: Point;
  segment: Segment | null;
  halfWidth: number;
  /** CSS colour, as a token reference. */
  colour: string;
}

/** The best line the solver found, drawn behind the live one. */
export interface GhostLine {
  segment: Segment;
  halfWidth: number;
}

export interface VillageProps {
  buildings: PlacedBuilding[];
  lookup: (typeId: string) => BuildingType | undefined;
  units: BoardUnit[];
  ghosts: GhostLine[];
  hitIds: string[];
  /** Crossed by every unit's line — only ever set in the pair drill. */
  bothIds: string[];
  /** Clipped the aura of without crossing; worth partial credit. */
  auraIds: string[];
  targetId: string | null;
  mode: "drill" | "sandbox";
  placingType: BuildingType | null;
  /** Every selected building. Dragging any one of them moves them all. */
  selectedIds: string[];
  /** Rubber out buildings by dragging over them instead of placing. */
  erasing: boolean;
  /** Fires continuously while dragging — cheap, local, no URL write. */
  onHeroPreview: (slot: string, p: Point) => void;
  /** Fires once when the drag ends; this is what goes in the URL. */
  onMoveHero: (slot: string, p: Point) => void;
  /** One commit for a whole drag, so painting a wall run is a single update. */
  onPlaceMany: (footprints: Footprint[]) => void;
  /** One commit for the whole selection, so a group move is one update. */
  onMoveMany: (moves: Array<{ id: string; x: number; y: number }>) => void;
  onErase: (ids: string[]) => void;
  onSelect: (ids: string[]) => void;
}

type Drag =
  | { kind: "hero"; slot: string; at: Point | null }
  | { kind: "paint"; placed: Footprint[] }
  /**
   * A group move. `anchor` is the footprint of the building actually grabbed;
   * everything else in `ids` travels by the same whole-tile delta, so the
   * selection keeps its shape instead of collapsing onto the cursor.
   */
  | {
      kind: "move";
      ids: string[];
      anchor: Footprint;
      delta: { x: number; y: number };
      moved: boolean;
    }
  /** `last` is the previous sample, so a fast sweep can fill in behind it. */
  | { kind: "erase"; ids: string[]; last: Point }
  | { kind: "marquee"; from: Point; to: Point }
  | null;

export function Village({
  buildings,
  lookup,
  units,
  ghosts,
  hitIds,
  bothIds,
  auraIds,
  targetId,
  mode,
  placingType,
  selectedIds,
  erasing,
  onHeroPreview,
  onMoveHero,
  onPlaceMany,
  onMoveMany,
  onErase,
  onSelect,
}: VillageProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag>(null);
  const [draft, setDraft] = useState<Drag>(null);
  const [preview, setPreview] = useState<Footprint | null>(null);

  /*
    Screen point -> board tile, through the SVG's own matrix rather than its
    bounding rect. The rect only describes an axis-aligned box, so the moment
    the board is turned it stops describing where anything is; `getScreenCTM`
    carries the rotation and scale with it, and the inverse maps a pointer
    straight back into tile space whatever the board is doing.
  */
  const toTile = useCallback((clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: point.x, y: point.y };
  }, []);

  /** Walls are the only thing worth painting; bigger footprints place once. */
  const paintable = placingType?.size === 1;

  const legal = useCallback(
    (f: Footprint, ignoreId?: string, extra: Footprint[] = []) => {
      if (!checkPlacement(f, buildings, lookup, ignoreId).ok) return false;
      return !extra.some(
        (o) =>
          f.x < o.x + o.size &&
          o.x < f.x + f.size &&
          f.y < o.y + o.size &&
          o.y < f.y + f.size,
      );
    },
    [buildings, lookup],
  );

  /** Every building's footprint, by id — the group move needs all of them. */
  const printsById = useMemo(() => {
    const out = new Map<string, Footprint>();
    for (const building of buildings) {
      const print = footprintOf(building, lookup);
      if (print) out.set(building.id, print);
    }
    return out;
  }, [buildings, lookup]);

  /**
   * Can the whole selection shift by this delta?
   *
   * Checked against the layout *minus everything that is moving*, so a group
   * sliding along keeps passing over the tiles it is itself vacating. Checking
   * one at a time against the full layout would refuse almost every move: the
   * second building in a run always lands where the first one still is.
   */
  const groupFits = useCallback(
    (ids: string[], delta: { x: number; y: number }) => {
      const moving = new Set(ids);
      const others = buildings.filter((b) => !moving.has(b.id));
      const landed: Footprint[] = [];

      for (const id of ids) {
        const from = printsById.get(id);
        if (!from) return false;
        const to = { x: from.x + delta.x, y: from.y + delta.y, size: from.size };
        if (!checkPlacement(to, others, lookup).ok) return false;
        if (
          landed.some(
            (o) =>
              to.x < o.x + o.size &&
              o.x < to.x + to.size &&
              to.y < o.y + o.size &&
              o.y < to.y + to.size,
          )
        ) {
          return false;
        }
        landed.push(to);
      }
      return true;
    },
    [buildings, lookup, printsById],
  );

  /** Ids whose footprint covers this tile. */
  const idsAt = useCallback(
    (point: Point) =>
      buildings
        .filter((b) => {
          const f = printsById.get(b.id);
          return (
            f &&
            point.x >= f.x + BOARD_OFFSET &&
            point.x < f.x + BOARD_OFFSET + f.size &&
            point.y >= f.y + BOARD_OFFSET &&
            point.y < f.y + BOARD_OFFSET + f.size
          );
        })
        .map((b) => b.id),
    [buildings, printsById],
  );

  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    drag.current = null;
    setDraft(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!current) return;

    // The URL is written once, here — not on every pointermove.
    if (current.kind === "hero") {
      if (current.at) onMoveHero(current.slot, current.at);
    } else if (current.kind === "paint" && current.placed.length > 0) {
      onPlaceMany(current.placed);
    } else if (current.kind === "erase") {
      if (current.ids.length > 0) onErase(current.ids);
    } else if (current.kind === "marquee") {
      onSelect(idsInRect(current.from, current.to));
    } else if (current.kind === "move") {
      if (current.moved) {
        onMoveMany(
          current.ids.flatMap((id) => {
            const from = printsById.get(id);
            return from
              ? [{ id, x: from.x + current.delta.x, y: from.y + current.delta.y }]
              : [];
          }),
        );
      } else {
        // A click, not a drag: the selection was already set on pointerdown.
        onSelect(current.ids);
      }
    }
  };

  /** Buildings whose footprint intersects the marquee, in board space. */
  const idsInRect = (a: Point, b: Point) => {
    const x0 = Math.min(a.x, b.x);
    const x1 = Math.max(a.x, b.x);
    const y0 = Math.min(a.y, b.y);
    const y1 = Math.max(a.y, b.y);
    return buildings
      .filter((building) => {
        const f = printsById.get(building.id);
        if (!f) return false;
        const fx = f.x + BOARD_OFFSET;
        const fy = f.y + BOARD_OFFSET;
        return fx < x1 && x0 < fx + f.size && fy < y1 && y0 < fy + f.size;
      })
      .map((building) => building.id);
  };

  const startBuildingDrag = (
    e: React.PointerEvent<SVGRectElement>,
    building: PlacedBuilding,
    type: BuildingType,
  ) => {
    e.stopPropagation();
    if (mode !== "sandbox") return;

    if (erasing) {
      drag.current = { kind: "erase", ids: [building.id], last: { x: building.x + BOARD_OFFSET, y: building.y + BOARD_OFFSET } };
      svgRef.current?.setPointerCapture(e.pointerId);
      setDraft(drag.current);
      return;
    }

    /*
      Shift or Ctrl adds to the selection; a plain grab on something already
      selected keeps the group so it can be dragged as one. A plain grab on
      anything else starts a fresh selection, which is what every canvas
      editor does and what makes a mis-click cheap.
    */
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const ids = additive
      ? selectedIds.includes(building.id)
        ? selectedIds.filter((id) => id !== building.id)
        : [...selectedIds, building.id]
      : selectedIds.includes(building.id)
        ? selectedIds
        : [building.id];

    onSelect(ids);
    drag.current = {
      kind: "move",
      ids,
      anchor: { x: building.x, y: building.y, size: type.size },
      delta: { x: 0, y: 0 },
      moved: false,
    };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const moving = draft?.kind === "move" && draft.moved ? draft : null;
  const movingIds = new Set(moving?.ids ?? []);
  const erasingIds = new Set(draft?.kind === "erase" ? draft.ids : []);
  const marquee = draft?.kind === "marquee" ? draft : null;
  const painted = draft?.kind === "paint" ? draft.placed : [];

  // Recomputed only when the layout changes, not on every pointer move.
  const noDeploy = useMemo(
    () => exclusionRuns(buildings, lookup),
    [buildings, lookup],
  );

  return (
    /*
      The frame is the square the diamond is inscribed in, and the only thing
      that carries a size — drag its corner and the board scales with it. The
      board itself is turned inside it; nothing in tile space knows.
    */
    <div className="village-frame">
    <svg
      ref={svgRef}
      viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
      className="village-board touch-none select-none rounded-xl border border-border"
      style={{ background: "var(--deploy)" }}
      role="application"
      aria-label="Village grid"
      onPointerMove={(e) => {
        const current = drag.current;
        const point = toTile(e.clientX, e.clientY);

        if (current?.kind === "hero") {
          drag.current = { ...current, at: point };
          onHeroPreview(current.slot, point);
          return;
        }

        if (current?.kind === "move") {
          // The delta comes from the grabbed building; everything else in the
          // selection rides along by the same whole-tile offset.
          const next = snapFootprint(point, current.anchor.size);
          const delta = {
            x: next.x - current.anchor.x,
            y: next.y - current.anchor.y,
          };
          if (
            (delta.x !== current.delta.x || delta.y !== current.delta.y) &&
            groupFits(current.ids, delta)
          ) {
            drag.current = { ...current, delta, moved: true };
            setDraft(drag.current);
          }
          return;
        }

        if (current?.kind === "erase") {
          /*
            Walk the tiles between this sample and the last one, exactly as
            painting does. A quick sweep fires a handful of pointermove events,
            and sampling only where they landed rubs out every third wall and
            leaves the rest standing.
          */
          const found = new Set(current.ids);
          for (const step of tilesBetween(
            { x: Math.floor(current.last.x), y: Math.floor(current.last.y) },
            { x: Math.floor(point.x), y: Math.floor(point.y) },
          )) {
            for (const id of idsAt({ x: step.x + 0.5, y: step.y + 0.5 })) {
              found.add(id);
            }
          }
          if (found.size !== current.ids.length) {
            drag.current = { ...current, ids: [...found], last: point };
            setDraft(drag.current);
          } else {
            drag.current = { ...current, last: point };
          }
          return;
        }

        if (current?.kind === "marquee") {
          drag.current = { ...current, to: point };
          setDraft(drag.current);
          return;
        }

        if (current?.kind === "paint" && placingType) {
          const next = snapFootprint(point, placingType.size);
          const from = current.placed[current.placed.length - 1] ?? next;

          // Fill the gap: a quick drag only fires a handful of pointermove
          // events, which would otherwise leave holes in the wall run.
          const placed = [...current.placed];
          let changed = false;
          for (const step of tilesBetween(from, next)) {
            const f = { x: step.x, y: step.y, size: placingType.size };
            if (placed.some((p) => p.x === f.x && p.y === f.y)) continue;
            if (!legal(f, undefined, placed)) continue;
            placed.push(f);
            changed = true;
          }

          if (changed) {
            drag.current = { ...current, placed };
            setDraft(drag.current);
          }
          return;
        }

        if (mode === "sandbox" && placingType) {
          setPreview(snapFootprint(point, placingType.size));
        }
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={(e) => {
        endDrag(e);
        setPreview(null);
      }}
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) return;
        const point = toTile(e.clientX, e.clientY);

        if (mode !== "sandbox") {
          // Clicking the ground moves whoever is closest to it. With one unit
          // that is the old behaviour; with two it is the only reading that
          // does not need a "which hero" control.
          const nearest = closestUnit(units, point);
          if (nearest) onMoveHero(nearest.slot, point);
          return;
        }

        // Erasing takes the empty ground too, so a sweep that starts just off
        // a wall still rubs out the run it crosses.
        if (erasing) {
          drag.current = { kind: "erase", ids: idsAt(point), last: point };
          setDraft(drag.current);
          svgRef.current?.setPointerCapture(e.pointerId);
          return;
        }

        /*
          Shift on empty ground pulls a marquee instead of painting. Plain drag
          has to keep painting — that is the whole point of a wall run — so the
          modifier is what distinguishes "select an area" from "fill an area".
        */
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          drag.current = { kind: "marquee", from: point, to: point };
          setDraft(drag.current);
          svgRef.current?.setPointerCapture(e.pointerId);
          return;
        }

        onSelect([]);
        if (!placingType) return;

        const footprint = snapFootprint(point, placingType.size);
        if (!legal(footprint)) return;

        if (paintable) {
          drag.current = { kind: "paint", placed: [footprint] };
          setDraft(drag.current);
          svgRef.current?.setPointerCapture(e.pointerId);
        } else {
          onPlaceMany([footprint]);
        }
      }}
    >
      <defs>
        <pattern id="tiles" width="1" height="1" patternUnits="userSpaceOnUse">
          <path
            d="M1 0 L0 0 0 1"
            fill="none"
            stroke="var(--grid-minor)"
            strokeWidth="0.09"
          />
        </pattern>
      </defs>

      <g pointerEvents="none">
        <rect
          x={BOARD_OFFSET}
          y={BOARD_OFFSET}
          width={VILLAGE_SIZE}
          height={VILLAGE_SIZE}
          fill="var(--village)"
        />
        {/* Single tile grid across the whole board — no major lines. */}
        <rect width={BOARD_SIZE} height={BOARD_SIZE} fill="url(#tiles)" />
        <rect
          x={BOARD_OFFSET}
          y={BOARD_OFFSET}
          width={VILLAGE_SIZE}
          height={VILLAGE_SIZE}
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth="0.14"
          strokeDasharray="0.8 0.5"
        />
      </g>

      {/*
        Where no unit may be deployed: the union of every building's one-tile
        ring, merged into horizontal runs so overlapping rings are drawn once
        and neighbouring buildings read as one continuous band.
      */}
      <g pointerEvents="none" fill="var(--no-deploy)">
        {noDeploy.map((run) => (
          <rect
            key={`${run.y}:${run.x}`}
            x={run.x}
            y={run.y}
            width={run.width}
            height={1}
          />
        ))}
      </g>

      <g pointerEvents="none">
        {ghosts.map((ghost, i) => (
          <line
            key={i}
            x1={ghost.segment.a.x}
            y1={ghost.segment.a.y}
            x2={ghost.segment.b.x}
            y2={ghost.segment.b.y}
            stroke="var(--hit)"
            strokeWidth={ghost.halfWidth * 2}
            strokeOpacity="0.18"
            strokeLinecap="round"
          />
        ))}
        {/*
          Each unit's path is drawn in that unit's own colour rather than a
          shared one. With two lines crossing, a single colour makes the
          overlap unreadable — and the overlap is the thing the pair drill is
          about.
        */}
        {units.map((unit) =>
          unit.segment ? (
            <g key={unit.slot}>
              <line
                x1={unit.segment.a.x}
                y1={unit.segment.a.y}
                x2={unit.segment.b.x}
                y2={unit.segment.b.y}
                stroke={unit.colour}
                strokeWidth={unit.halfWidth * 2}
                strokeOpacity="0.26"
                strokeLinecap="round"
              />
              <line
                x1={unit.segment.a.x}
                y1={unit.segment.a.y}
                x2={unit.segment.b.x}
                y2={unit.segment.b.y}
                stroke={unit.colour}
                strokeWidth="0.18"
                strokeDasharray="1 0.6"
              />
            </g>
          ) : null,
        )}
      </g>

      {buildings.map((building) => {
        const type = lookup(building.typeId);
        if (!type) return null;
        // Everything in a group move is drawn at its dragged position, so the
        // whole selection travels together rather than one building leading.
        const shift = movingIds.has(building.id) && moving ? moving.delta : null;
        const at = shift
          ? { x: building.x + shift.x, y: building.y + shift.y }
          : building;

        return (
          <BuildingShape
            key={building.id}
            x={at.x + BOARD_OFFSET}
            y={at.y + BOARD_OFFSET}
            type={type}
            hit={hitIds.includes(building.id)}
            both={bothIds.includes(building.id)}
            aura={auraIds.includes(building.id)}
            target={building.id === targetId}
            selected={selectedIds.includes(building.id)}
            erasing={erasingIds.has(building.id)}
            interactive={mode === "sandbox"}
            onPointerDown={(e) => startBuildingDrag(e, building, type)}
          />
        );
      })}

      {/* The area being swept for selection. */}
      {marquee && (
        <rect
          x={Math.min(marquee.from.x, marquee.to.x)}
          y={Math.min(marquee.from.y, marquee.to.y)}
          width={Math.abs(marquee.to.x - marquee.from.x)}
          height={Math.abs(marquee.to.y - marquee.from.y)}
          fill="var(--accent)"
          fillOpacity="0.12"
          stroke="var(--accent)"
          strokeWidth="0.15"
          strokeDasharray="0.6 0.4"
          pointerEvents="none"
        />
      )}

      {/* Tiles laid down during the current paint drag. */}
      {painted.map((f) => (
        <rect
          key={`${f.x}:${f.y}`}
          x={f.x + BOARD_OFFSET}
          y={f.y + BOARD_OFFSET}
          width={f.size}
          height={f.size}
          fill="var(--cat-wall)"
          fillOpacity="0.7"
          pointerEvents="none"
        />
      ))}

      {mode === "sandbox" && preview && !draft && placingType && (
        <rect
          x={preview.x + BOARD_OFFSET}
          y={preview.y + BOARD_OFFSET}
          width={preview.size}
          height={preview.size}
          rx="0.3"
          fill={legal(preview) ? "var(--hit)" : "var(--invalid)"}
          fillOpacity="0.3"
          stroke={legal(preview) ? "var(--hit)" : "var(--invalid)"}
          strokeWidth="0.2"
          pointerEvents="none"
        />
      )}

      {units.map((unit) => (
        <g
          key={unit.slot}
          transform={`translate(${unit.at.x} ${unit.at.y})`}
          className="cursor-grab"
          onPointerDown={(e) => {
            e.stopPropagation();
            drag.current = { kind: "hero", slot: unit.slot, at: null };
            setPreview(null);
            svgRef.current?.setPointerCapture(e.pointerId);
          }}
        >
          {/* The ring is the one-tile gap the unit keeps from any building. */}
          <circle
            r={UNIT_CLEARANCE}
            fill={unit.colour}
            fillOpacity="0.16"
            stroke={unit.colour}
            strokeOpacity="0.4"
            strokeWidth="0.08"
            strokeDasharray="0.4 0.3"
          />
          <circle
            r="0.7"
            fill={unit.colour}
            stroke="var(--deploy)"
            strokeWidth="0.18"
          />
          <title>{`${unit.name} — drag to move`}</title>
        </g>
      ))}
    </svg>
    </div>
  );
}

/** Whoever is standing closest to a point. Null when nobody is on the board. */
function closestUnit(units: BoardUnit[], point: Point): BoardUnit | null {
  let best: BoardUnit | null = null;
  let bestDistance = Infinity;
  for (const unit of units) {
    const d = Math.hypot(unit.at.x - point.x, unit.at.y - point.y);
    if (d < bestDistance) {
      bestDistance = d;
      best = unit;
    }
  }
  return best;
}

/** Integer tiles along the line from `a` to `b`, inclusive of `b`. */
function tilesBetween(
  a: { x: number; y: number },
  b: { x: number; y: number },
): Array<{ x: number; y: number }> {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return [{ x: b.x, y: b.y }];

  const out: Array<{ x: number; y: number }> = [];
  for (let i = 1; i <= steps; i++) {
    out.push({
      x: Math.round(a.x + (dx * i) / steps),
      y: Math.round(a.y + (dy * i) / steps),
    });
  }
  return out;
}

/**
 * Memoised because a walled base is a few hundred of these and the hero can be
 * dragged across the board at 60fps.
 */
const BuildingShape = memo(function BuildingShape({
  x,
  y,
  type,
  hit,
  both,
  aura,
  target,
  selected,
  erasing,
  interactive,
  onPointerDown,
}: {
  x: number;
  y: number;
  type: BuildingType;
  hit: boolean;
  /** Crossed by both heroes — the pair's payoff, so it gets its own outline. */
  both: boolean;
  /** Only inside the aura. Partial credit, so a fainter mark than a hit. */
  aura: boolean;
  target: boolean;
  selected: boolean;
  /** Marked for removal by the current erase drag, not yet committed. */
  erasing: boolean;
  interactive: boolean;
  onPointerDown: (e: React.PointerEvent<SVGRectElement>) => void;
}) {
  const isWall = type.category === "wall";
  const inset = isWall ? 0 : 0.08;
  /*
    Footprints turn with the board — a tile is a diamond now — but what sits
    on them does not. A building's art is a picture of a thing standing on the
    ground, so it is turned back about its own centre and stays upright, the
    way the game draws it.
  */
  const upright = `rotate(${-BOARD_TILT} ${x + type.size / 2} ${y + type.size / 2})`;

  return (
    <g>
      {type.image && (
        <image
          href={withBasePath(type.image)}
          x={x}
          y={y}
          width={type.size}
          height={type.size}
          transform={upright}
          preserveAspectRatio="xMidYMid slice"
          opacity={hit ? 1 : 0.85}
          pointerEvents="none"
        />
      )}
      <rect
        x={x + inset}
        y={y + inset}
        width={type.size - inset * 2}
        height={type.size - inset * 2}
        rx={isWall ? 0.08 : 0.35}
        fill={type.image ? "transparent" : CATEGORY_FILL[type.category]}
        fillOpacity={type.image ? 0 : hit ? 0.95 : aura ? 0.75 : 0.62}
        stroke={
          erasing
            ? "var(--invalid)"
            : selected
              ? "var(--accent)"
              : both
                ? "var(--hero-duke)"
                : target
                  ? "var(--path)"
                  : hit
                    ? "var(--hit)"
                    : aura
                      ? "var(--hit)"
                      : "transparent"
        }
        strokeOpacity={aura && !hit && !both ? 0.5 : 1}
        strokeDasharray={aura && !hit && !both ? "0.5 0.35" : undefined}
        strokeWidth={selected || erasing ? 0.3 : both ? 0.34 : 0.22}
        className={interactive ? "cursor-move" : undefined}
        onPointerDown={onPointerDown}
      >
        <title>
          {`${type.name}${both ? " — hit by both" : hit ? " — hit" : aura ? " — in aura" : ""}`}
        </title>
      </rect>

      {!type.image && glyphFits(type.size) && (
        <g
          pointerEvents="none"
          transform={`${upright} translate(${x} ${y}) scale(${type.size / 10})`}
          style={{ color: "var(--glyph)" }}
          opacity={hit ? 0.95 : 0.65}
        >
          {glyphFor(type.id, type.category)}
        </g>
      )}
    </g>
  );
});
