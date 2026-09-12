import { z } from "zod";
import { dataQualitySchema, slugSchema } from "./common";

/**
 * Troops, spells, sieges, heroes, pets and equipment — everything a guide can
 * name in an army. One flat registry keyed by the same slug the art uses, so
 * `public/units/<id>.webp` and an entry here are the two halves of a unit.
 *
 * This exists for two things the in-game army UI does and a bare slug cannot:
 * group a mixed list into compartments, and add up housing space.
 */

/** The compartments the army UI splits into, in display order. */
export const ARMY_TABS = [
  "heroes",
  "equipment",
  "army",
  "spells",
  "sieges",
  "clan-castle",
] as const;
export type ArmyTab = (typeof ARMY_TABS)[number];

export const UNIT_CATEGORIES = [
  "troop",
  "dark-troop",
  "super-troop",
  "spell",
  "siege",
  "hero",
  "pet",
  "equipment",
] as const;
export const unitCategorySchema = z.enum(UNIT_CATEGORIES);
export type UnitCategory = z.infer<typeof unitCategorySchema>;

/** Which compartment a category shows up in. Pets and equipment ride with the heroes, as in game. */
export const CATEGORY_TAB: Record<UnitCategory, ArmyTab> = {
  troop: "army",
  "dark-troop": "army",
  "super-troop": "army",
  spell: "spells",
  siege: "sieges",
  hero: "heroes",
  // Pets sit with the heroes they walk beside; equipment gets its own
  // compartment, because a hero carries exactly two and that only reads
  // clearly when they are not mixed in with the heroes themselves.
  pet: "heroes",
  equipment: "equipment",
};

export const ARMY_TAB_LABEL: Record<ArmyTab, string> = {
  army: "Army",
  spells: "Spells",
  sieges: "Siege machines",
  heroes: "Heroes",
  equipment: "Equipment",
  "clan-castle": "Clan Castle",
};

/**
 * Headings for the sections a compartment splits into while picking. The army
 * screen groups by what a unit is trained with, not by name — elixir, then
 * dark elixir, then the boosted supers — and a picker sorted alphabetically
 * puts the Barbarian next to the Baby Dragon, which is nobody's mental model.
 */
export const CATEGORY_LABEL: Record<UnitCategory, string> = {
  troop: "Elixir troops",
  "dark-troop": "Dark elixir troops",
  "super-troop": "Super troops",
  spell: "Spells",
  siege: "Siege machines",
  hero: "Heroes",
  pet: "Pets",
  equipment: "Equipment",
};

/**
 * The tile colour a category gets. Elixir troops sit on the default slab,
 * dark elixir on a deeper purplish one and supers on dark red, so a mixed
 * compartment reads as three groups before a single label is read.
 */
export const CATEGORY_TONE: Record<UnitCategory, "default" | "dark" | "super" | "hero"> =
  {
    troop: "default",
    "dark-troop": "dark",
    "super-troop": "super",
    spell: "default",
    siege: "default",
    hero: "hero",
    pet: "hero",
    equipment: "default",
  };

/**
 * Game rules the army UI enforces, not layout choices.
 *
 * `EQUIPMENT_PER_HERO` is the same constant as the simulator's
 * `EQUIPMENT_SLOTS_PER_HERO` — a hero carries two, whichever hero it is.
 * `MAX_SUPER_TROOPS` is the boost limit: two distinct super troops may be
 * active at once, so an army cannot name a third.
 */
export const EQUIPMENT_PER_HERO = 2;
export const MAX_SUPER_TROOPS = 2;
/** Four heroes go on an attack, whatever the Hero Hall has unlocked. */
export const MAX_HEROES = 4;
export const PETS_PER_HERO = 1;
/**
 * Siege machines an army can hold. Flat rather than per Town Hall: there is no
 * Workshop table in `/data`, and the compartment's badge needs a total to
 * measure against — three is the number the army screen shows.
 */
export const MAX_SIEGE_MACHINES = 3;

/**
 * Levels a donated unit gains from the donor clan's perks.
 *
 * Applied when the studio *fills a level in*, not when the army is rendered:
 * the spec then holds the real number a reader would see on the card, and
 * there is exactly one place the bonus can be added. Doing it at render time
 * as well would double it on anything the studio had already seeded.
 *
 * Never past the unit's own ceiling — a clan perk cannot take a troop above
 * its maximum level.
 */
