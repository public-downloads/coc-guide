import type { Equipment, Rarity } from "../schema/equipment";
import type { HeroId, HeroStats } from "../schema/hero";

export interface HeroState {
  hero: HeroStats;
  level: number;
}

export interface EquipSelection {
  equipment: Equipment;
  level: number;
}

export type EffectUnit = "seconds" | "count" | "number";

export interface EffectValue {
  key: string;
  label: string;
  value: number;
  unit: EffectUnit;
}

/**
 * Ability output, kept as a discriminated union so the UI can render an
 * instant burst and a timed buff differently. Collapsing these into a single
 * number is the thing this type exists to prevent.
 */
export type AbilityOutput =
  | { kind: "passive"; equipmentId: string; name: string; effects: EffectValue[] }
  | { kind: "instant"; equipmentId: string; name: string; effects: EffectValue[] }
  | {
      kind: "duration";
      equipmentId: string;
      name: string;
      durationSeconds: number;
      effects: EffectValue[];
    };

export interface SlotContribution {
  equipmentId: string;
  name: string;
  rarity: Rarity;
  level: number;
  maxLevel: number;
  /** False when the piece is still a stub — contributions are 0, not wrong. */
  dataAvailable: boolean;
  dmg: number;
  hp: number;
  ability: AbilityOutput | null;
}

export interface LoadoutResult {
  hero: {
    id: HeroId;
    name: string;
    level: number;
    dataAvailable: boolean;
    baseDps: number;
    baseHp: number;
  };
  dps: { base: number; fromEquipment: number; total: number };
  hp: { base: number; fromEquipment: number; total: number };
  /**
   * Currently just total HP. `unmodelled` names the things that would change
   * it once the modelling questions in data/README.md are settled, so the UI
   * can say what the number does *not* include.
   */
  effectiveHp: { value: number; unmodelled: string[] };
  slots: SlotContribution[];
  abilities: AbilityOutput[];
  /** True when every input had a real level table. */
  complete: boolean;
  /** Human-readable list of what is missing, for empty states. */
  missing: string[];
}

export interface LoadoutDiff {
  dps: number;
  hp: number;
  effectiveHp: number;
  comparable: boolean;
}

export type { Equipment, HeroStats };
