import {
  ARMY_TABS,
  CATEGORY_ORDER,
  CATEGORY_TAB,
  EQUIPMENT_PER_HERO,
  LEVELLED,
  MAX_HEROES,
  MAX_SUPER_TROOPS,
  PETS_PER_HERO,
  type ArmyTab,
  type UnitCategory,
} from "../schema/unit";

/**
 * The army spec a guide writes inside `<Army units="…" />`:
 *
 *   hog-rider x12 l10, healer x4, freeze-spell x2
 *
 * Count (`xN`) and level (`lN`) are optional and order-free, so the plain
 * `hog-rider, miner, healer` form a guide's frontmatter already uses still
 * parses. Kept out of the component and pure so it can be tested — the parser
 * is the part that breaks, not the markup.
 */

export interface ArmyEntry {
  id: string;
  count?: number;
  level?: number;
  /** Donated rather than trained — `cc:` in the spec. */
  clanCastle?: boolean;
  /**
   * The hero this rides with — `@archer-queen` in the spec. Pets only, and
   * only because the registry cannot say it: equipment belongs to one hero and
   * carries `hero` in `data/units.json`, but any pet can walk beside any hero,
   * so which one is a fact about *this army* rather than about the pet.
   */
  carrier?: string;
}

/** What the renderer needs per entry, once the registry has been consulted. */
export interface ResolvedEntry extends ArmyEntry {
  category: UnitCategory;
  /** Total space these occupy, or null while the registry says "not compiled". */
  space: number | null;
}

export interface ArmySection {
  tab: ArmyTab;
  entries: ResolvedEntry[];
  /** Units in this compartment — 12 hogs and 4 healers is 16, not 2. */
  units: number;
  /** Space used, or null if any member's housing space is unknown. */
  space: number | null;
  /** Ids whose housing space is missing, so the UI can say why. */
  unknown: string[];
}

/**
 * Group a parsed army into the in-game compartments and total it up.
 *
 * Space is deliberately `null` rather than a partial sum when any member's
 * housing space is uncompiled: an army that says "80 space" when it means
 * "80 plus three unknown troops" is worse than one that admits it does not
 * know. Same reasoning as `computeLoadout`'s `complete: false`.
 *
 * A slug with no registry entry lands in the Army tab as an unknown — a guide
 * naming a unit before its data exists should still render.
 */
export function groupArmy(
  entries: readonly ArmyEntry[],
  registry: ReadonlyMap<string, { category: UnitCategory; housingSpace: number | null }>,
): ArmySection[] {
  const sections = new Map<ArmyTab, ArmySection>();

  for (const entry of entries) {
    const known = registry.get(entry.id);
    const category = known?.category ?? "troop";
    const tab = entry.clanCastle ? "clan-castle" : CATEGORY_TAB[category];
    const count = entry.count ?? 1;

    const housing = known?.housingSpace ?? null;
    const space = housing === null ? null : housing * count;

    const section =
      sections.get(tab) ??
      ({ tab, entries: [], units: 0, space: 0, unknown: [] } as ArmySection);

    section.entries.push({ ...entry, category, space });
    // Heroes and equipment are not "units" in the camp sense; do not count them.
    if (!LEVELLED.has(category)) section.units += count;
    if (space === null) {
      if (!LEVELLED.has(category)) section.unknown.push(entry.id);
    } else if (section.space !== null) {
      section.space += space;
    }

    sections.set(tab, section);
  }

  for (const section of sections.values()) {
    // An unknown member poisons the total for its compartment, on purpose.
    if (section.unknown.length > 0) section.space = null;
    // Elixir, then dark, then super. Array.sort is stable, so anything of the
    // same category keeps the order the author wrote.
    section.entries.sort(
      (a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category],
    );
  }

  return ARMY_TABS.filter((tab) => sections.has(tab)).map(
    (tab) => sections.get(tab)!,
  );
}

/**
 * The Clan Castle counts three things separately, and the army screen puts
 * three badges on it: troop space, spell space and siege machines. Totalling
 * the compartment as one number measures a donated Freeze against the troop
 * capacity, which is simply the wrong table.
 *
 * Each is `null` when a member's housing space is uncompiled, for the same
 * reason `ArmySection.space` is.
 */
export interface CastleUse {
  troops: number | null;
  spells: number | null;
  sieges: number | null;
}

export function castleUse(section: ArmySection): CastleUse {
  const use: CastleUse = { troops: 0, spells: 0, sieges: 0 };

  for (const entry of section.entries) {
    const slot =
      entry.category === "spell"
        ? "spells"
        : entry.category === "siege"
          ? "sieges"
          : "troops";
    if (entry.space === null) use[slot] = null;
    else if (use[slot] !== null) use[slot]! += entry.space;
  }

  return use;
}

