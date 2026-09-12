"use client";

import { memo, useCallback, useRef } from "react";
import {
  BOARD_OFFSET,
  BOARD_SIZE,
  VILLAGE_SIZE,
  type BuildingType,
  type PlacedBuilding,
} from "@/lib/schema/building";
import type { Point } from "@/lib/practice/geometry";
import {
  ISO_HEIGHT,
  ISO_SPRITE_NUDGE,
  ISO_SPRITE_SCALE,
  ISO_TILE_H,
  fromIso,
  isoExtent,
  isoFace,
  isoSides,
  isoSprite,
  sortByDepth,
  toIso,
} from "@/lib/practice/iso";
import {
  UNIT_CLEARANCE,
  footprintOf,
  type Footprint,
} from "@/lib/practice/placement";
import { withBasePath } from "@/lib/site";
import type { BoardUnit } from "./Village";

/**
 * The 2.5D board: the same village, drawn in the projection the game uses.
 *
 * Every building is one of two things. If an isometric render has been
 * fetched for its type it is drawn as a sprite standing on its tile; if not
 * it is a shaded box extruded from the same footprint. The two sit side by
 * side deliberately — 47 building types is a lot of art to wait for, and a
 * board that only works once the last file lands is a board nobody uses.
 *
 * Draw order is back to front by footprint centre, so a nearer building
 * covers what is behind it. That is the whole trick of a 2.5D view and it is
 * why `sortByDepth` is tested rather than eyeballed.
 *
 * Read-only on purpose. Placement is fiddly enough on a flat grid; the flat
 * board stays the one you build on, and this one is for seeing what you built.
 */

const CATEGORY_FILL: Record<BuildingType["category"], string> = {
  core: "var(--cat-core)",
  defence: "var(--cat-defence)",
  wall: "var(--cat-wall)",
  resource: "var(--cat-resource)",
  army: "var(--cat-army)",
  other: "var(--cat-other)",
};

/** Headroom above the back corner, in tile heights, for the tallest thing. */
const TOP_MARGIN = 6;