export const CLAN_CASTLE_LEVEL_BONUS = 2;

/**
 * Display order inside a compartment. The army screen lists the elixir troops
 * first, then dark elixir, then the boosted super troops — so an author can
 * write a comp in any order and still get the familiar arrangement.
 */
export const CATEGORY_ORDER: Record<UnitCategory, number> = {
  troop: 0,
  "dark-troop": 1,
  "super-troop": 2,
  spell: 3,
  siege: 4,
  hero: 5,
  pet: 6,
  equipment: 7,
};

/**
 * Only heroes, pets and equipment are counted by *level* rather than by count;
 * everything else occupies housing space. Used to decide what a card shows.
 */
export const LEVELLED: ReadonlySet<UnitCategory> = new Set([
  "hero",
  "pet",
  "equipment",
]);

export const unitSchema = z.object({
  id: slugSchema,
  /** Only when `humaniseTag(id)` gets it wrong — P.E.K.K.A, L.A.S.S.I. */
  name: z.string().min(1).optional(),
  category: unitCategorySchema,
  /**
   * Camp space one of these occupies. `null` means "not compiled yet", which
   * the UI shows as an unknown total rather than as zero — a wrong army size
   * is worse than an absent one.
   */
  housingSpace: z.number().int().min(0).nullable(),
  /**
   * Town Hall that unlocks it, from the barracks / factory / workshop /
   * blacksmith tables. `null` means "not compiled", and a unit with no value
   * is never hidden by the Town Hall filter — the same call the building
   * catalogue makes with `availableAt`.
   */
  availableAt: z.number().int().min(1).max(20).nullable(),
  /**
   * Highest level this unit can reach at each Town Hall, keyed by TH as a
   * string — the same shape `data/buildings.json` uses for its buildings.
   * The Laboratory gates troops and spells, the Blacksmith gates equipment
   * and the Hero Hall gates heroes and pets, but the *per unit* ceiling is
   * its own published table and there is no formula to derive it.
   *
   * Optional, and absent everywhere for now: a unit without one gets no level
   * suggested rather than a guessed one. `validate:data` lists what is still
   * missing.
   */
  maxLevelAt: z.record(z.string(), z.number().int().min(0)).optional(),
  /** Equipment only: the hero it belongs to, so the two-slot rule can count. */
  hero: slugSchema.optional(),
  dataQuality: dataQualitySchema,
});

export type Unit = z.infer<typeof unitSchema>;

/**
 * Which regular unit each super troop is a boosted version of.
 *
 * A super is always the same level as the unit it boosts, so its `maxLevelAt`
 * is its base's — copied rather than transcribed twice, and asserted by
 * `validate:data` so a balance change to the base cannot leave the super
 * behind. A structural relation between units, not a stat, which is why it
 * lives here rather than in `/data`.
 */
export const SUPER_BASE: Record<string, string> = {
  "super-barbarian": "barbarian",
  "super-archer": "archer",
  "super-giant": "giant",
  "sneaky-goblin": "goblin",
  "super-wall-breaker": "wall-breaker",
  "rocket-balloon": "balloon",
  "super-wizard": "wizard",
  "super-dragon": "dragon",
  "inferno-dragon": "baby-dragon",
  "super-miner": "miner",
  "super-yeti": "yeti",
  "super-minion": "minion",
  "super-hog-rider": "hog-rider",
  "super-valkyrie": "valkyrie",
  "super-witch": "witch",
  "ice-hound": "lava-hound",
  "super-bowler": "bowler",
};

/**
 * The level a Town Hall can take this unit to, or null when the table has not
 * been compiled. Null rather than the unit's overall cap: telling an author
 * "Frozen Arrow 27" at TH13 would be worse than telling them nothing, because
 * they would believe it. Same call `maxLevelAt` makes for buildings.
 */
export function unitMaxLevelAt(
  unit: { maxLevelAt?: Record<string, number> },
  townHall: number,
): number | null {
  const value = unit.maxLevelAt?.[String(townHall)];
  return value && value > 0 ? value : null;
}

export const unitCatalogSchema = z.object({
  units: z.array(unitSchema),
});

export type UnitCatalog = z.infer<typeof unitCatalogSchema>;