const COUNT = /^x(\d+)$/;
const LEVEL = /^l(\d+)$/;
const CARRIER = /^@([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function parseArmy(spec: string): ArmyEntry[] {
  const entries: ArmyEntry[] = [];

  for (const chunk of spec.split(",")) {
    const [raw, ...modifiers] = chunk.trim().toLowerCase().split(/\s+/);
    if (!raw) continue;

    // `cc:ice-golem x1` — the same unit means something different when it
    // comes out of the castle, so it is a flag on the entry, not a category.
    const clanCastle = raw.startsWith("cc:");
    const id = clanCastle ? raw.slice(3) : raw;
    if (!id) continue;

    const entry: ArmyEntry = clanCastle ? { id, clanCastle } : { id };
    for (const modifier of modifiers) {
      const count = COUNT.exec(modifier);
      if (count) {
        entry.count = Number(count[1]);
        continue;
      }
      const level = LEVEL.exec(modifier);
      if (level) {
        entry.level = Number(level[1]);
        continue;
      }
      const carrier = CARRIER.exec(modifier);
      if (carrier) entry.carrier = carrier[1];
      // Anything else is ignored rather than thrown: a typo in a guide should
      // cost the badge, not the page.
    }
    entries.push(entry);
  }

  return entries;
}

/**
 * The inverse of `parseArmy` — an entry list back into the string a guide
 * writes inside `<Army units="…" />`.
 *
 * Only the modifiers that were actually set are emitted, so a comp picked with
 * no counts round-trips to the same bare `hog-rider, healer` a hand-written
 * guide already has, and does not sprout a cosmetic `x1` on every unit.
 *
 * `parseArmy(formatArmy(entries))` is the identity, which is what lets the
 * studio read an existing tag, edit it and write it back.
 */
export function formatArmy(entries: readonly ArmyEntry[]): string {
  return entries
    .map((entry) => {
      const parts = [entry.clanCastle ? `cc:${entry.id}` : entry.id];
      if (entry.count !== undefined) parts.push(`x${entry.count}`);
      if (entry.level !== undefined) parts.push(`l${entry.level}`);
      if (entry.carrier !== undefined) parts.push(`@${entry.carrier}`);
      return parts.join(" ");
    })
    .join(", ");
}

export interface ArmyViolation {
  rule: "equipment-per-hero" | "super-troops" | "heroes" | "pets";
  message: string;
  /** The ids involved, so a picker can mark them. */
  ids: string[];
}

/**
 * The two limits the game enforces that a flat list cannot express.
 *
 * Returned rather than thrown: the studio blocks on them while picking, but a
 * guide that already breaks one should still render — telling the author is
 * more useful than a build failure over an army composition.
 */
export function armyViolations(
  entries: readonly ArmyEntry[],
  registry: ReadonlyMap<string, { category: UnitCategory; hero?: string }>,
): ArmyViolation[] {
  const violations: ArmyViolation[] = [];

  const perHero = new Map<string, string[]>();
  const superTroops: string[] = [];
  const heroes: string[] = [];
  const pets: string[] = [];

  for (const entry of entries) {
    const unit = registry.get(entry.id);
    if (!unit) continue;
    if (unit.category === "equipment" && unit.hero) {
      perHero.set(unit.hero, [...(perHero.get(unit.hero) ?? []), entry.id]);
    }
    if (unit.category === "super-troop" && !superTroops.includes(entry.id)) {
      superTroops.push(entry.id);
    }
    if (unit.category === "hero") heroes.push(entry.id);
    if (unit.category === "pet") pets.push(entry.id);
  }

  for (const [hero, ids] of perHero) {
    if (ids.length > EQUIPMENT_PER_HERO) {
      violations.push({
        rule: "equipment-per-hero",
        message: `${hero} carries ${EQUIPMENT_PER_HERO} pieces, not ${ids.length}`,
        ids,
      });
    }
  }

  if (heroes.length > MAX_HEROES) {
    violations.push({
      rule: "heroes",
      message: `${MAX_HEROES} heroes go on an attack, not ${heroes.length}`,
      ids: heroes,
    });
  }

  // A pet rides with a hero, so more pets than heroes cannot be fielded.
  const petSlots = Math.min(heroes.length, MAX_HEROES) * PETS_PER_HERO;
  if (pets.length > petSlots) {
    violations.push({
      rule: "pets",
      message:
        petSlots === 0
          ? "a pet needs a hero to ride with"
          : `${petSlots} pet slot(s) for ${heroes.length} hero(es), not ${pets.length}`,
      ids: pets,
    });
  }

  if (superTroops.length > MAX_SUPER_TROOPS) {
    violations.push({
      rule: "super-troops",
      message: `only ${MAX_SUPER_TROOPS} super troops can be boosted at once`,
      ids: superTroops,
    });
  }

  return violations;
}