export function VillageIso({
  buildings,
  lookup,
  units,
  hitIds,
  bothIds,
  auraIds,
  targetId,
  art,
  onMoveHero,
}: {
  buildings: PlacedBuilding[];
  lookup: (id: string) => BuildingType | undefined;
  units: BoardUnit[];
  hitIds: string[];
  bothIds: string[];
  auraIds: string[];
  targetId: string | null;
  /** Iso renders by type id, resolved server-side. Missing = drawn box. */
  art: Record<string, { src: string; aspect: number }>;
  onMoveHero: (slot: string, point: Point) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  /** Which unit the current drag is carrying, if any. */
  const dragging = useRef<string | null>(null);

  const box = isoExtent(BOARD_SIZE, TOP_MARGIN);

  /** Screen point -> tile, through the SVG matrix and back out of iso. */
  const toTile = useCallback((clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const local = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return fromIso(local.x, local.y);
  }, []);

  /*
    Building coordinates are stored in *village* space; the floor, the hero and
    the shot line are all in board space, which is the village plus the deploy
    border. `footprintOf` hands back the village-space one, so it has to be
    shifted by BOARD_OFFSET here exactly as the flat board does when it draws —
    without it every building sits three tiles off its own tile.
  */
  const ordered = sortByDepth(
    buildings.flatMap((building) => {
      const type = lookup(building.typeId);
      const village = type ? footprintOf(building, lookup) : null;
      if (!type || !village) return [];
      /*
        A Hidden Tesla is not on the board until it fires, and this view is
        what the attacker is looking at. It still stands there, still takes an
        ability and still scores — it just gives no warning, which is the
        whole point of it. The flat board is the planning view and shows it.
      */
      if (type.concealed) return [];
      const footprint: Footprint = {
        x: village.x + BOARD_OFFSET,
        y: village.y + BOARD_OFFSET,
        size: village.size,
      };
      return [{ building, type, footprint }];
    }),
    (item) => item.footprint,
  );

  /**
   * Whoever is standing closest to a tile. The board is read-only apart from
   * the heroes, so a press picks the nearest one up rather than asking which.
   */
  const closest = (point: Point): BoardUnit | null => {
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
  };

  return (
    /*
      The frame's shape comes from the projection, never from a number typed
      into CSS: change the tile ratio and the box that holds it follows, so the
      board can never end up letterboxed inside a stale aspect.
    */
    <div
      className="village-frame village-frame--iso"
      style={{ aspectRatio: `${box.width} / ${box.height}` }}
    >
      <svg
        ref={svgRef}
        viewBox={`${box.minX} ${box.minY} ${box.width} ${box.height}`}
        className="village-board village-board--iso touch-none select-none"
        role="application"
        aria-label="Village, isometric view"
        onPointerDown={(e) => {
          const point = toTile(e.clientX, e.clientY);
          const unit = closest(point);
          if (!unit) return;
          dragging.current = unit.slot;
          e.currentTarget.setPointerCapture(e.pointerId);
          onMoveHero(unit.slot, point);
        }}
        onPointerMove={(e) => {
          if (dragging.current) {
            onMoveHero(dragging.current, toTile(e.clientX, e.clientY));
          }
        }}
        onPointerUp={(e) => {
          dragging.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        onPointerCancel={() => {
          dragging.current = null;
        }}
      >
        {/* The deploy border, then the village floor inside it. */}
        <polygon
          points={isoFace({ x: 0, y: 0, size: BOARD_SIZE })}
          fill="var(--deploy)"
        />
        <polygon
          points={isoFace({
            x: BOARD_OFFSET,
            y: BOARD_OFFSET,
            size: VILLAGE_SIZE,
          })}
          fill="var(--village)"
          stroke="var(--border-strong)"
          strokeWidth="0.12"
        />

        {/*
          Grid lines, as the two families of diagonals. Faint on purpose: the
          game shows no lattice over the grass at all, and at 50 tiles a side
          a crisp grid is 100 lines competing with the buildings for
          attention. Enough to read a tile position off, not enough to look at.
        */}
        <g
          pointerEvents="none"
          stroke="var(--grid-minor)"
          strokeWidth="0.02"
          opacity="0.25"
        >
          {Array.from({ length: BOARD_SIZE + 1 }, (_, i) => {
            const a = toIso(i, 0);
            const b = toIso(i, BOARD_SIZE);
            const c = toIso(0, i);
            const d = toIso(BOARD_SIZE, i);
            return (
              <g key={i}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                <line x1={c.x} y1={c.y} x2={d.x} y2={d.y} />
              </g>
            );
          })}
        </g>

        {/* The shots, on the ground under everything that stands on them. */}
        {units.map((unit) =>
          unit.segment ? (
            <line
              key={unit.slot}
              x1={toIso(unit.segment.a.x, unit.segment.a.y).x}
              y1={toIso(unit.segment.a.x, unit.segment.a.y).y}
              x2={toIso(unit.segment.b.x, unit.segment.b.y).x}
              y2={toIso(unit.segment.b.x, unit.segment.b.y).y}
              stroke={unit.colour}
              strokeWidth="0.35"
              strokeLinecap="round"
              pointerEvents="none"
            />
          ) : null,
        )}

        {ordered.map(({ building, type, footprint }) => (
          <IsoBuilding
            key={building.id}
            footprint={footprint}
            type={type}
            art={art[type.id]}
            hit={hitIds.includes(building.id)}
            both={bothIds.includes(building.id)}
            aura={auraIds.includes(building.id)}
            target={targetId === building.id}
          />
        ))}

        {/* The heroes last: they stand in front of the base, not inside it. */}
        {units.map((unit) => {
          const at = toIso(unit.at.x, unit.at.y);
          return (
            <g
              key={unit.slot}
              transform={`translate(${at.x} ${at.y})`}
              pointerEvents="none"
            >
              <ellipse
                rx={UNIT_CLEARANCE * 2}
                ry={UNIT_CLEARANCE}
                fill={unit.colour}
                fillOpacity="0.16"
                stroke={unit.colour}
                strokeOpacity="0.4"
                strokeWidth="0.06"
                strokeDasharray="0.4 0.3"
              />
              <ellipse rx="0.7" ry="0.35" fill={unit.colour} fillOpacity="0.35" />
              <circle
                cy={-0.9}
                r="0.55"
                fill={unit.colour}
                stroke="var(--deploy)"
                strokeWidth="0.14"
              />
              <title>{unit.name}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const IsoBuilding = memo(function IsoBuilding({
  footprint,
  type,
  art,
  hit,
  both,
  aura,
  target,
}: {
  footprint: Footprint;
  type: BuildingType;
  art?: { src: string; aspect: number };
  hit: boolean;
  both: boolean;
  aura: boolean;
  target: boolean;
}) {
  // Crossed by both heroes outranks everything: it is the whole point of the
  // pair drill, and it is the one state you want to spot at a glance.
  const outline = both
    ? "var(--hero-duke)"
    : target
      ? "var(--path)"
      : hit
        ? "var(--hit)"
        : aura
          ? "var(--hit)"
          : null;
  /** An aura clip is partial credit, so it gets a partial mark. */
  const faint = aura && !hit && !both;
  const label = `${type.name}${both ? " — hit by both" : hit ? " — hit" : aura ? " — in aura" : ""}`;

  if (art) {
    const placed = isoSprite(
      footprint,
      art.aspect,
      ISO_SPRITE_SCALE[type.id],
      ISO_SPRITE_NUDGE[type.id],
    );
    const isWall = type.category === "wall";

    return (
      <g>
        {/*
          The patch of ground the building stands on, a shade lighter than the
          grass around it. It reads as a cleared plot the way the game's does,
          and it is what makes a footprint legible under art that is narrower
          than its own tile.
        */}
        <polygon points={isoFace(footprint)} fill="var(--village-pad)" />

        {/*
          Walls butt up against each other in game and read as one run; the
          renders are single posts with daylight between them once they are
          drawn at footprint width. Extruding the tile into a short block under
          the sprite closes those gaps — adjacent footprints touch exactly, so
          the blocks form a continuous band with no seam to line up.
        */}
        {isWall && (
          <>
            <polygon points={isoSides(footprint, ISO_HEIGHT.wall).right} fill="var(--wall-side)" />
            <polygon points={isoSides(footprint, ISO_HEIGHT.wall).front} fill="var(--wall-front)" />
            <polygon
              points={isoFace(footprint, ISO_HEIGHT.wall * ISO_TILE_H)}
              fill="var(--wall-top)"
            />
          </>
        )}

        {/* A footprint tint under the sprite, so a hit still reads when the
            art covers its own tile. */}
        {outline && (
          <polygon
            points={isoFace(footprint)}
            fill={outline}
            fillOpacity={faint ? 0.15 : 0.35}
            stroke={outline}
            strokeWidth={both ? 0.2 : 0.12}
            strokeDasharray={faint ? "0.4 0.3" : undefined}
          />
        )}
        <image
          href={withBasePath(art.src)}
          x={placed.x}
          y={placed.y}
          width={placed.width}
          height={placed.height}
          opacity={hit ? 1 : 0.94}
          preserveAspectRatio="xMidYMax meet"
        >
          <title>{label}</title>
        </image>
      </g>
    );
  }

  // No render for this type yet: extrude the footprint into a box. The top
  // face is the tile lifted, the two visible sides are shaded down from it.
  const height = ISO_HEIGHT[type.category];
  const sides = isoSides(footprint, height);
  const fill = CATEGORY_FILL[type.category];

  return (
    <g>
      <polygon points={sides.right} fill={fill} fillOpacity={hit ? 0.75 : 0.5} />
      <polygon points={sides.front} fill={fill} fillOpacity={hit ? 0.6 : 0.38} />
      <polygon
        points={isoFace(footprint, height * ISO_TILE_H)}
        fill={fill}
        fillOpacity={hit ? 1 : 0.85}
        stroke={outline ?? "var(--border-strong)"}
        strokeWidth={outline ? 0.14 : 0.05}
      >
        <title>{label}</title>
      </polygon>
    </g>
  );
});
