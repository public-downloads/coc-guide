"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Village, type BoardUnit, type GhostLine } from "./Village";
import { VillageIso } from "./VillageIso";
import {
  ABILITIES,
  ABILITY_IDS,
  computePair,
  computeShot,
  findBestPair,
  findBestShot,
  HERO_SLOTS,
  PAIR_ABILITY,
  type AbilityId,
  type HeroSlot,
} from "@/lib/practice/shot";
import {
  decodeLayout,
  decodeStand,
  encodeLayout,
  encodeStand,
} from "@/lib/practice/layout";
import type { Point, Segment } from "@/lib/practice/geometry";
import { HEROES } from "@/lib/schema/hero";
import {
  checkPlacement,
  nearestLegalStand,
  tileCentre,
  UNIT_CLEARANCE,
} from "@/lib/practice/placement";
import { allowanceFor, canPlaceAnother } from "@/lib/practice/limits";
import {
  BOARD_SIZE,
  isAvailableAt,
  MAX_TH,
  maxLevelAt,
  TH_LEVELS,
  type BuildingCategory,
  type BuildingType,
  type PlacedBuilding,
} from "@/lib/schema/building";
import type { Equipment } from "@/lib/schema/equipment";
import { formatNumber, humaniseKey } from "@/lib/format";
import { Badge, DataQualityBadge } from "@/components/ui/Badge";
import { localePath, type Locale } from "@/lib/i18n/config";
import { fill, type Dictionary } from "@/lib/i18n/dictionaries";

/** A preset base, its buildings compressed with the share-link codec. */
export interface EncodedBase {
  id: string;
  name: string;
  description: string;
  layout: string;
}

export interface TrainerProps {
  types: BuildingType[];
  bases: EncodedBase[];
  equipment: Partial<Record<AbilityId, Equipment>>;
  /**
   * Isometric renders by building type id, resolved server-side because the
   * lookup reads the filesystem. A type missing from here gets the drawn box.
   */
  isoArt: Record<string, { src: string; aspect: number }>;
  t: Dictionary;
  locale: Locale;
}

/**
 * The drill can be one ability or the pair. `PAIR` is a value of the same `a`
 * URL parameter rather than a separate flag, because it is the same choice:
 * what you are practising.
 */
const PAIR = "pair";
type Drill = AbilityId | typeof PAIR | null;

/** Which hero brings each ability. One each — there is nothing to choose. */
const SLOT_FOR: Record<AbilityId, HeroSlot> = {
  "giant-arrow": "queen",
  "rocket-backpack": "duke",
};

/** Opposite edges, so the pair does not start standing on each other. */
const DEFAULT_POSITION: Record<HeroSlot, Point> = {
  queen: tileCentre({ x: BOARD_SIZE / 2, y: 0 }),
  duke: tileCentre({ x: 0, y: BOARD_SIZE / 2 }),
};

const HERO_COLOUR: Record<HeroSlot, string> = {
  queen: "var(--hero)",
  duke: "var(--hero-duke)",
};

/** A slot always belongs to the same hero, ability or no ability. */
const HERO_NAME: Record<HeroSlot, string> = {
  queen: HEROES[ABILITIES[PAIR_ABILITY.queen].heroId].name,
  duke: HEROES[ABILITIES[PAIR_ABILITY.duke].heroId].name,
};

/** What the board and the panels read, whether one hero is out or two. */
interface DrillView {
  segments: Partial<Record<HeroSlot, Segment | null>>;
  /** What the Queen is attacking; the Duke never has one. */
  targetId: string | null;
  hitIds: string[];
  bothIds: string[];
  auraIds: string[];
  score: number;
  defencesHit: number;
}

/** The solver's answer, in the one shape both drills report it. */
interface BestView {
  score: number;
  ghosts: GhostLine[];
  moveTo: Partial<Record<HeroSlot, Point>>;
}

/** Rendered when no ability is selected: a board with no line on it. */
const EMPTY_VIEW: DrillView = {
  segments: {},
  targetId: null,
  hitIds: [],
  bothIds: [],
  auraIds: [],
  score: 0,
  defencesHit: 0,
};

