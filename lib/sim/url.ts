import {
  EQUIPMENT_SLOTS_PER_HERO,
  HEROES,
  heroFromDirSlug,
  type HeroId,
} from "../schema/hero";

/**
 * Build state lives in the URL, not in React state — a build has to survive
 * being pasted into Discord. Everything here is pure so it can be unit
 * tested and used on both sides of the render boundary.
 *
 *   /sim/queen?hl=90&e1=frozen-arrow:12&e2=healer-puppet:18
 */

export interface SlotRef {
  equipmentId: string;
  level: number;
}

export interface BuildState {
  heroId: HeroId;
  heroLevel: number;
  /** Always `EQUIPMENT_SLOTS_PER_HERO` long; `null` is an empty slot. */
  slots: (SlotRef | null)[];
  /** Second loadout for the comparison view, or `null` when comparing is off. */
  compare: (SlotRef | null)[] | null;
}

export interface BuildResolver {
  heroMaxLevel(heroId: HeroId): number | null;
  equipment(heroId: HeroId, equipmentId: string): { maxLevel: number } | undefined;
}

export const DEFAULT_HERO_LEVEL = 1;

const SLOT_PARAMS = ["e1", "e2"] as const;
const COMPARE_PARAMS = ["c1", "c2"] as const;

export function emptyBuild(heroId: HeroId): BuildState {
  return {
    heroId,
    heroLevel: DEFAULT_HERO_LEVEL,
    slots: Array.from({ length: EQUIPMENT_SLOTS_PER_HERO }, () => null),
    compare: null,
  };
}

/**
 * Serialises to a query string. Empty slots and a level-1 hero are omitted so
 * a fresh link stays short and a shared one shows only what was chosen.
 *
 * `includeHero: false` is for `/sim/[hero]`, where the hero is already in the
 * path and repeating it in the query would just be noise.
 */
export function encodeBuild(
  build: BuildState,
  { includeHero = true }: { includeHero?: boolean } = {},
): string {
  const params = new URLSearchParams();
  if (includeHero) params.set("hero", HEROES[build.heroId].dirSlug);
  if (build.heroLevel !== DEFAULT_HERO_LEVEL) {
    params.set("hl", String(build.heroLevel));
  }

  build.slots.forEach((slot, i) => {
    if (slot && SLOT_PARAMS[i]) params.set(SLOT_PARAMS[i], encodeSlot(slot));
  });

  if (build.compare) {
    params.set("cmp", "1");
    build.compare.forEach((slot, i) => {
      if (slot && COMPARE_PARAMS[i])
        params.set(COMPARE_PARAMS[i], encodeSlot(slot));
    });
  }

  return params.toString();
}

export interface ParseResult {
  build: BuildState | null;
  /** Problems worth telling the user about. Never fatal on its own. */
  errors: string[];
}

/**
 * Parses a shared link. Anything unrecognised is dropped with an error rather
 * than failing the page — a link from an older patch should still open, minus
 * the pieces that no longer exist.
 */
export function parseBuild(
  params: URLSearchParams,
  resolver: BuildResolver,
): ParseResult {
  const errors: string[] = [];

  const heroParam = params.get("hero");
  if (!heroParam) return { build: null, errors: ["no hero in the link"] };

  const heroId = heroFromDirSlug(heroParam);
  if (!heroId) {
    return { build: null, errors: [`unknown hero "${heroParam}"`] };
  }

  const build = emptyBuild(heroId);
  const heroCap = resolver.heroMaxLevel(heroId);

  const rawHeroLevel = params.get("hl");
  if (rawHeroLevel !== null) {
    const level = Number(rawHeroLevel);
    if (!Number.isInteger(level) || level < 1) {
      errors.push(`ignored hero level "${rawHeroLevel}"`);
    } else if (heroCap !== null && level > heroCap) {
      errors.push(
        `hero level ${level} is above the level ${heroCap} cap — clamped`,
      );
      build.heroLevel = heroCap;
    } else {
      build.heroLevel = level;
    }
  }

  build.slots = readSlots(SLOT_PARAMS, params, heroId, resolver, errors);

  if (params.get("cmp") === "1") {
    build.compare = readSlots(COMPARE_PARAMS, params, heroId, resolver, errors);
  }

  const duplicate = firstDuplicate(build.slots);
  if (duplicate) {
    errors.push(`${duplicate} cannot fill both slots — second slot cleared`);
    build.slots[build.slots.length - 1] = null;
  }

  return { build, errors };
}

function readSlots(
  names: readonly string[],
  params: URLSearchParams,
  heroId: HeroId,
  resolver: BuildResolver,
  errors: string[],
): (SlotRef | null)[] {
  return names.map((name) => {
    const raw = params.get(name);
    if (!raw) return null;

    const slot = decodeSlot(raw);
    if (!slot) {
      errors.push(`ignored malformed slot "${raw}"`);
      return null;
    }

    const equipment = resolver.equipment(heroId, slot.equipmentId);
    if (!equipment) {
      errors.push(
        `"${slot.equipmentId}" is not ${HEROES[heroId].name} equipment — dropped`,
      );
      return null;
    }

    if (slot.level > equipment.maxLevel) {
      errors.push(
        `${slot.equipmentId} level ${slot.level} is above its level ${equipment.maxLevel} cap — clamped`,
      );
      return { ...slot, level: equipment.maxLevel };
    }

    return slot;
  });
}

function encodeSlot(slot: SlotRef): string {
  return `${slot.equipmentId}:${slot.level}`;
}

function decodeSlot(raw: string): SlotRef | null {
  const [equipmentId, rawLevel] = raw.split(":");
  if (!equipmentId || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(equipmentId)) return null;

  const level = rawLevel === undefined ? 1 : Number(rawLevel);
  if (!Number.isInteger(level) || level < 1) return null;

  return { equipmentId, level };
}

function firstDuplicate(slots: (SlotRef | null)[]): string | null {
  const seen = new Set<string>();
  for (const slot of slots) {
    if (!slot) continue;
    if (seen.has(slot.equipmentId)) return slot.equipmentId;
    seen.add(slot.equipmentId);
  }
  return null;
}