const CATEGORY_ORDER: BuildingCategory[] = [
  "core",
  "defence",
  "wall",
  "resource",
  "army",
  "other",
];

export function Trainer({
  types,
  bases,
  equipment,
  isoArt,
  t,
  locale,
}: TrainerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [placingType, setPlacingType] = useState(types[0]?.id ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [erasing, setErasing] = useState(false);
  const [search, setSearch] = useState("");

  const typeIds = useMemo(() => types.map((t) => t.id), [types]);
  const byType = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const lookup = useCallback((id: string) => byType.get(id), [byType]);

  const raw = params.get("a");
  const drill: Drill =
    raw === PAIR
      ? PAIR
      : ABILITY_IDS.includes(raw as AbilityId)
        ? (raw as AbilityId)
        : raw === "none"
          ? null
          : "giant-arrow";
  const pair = drill === PAIR;
  const ability: AbilityId | null = pair ? null : drill;
  const spec = ability ? ABILITIES[ability] : null;

  /*
    Who is on the board. The pair puts both out; a solo drill puts out the one
    hero who owns the ability, and `a=none` leaves the Queen standing there
    with no line so the marker is still there to drag.
  */
  const slots: HeroSlot[] = pair
    ? [...HERO_SLOTS]
    : [ability ? SLOT_FOR[ability] : "queen"];

  /**
   * URL key for a hero's position or equipment level. A solo drill has one
   * hero, so it uses the unsuffixed keys the trainer has always used and every
   * link ever shared keeps working; only the pair needs a second set.
   */
  const keyFor = useCallback(
    (base: string, slot: HeroSlot) =>
      pair && slot === "duke" ? `${base}2` : base,
    [pair],
  );

  const sandbox = params.get("edit") === "1";
  /*
    Which board is showing. In the URL with the rest of the drill state, so a
    shared link opens on the view it was shared from. Placement is a flat-board
    job, so opening the sandbox implies the flat board.
  */
  const isoView = params.get("v") === "iso" && !sandbox;
  const showBest = params.get("best") === "1";
  const customLayout = params.get("b");
  const th = clamp(Number(params.get("th")) || MAX_TH, 1, MAX_TH);
  const baseId = params.get("base") ?? bases[0]?.id ?? "";

  const { buildings, layoutErrors } = useMemo(() => {
    const source =
      customLayout ??
      (bases.find((b) => b.id === baseId) ?? bases[0])?.layout ??
      "";
    const decoded = decodeLayout(source, typeIds);
    return { buildings: decoded.buildings, layoutErrors: decoded.errors };
  }, [customLayout, baseId, bases, typeIds]);

  /** The ability a given hero is holding in this drill, if any. */
  const specFor = useCallback(
    (slot: HeroSlot) =>
      pair ? ABILITIES[PAIR_ABILITY[slot]] : ability ? ABILITIES[ability] : null,
    [pair, ability],
  );

  /*
    While a hero is being dragged their position lives here rather than in the
    URL — a router.replace per pointermove is a route re-render per mouse move.
    Each preview is tagged with the URL it was taken from, so an external
    change (a pasted link) wins instead of being masked by a stale drag, and
    keying by slot keeps one hero's drag from moving the other.
  */
  const [heroPreview, setHeroPreview] = useState<
    Partial<Record<HeroSlot, { point: Point; from: string }>>
  >({});

  /*
    Settled on read as well as on write, so a pasted link cannot stand a hero
    inside a building or on the no-deploy shading — the URL is the source of
    truth, and it is a text field anyone can edit.
  */
  const positions = useMemo(() => {
    const out = {} as Record<HeroSlot, Point>;
    for (const slot of HERO_SLOTS) {
      const encoded = params.get(keyFor("h", slot)) ?? "";
      const decoded = decodeStand(encoded) ?? DEFAULT_POSITION[slot];
      const area =
        (pair
          ? ABILITIES[PAIR_ABILITY[slot]]
          : ability
            ? ABILITIES[ability]
            : null
        )?.heroArea ?? "board";
      const preview = heroPreview[slot];
      out[slot] =
        preview && preview.from === encoded
          ? preview.point
          : nearestLegalStand(decoded, buildings, lookup, area);
    }
    return out;
  }, [params, keyFor, pair, ability, heroPreview, buildings, lookup]);

  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const merged = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value === null) merged.delete(key);
        else merged.set(key, value);
      }
      const query = merged.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [params, pathname, router],
  );

  const view: DrillView = useMemo(() => {
    if (pair) {
      const result = computePair({ positions, buildings, lookup });
      return {
        segments: {
          queen: result.lines.queen?.segment ?? null,
          duke: result.lines.duke?.segment ?? null,
        },
        targetId: result.lines.queen?.targetId ?? null,
        hitIds: result.hitIds,
        bothIds: result.bothIds,
        auraIds: result.auraIds,
        score: result.score,
        defencesHit: result.defencesHit,
      };
    }
    if (!ability) return EMPTY_VIEW;

    const slot = SLOT_FOR[ability];
    const result = computeShot({
      ability,
      hero: positions[slot],
      buildings,
      lookup,
    });
    const segments: Partial<Record<HeroSlot, Segment | null>> = {};
    segments[slot] = result.segment;

    return {
      segments,
      targetId: result.targetId,
      hitIds: result.hitIds,
      bothIds: [],
      auraIds: result.auraIds,
      score: result.score,
      defencesHit: result.defencesHit,
    };
  }, [pair, ability, positions, buildings, lookup]);

  /*
    Solving for the best line sweeps every legal hero position, so it is the
    most expensive thing on the page — and the pair sweeps both heroes. Both
    are deferred so placement and dragging paint first; the number catches up
    a frame later.
  */
  const deferredBuildings = useDeferredValue(buildings);
  const best = useMemo<BestView | null>(() => {
    if (pair) {
      const found = findBestPair(deferredBuildings, lookup);
      return found
        ? {
            score: found.result.score,
            ghosts: HERO_SLOTS.flatMap((slot) => {
              const line = found.result.lines[slot];
              return line
                ? [
                    {
                      segment: line.segment,
                      halfWidth: ABILITIES[PAIR_ABILITY[slot]].halfWidth,
                    },
                  ]
                : [];
            }),
            moveTo: found.positions,
          }
        : null;
    }
    if (!ability) return null;

    const found = findBestShot(ability, deferredBuildings, lookup);
    if (!found?.result.segment) return null;
    return {
      score: found.result.score,
      ghosts: [
        {
          segment: found.result.segment,
          halfWidth: ABILITIES[ability].halfWidth,
        },
      ],
      moveTo: { [SLOT_FOR[ability]]: found.hero } as Partial<
        Record<HeroSlot, Point>
      >,
    };
  }, [pair, ability, deferredBuildings, lookup]);

  /** One entry per hero on the board that has a catalogued equipment piece. */
  const loadout = slots.flatMap((slot) => {
    const heroSpec = specFor(slot);
    const piece = heroSpec ? equipment[heroSpec.id] : undefined;
    if (!heroSpec || !piece) return [];

    const key = keyFor("l", slot);
    const max = piece.maxLevel ?? 1;
    return [
      {
        slot,
        spec: heroSpec,
        piece,
        max,
        level: clamp(Number(params.get(key)) || max, 1, max),
        onLevel: (value: string) => setParams({ [key]: value }),
      },
    ];
  });

  /** Everyone on the board, with the line they are currently firing. */
  const units: BoardUnit[] = slots.map((slot) => ({
    slot,
    name: HERO_NAME[slot],
    at: positions[slot],
    segment: view.segments[slot] ?? null,
    halfWidth: specFor(slot)?.halfWidth ?? 1,
    colour: HERO_COLOUR[slot],
  }));

  const percentOfBest =
    best && best.score > 0 ? Math.round((view.score / best.score) * 100) : null;

  const targetName = view.targetId
    ? byType.get(
        buildings.find((b) => b.id === view.targetId)?.typeId ?? "",
      )?.name
    : null;

  /**
   * Where a hero actually lands. Whole tiles, because that is what the URL
   * stores — settling on a real coordinate and rounding it afterwards is what
   * used to drop a hero onto the no-deploy shading.
   */
  const landing = (slot: HeroSlot, p: Point) =>
    nearestLegalStand(p, buildings, lookup, specFor(slot)?.heroArea ?? "board");

  const commitHero = (slot: string, p: Point) =>
    setParams({
      [keyFor("h", slot as HeroSlot)]: encodeStand(landing(slot as HeroSlot, p)),
    });

  const setLayout = (next: PlacedBuilding[]) =>
    setParams({ b: encodeLayout(next, typeIds), base: null });

  const query = search.trim().toLowerCase();
  const atThisTh = types.filter((type) => isAvailableAt(type, th));
  const matches = query
    ? atThisTh.filter(
        (t) => t.name.toLowerCase().includes(query) || t.id.includes(query),
      )
    : atThisTh;

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: matches.filter((t) => t.category === category),
  })).filter((g) => g.items.length > 0);

  const placingAllowed = (() => {
    const type = byType.get(placingType);
    return type ? canPlaceAnother(type, buildings, lookup, th) : false;
  })();

  const removeSelected = () => {
    if (selectedIds.length === 0) return;
    const gone = new Set(selectedIds);
    setLayout(buildings.filter((b) => !gone.has(b.id)));
    setSelectedIds([]);
  };

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setParams({ v: null })}
            className={`btn ${isoView ? "" : "btn-active"}`}
            aria-pressed={!isoView}
          >
            {t.practice.viewFlat}
          </button>
          <button
            type="button"
            onClick={() => setParams({ v: "iso", edit: null })}
            className={`btn ${isoView ? "btn-active" : ""}`}
            aria-pressed={isoView}
          >
            {t.practice.viewIso}
          </button>
          {isoView && (
            <span className="text-xs text-muted">{t.practice.isoNote}</span>
          )}
        </div>

        {isoView ? (
          <VillageIso
            buildings={buildings}
            lookup={lookup}
            units={units}
            hitIds={view.hitIds}
            bothIds={view.bothIds}
            auraIds={view.auraIds}
            targetId={view.targetId}
            art={isoArt}
            onMoveHero={commitHero}
          />
        ) : (
        <Village
          buildings={buildings}
          lookup={lookup}
          units={units}
          ghosts={showBest ? (best?.ghosts ?? []) : []}
          hitIds={view.hitIds}
          bothIds={view.bothIds}
          auraIds={view.auraIds}
          targetId={view.targetId}
          mode={sandbox ? "sandbox" : "drill"}
          placingType={
            sandbox && placingAllowed ? (byType.get(placingType) ?? null) : null
          }
          selectedIds={selectedIds}
          erasing={erasing}
          onSelect={setSelectedIds}
          onErase={(ids) => {
            const gone = new Set(ids);
            setLayout(buildings.filter((b) => !gone.has(b.id)));
            setSelectedIds([]);
          }}
          onHeroPreview={(slot, p) =>
            setHeroPreview((current) => ({
              ...current,
              [slot]: {
                // The preview settles exactly where the drop will, so the
                // marker never jumps a tile when you let go.
                point: landing(slot as HeroSlot, p),
                from: params.get(keyFor("h", slot as HeroSlot)) ?? "",
              },
            }))
          }
          onMoveHero={commitHero}
          onPlaceMany={(footprints) => {
            const type = byType.get(placingType);
            if (!type) return;
            /*
              Re-check every footprint against the layout as it stands *now*,
              not as it stood when the drag began. The board validates while
              you paint, but it validates against the props it was rendered
              with, and a second drag starting before `router.replace` lands
              sees the layout without the first one — which is how two walls
              ended up on the same tile. Cheap, and the only place buildings
              are ever added.
            */
            const accepted: PlacedBuilding[] = [];
            for (const f of footprints) {
              if (!checkPlacement(f, [...buildings, ...accepted], lookup).ok) {
                continue;
              }
              accepted.push({
                id: `b${buildings.length + accepted.length}`,
                typeId: type.id,
                x: f.x,
                y: f.y,
              });
            }

            // A wall drag can ask for more than the Town Hall allows, so take
            // only as many as remain.
            const room = allowanceFor(type, buildings, lookup, th).remaining;
            const taking = room === null ? accepted : accepted.slice(0, room);
            if (taking.length === 0) return;
            setLayout([...buildings, ...taking]);
          }}
          onMoveMany={(moves) => {
            const by = new Map(moves.map((m) => [m.id, m]));
            setLayout(
              buildings.map((b) => {
                const move = by.get(b.id);
                return move ? { ...b, x: move.x, y: move.y } : b;
              }),
            );
          }}
        />
        )}

        <p className="text-sm text-muted">
          {sandbox
            ? t.practice.sandboxHelp
            : pair
              ? t.practice.pairHelp
              : spec
                ? `${spec.drill} The hero keeps ${UNIT_CLEARANCE} tile clear of every building — the dashed ring — so walls push them out.`
                : t.practice.noAbilityHelp}
        </p>

        {layoutErrors.length > 0 && (
          <ul className="surface-inset list-disc space-y-1 py-3 pl-8 pr-5 text-xs text-muted">
            {layoutErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </div>

      <aside className="flex flex-col gap-5">
        <Panel title={sandbox ? t.practice.placeBuildings : t.practice.base}>
          {sandbox ? (
            <>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={fill(t.practice.searchBuildings, {
                  count: atThisTh.length,
                })}
                aria-label="Search buildings"
                className="input mb-3 w-full"
              />
              {grouped.length === 0 && (
                <p className="mb-3 text-xs text-muted">
                  {t.practice.noMatch} &ldquo;{search}&rdquo;.
                </p>
              )}
              {/*
                `resize-y` needs a definite height to resize *from*, so this
                is `h-64` rather than `max-h-64` — the palette is the first
                panel now and how much of it you want open depends on whether
                you are placing a base or looking at the board.
              */}
              <div className="h-64 resize-y space-y-3 overflow-y-auto pr-1">
                {grouped.map((group) => (
                  <div key={group.category}>
                    <p className="text-[0.7rem] uppercase tracking-wide text-muted">
                      {t.practice.categories[group.category]}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {group.items.map((type) => {
                        const allowance = allowanceFor(
                          type,
                          buildings,
                          lookup,
                          th,
                        );
                        const full =
                          allowance.remaining !== null &&
                          allowance.remaining === 0;
                        const level = maxLevelAt(type, th);
                        return (
                          <button
                            key={type.id}
                            type="button"
                            disabled={full}
                            onClick={() => setPlacingType(type.id)}
                            title={[
                              type.name,
                              level ? `max level ${level} at TH${th}` : null,
                              // A merge block needs naming: a disabled
                              // Ricochet Cannon whose own count is 1/3 makes
                              // no sense until you know the Cannons are gone.
                              allowance.limitedBy === "merge"
                                ? `merged from ${mergeRecipe(type, byType)} — ${
                                    allowance.remaining === 0
                                      ? "none left"
                                      : `${allowance.remaining} more possible`
                                  }`
                                : allowance.max === null
                                  ? null
                                  : allowance.limitedBy === "crafted"
                                    ? `${allowance.used}/${allowance.max} crafted defence placed`
                                    : `${allowance.used}/${allowance.max} placed`,
                            ]
                              .filter(Boolean)
                              .join(" — ")}
                            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                              full
                                ? "cursor-not-allowed border-border text-muted opacity-40"
                                : placingType === type.id
                                  ? "border-accent bg-accent-soft text-accent"
                                  : "border-border text-muted hover:bg-surface-raised"
                            }`}
                          >
                            {type.name}
                            {level && (
                              <span className="ml-1 opacity-60">{level}</span>
                            )}
                            {allowance.max !== null && (
                              <span className="ml-1 tabular-nums opacity-45">
                                {allowance.used}/{allowance.max}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setErasing((on) => !on);
                    setSelectedIds([]);
                  }}
                  aria-pressed={erasing}
                  className={`btn ${erasing ? "btn-active" : ""}`}
                >
                  {t.practice.erase}
                </button>
                <button
                  type="button"
                  onClick={removeSelected}
                  disabled={selectedIds.length === 0}
                  className="btn disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t.practice.deleteSelected}
                  {selectedIds.length > 1 && (
                    <span className="tabular-nums opacity-60">
                      {selectedIds.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setParams({ b: "" });
                    setSelectedIds([]);
                  }}
                  className="btn"
                >
                  {t.practice.clear}
                </button>
                <button
                  type="button"
                  onClick={() => setParams({ edit: null })}
                  className="btn"
                >
                  {t.practice.done}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {bases.map((base) => (
                  <button
                    key={base.id}
                    type="button"
                    onClick={() => setParams({ base: base.id, b: null })}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      customLayout === null && baseId === base.id
                        ? "border-accent bg-accent-soft"
                        : "border-border hover:bg-surface-raised"
                    }`}
                  >
                    <span className="font-medium">{base.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {base.description}
                    </span>
                  </button>
                ))}
                {customLayout !== null && (
                  <p className="flex items-center gap-2 text-xs text-muted">
                    <Badge>{t.practice.custom}</Badge> {buildings.length}{" "}
                    {t.practice.customCount}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  setParams({
                    edit: "1",
                    b: encodeLayout(buildings, typeIds),
                    base: null,
                  })
                }
                className="btn mt-4"
              >
                {t.practice.editInSandbox}
              </button>
            </>
          )}
        </Panel>

        <Panel title={t.practice.ability}>
          <div className="flex flex-wrap gap-2">
            {ABILITY_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setParams({ a: id })}
                className={`btn ${drill === id ? "btn-active" : ""}`}
              >
                {ABILITIES[id].name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setParams({ a: PAIR })}
              className={`btn ${pair ? "btn-active" : ""}`}
            >
              {t.practice.pair}
            </button>
            <button
              type="button"
              onClick={() => setParams({ a: "none" })}
              className={`btn ${drill === null ? "btn-active" : ""}`}
            >
              {t.practice.noAbility}
            </button>
          </div>

          {loadout.map((entry) => (
            <EquipmentLevel
              key={entry.slot}
              // A single-ability drill has nothing to disambiguate, so the
              // hero's name only earns its line once both are out.
              hero={pair ? HERO_NAME[entry.slot] : null}
              colour={HERO_COLOUR[entry.slot]}
              piece={entry.piece}
              level={entry.level}
              max={entry.max}
              onLevel={entry.onLevel}
              t={t}
            />
          ))}
        </Panel>

        <Panel title={pair ? t.practice.theseLines : t.practice.thisLine}>
          <dl
            className={`grid gap-x-2 gap-y-3 ${pair ? "grid-cols-2" : "grid-cols-3"}`}
          >
            <Stat label={t.practice.score} value={view.score} />
            <Stat label={t.practice.defences} value={view.defencesHit} />
            <Stat label={t.practice.buildings} value={view.hitIds.length} />
            {pair && (
              <Stat label={t.practice.crossedByBoth} value={view.bothIds.length} />
            )}
          </dl>

          {view.auraIds.length > 0 && (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              {fill(t.practice.auraNote, { count: view.auraIds.length })}
            </p>
          )}

          {(pair || spec?.aim === "nearest") && (
            <p className="mt-4 text-xs leading-relaxed text-muted">
              {targetName ? (
                <>
                  {t.practice.attackingPrefix}{" "}
                  <span className="text-foreground">{targetName}</span>{" "}
                  {t.practice.attackingSuffix}
                </>
              ) : (
                t.practice.nothingInRange
              )}
            </p>
          )}

          {best && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-sm">
                {pair ? t.practice.bestPair : t.practice.bestLine}{" "}
                <span className="font-medium">{best.score}</span>
                {percentOfBest !== null && (
                  <span className="text-muted">
                    {" "}
                    — {t.practice.youAreAt} {percentOfBest}%
                  </span>
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setParams({ best: showBest ? null : "1" })}
                  className={`btn ${showBest ? "btn-active" : ""}`}
                >
                  {showBest ? t.practice.hideBest : t.practice.showBest}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setParams(
                      Object.fromEntries(
                        HERO_SLOTS.flatMap((slot) => {
                          const to = best.moveTo[slot];
                          return to
                            ? [[keyFor("h", slot), encodeStand(to)]]
                            : [];
                        }),
                      ),
                    )
                  }
                  className="btn"
                >
                  {pair ? t.practice.moveUsThere : t.practice.moveMeThere}
                </button>
              </div>
            </div>
          )}
        </Panel>

        <Panel title={t.practice.townHall}>
          <label className="flex items-center gap-3 text-sm">
            <span className="text-muted">TH</span>
            <select
              value={th}
              onChange={(e) => setParams({ th: e.target.value })}
              aria-label={t.practice.townHall}
              className="select grow"
            >
              {TH_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {`${t.practice.townHall} ${level}`}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {fill(t.practice.thNote, { count: atThisTh.length })}
          </p>
        </Panel>

        <Panel title={t.practice.share}>
          <ShareButton copy={t.practice.copyLink} copied={t.practice.linkCopied} />
          <p className="mt-3 text-xs leading-relaxed text-muted">
            The whole drill — base, ability and hero position — is in the URL.
          </p>
          {loadout.map(({ piece }) => (
            <p key={piece.id} className="mt-3 text-xs text-muted">
              <Link href={localePath(locale, `/equipment/${piece.id}`)} className="link-underline">
                {piece.name} stats
              </Link>
            </p>
          ))}
        </Panel>
      </aside>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * One hero's equipment level, and what that level's ability actually does.
 * Rendered once per hero on the board, so the pair shows both.
 */
function EquipmentLevel({
  hero,
  colour,
  piece,
  level,
  max,
  onLevel,
  t,
}: {
  /** Null in a solo drill, where there is nothing to disambiguate. */
  hero: string | null;
  colour: string;
  piece: Equipment;
  level: number;
  max: number;
  onLevel: (value: string) => void;
  t: Dictionary;
}) {
  // Effect keys come from the wiki's column names, so the damage column is
  // `abilityDamage` on one piece and `projectileDamage` on another. Match on
  // shape rather than hardcoding a key.
  const damageKey = piece.effectKeys.find((k) => /damage$/i.test(k));
  const damage = damageKey
    ? piece.levels.find((l) => l.lvl === level)?.effect[damageKey]
    : undefined;

  return (
    <div className="mt-4">
      {hero && (
        <p className="mb-1 flex items-center gap-1.5 text-xs font-medium">
          <span
            aria-hidden="true"
            className="inline-block size-2 rounded-full"
            style={{ background: colour }}
          />
          {hero}
          <span className="text-muted">— {piece.name}</span>
        </p>
      )}
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted">{t.practice.level}</span>
        <input
          type="range"
          min={1}
          max={max}
          value={level}
          onChange={(e) => onLevel(e.target.value)}
          className="w-full accent-[var(--accent)]"
          aria-label={`${piece.name} level`}
        />
        <span className="w-6 text-right tabular-nums">{level}</span>
      </label>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        {damage !== undefined && damageKey ? (
          <>
            <span className="text-foreground">{formatNumber(damage)}</span>
            {humaniseKey(damageKey).toLowerCase()}
          </>
        ) : (
          t.practice.noDamage
        )}
        <DataQualityBadge quality={piece.dataQuality} />
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="break-words text-[0.65rem] uppercase leading-tight tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function ShareButton({ copy, copied: copiedLabel }: { copy: string; copied: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={async () => {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? copiedLabel : copy}
    </button>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** "2 Cannons", or "1 Cannon + 1 Archer Tower" for the Multi-Gear Tower. */
function mergeRecipe(
  type: BuildingType,
  byType: Map<string, BuildingType>,
): string {
  return Object.entries(type.mergedFrom ?? {})
    .map(([id, n]) => {
      const name = byType.get(id)?.name ?? id;
      return `${n} ${name}${n > 1 ? "s" : ""}`;
    })
    .join(" + ");
}
