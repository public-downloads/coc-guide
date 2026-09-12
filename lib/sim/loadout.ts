import { humaniseKey } from "../format";
import { EQUIPMENT_SLOTS_PER_HERO } from "../schema/hero";
import type {
  AbilityOutput,
  EffectUnit,
  EffectValue,
  EquipSelection,
  HeroState,
  LoadoutDiff,
  LoadoutResult,
  SlotContribution,
} from "./types";

/**
 * The whole simulator. Pure — no React, no fetch, no DOM. Everything the UI
 * shows is derived from what this returns.
 *
 * Missing data is not an error: a stub piece contributes 0 and reports
 * `dataAvailable: false`, so the UI can show an honest blank rather than a
 * confidently wrong number. Genuine invariant breaks (wrong hero, three
 * slots, out-of-range level) throw, because they mean the caller is broken.
 */
export function computeLoadout(
  heroState: HeroState,
  slots: EquipSelection[],
): LoadoutResult {
  assertValidLoadout(heroState, slots);

  const { hero, level: heroLevel } = heroState;
  const heroRow = hero.levels.find((l) => l.lvl === heroLevel);
  const heroDataAvailable = heroRow !== undefined;

  const baseDps = heroRow?.dps ?? 0;
  const baseHp = heroRow?.hp ?? 0;

  const missing: string[] = [];
  if (!heroDataAvailable) missing.push(`${hero.name} base stats`);

  const contributions: SlotContribution[] = slots.map((slot) => {
    const { equipment, level } = slot;
    const row = equipment.levels.find((l) => l.lvl === level);

    if (!row) {
      missing.push(`${equipment.name} level table`);
      return {
        equipmentId: equipment.id,
        name: equipment.name,
        rarity: equipment.rarity,
        level,
        maxLevel: equipment.maxLevel,
        dataAvailable: false,
        dmg: 0,
        hp: 0,
        ability: null,
      };
    }

    const effects = equipment.effectKeys.map((key) =>
      toEffectValue(key, row.effect[key] ?? 0),
    );

    return {
      equipmentId: equipment.id,
      name: equipment.name,
      rarity: equipment.rarity,
      level,
      maxLevel: equipment.maxLevel,
      dataAvailable: true,
      dmg: row.dmg,
      hp: row.hp,
      ability: toAbilityOutput(equipment.id, equipment.name, equipment.ability.kind, effects),
    };
  });

  const dpsFromEquipment = sum(contributions.map((c) => c.dmg));
  const hpFromEquipment = sum(contributions.map((c) => c.hp));
  const totalHp = baseHp + hpFromEquipment;

  return {
    hero: {
      id: hero.id,
      name: hero.name,
      level: heroLevel,
      dataAvailable: heroDataAvailable,
      baseDps,
      baseHp,
    },
    dps: {
      base: baseDps,
      fromEquipment: dpsFromEquipment,
      total: baseDps + dpsFromEquipment,
    },
    hp: {
      base: baseHp,
      fromEquipment: hpFromEquipment,
      total: totalHp,
    },
    effectiveHp: {
      value: totalHp,
      unmodelled: unmodelledFor(contributions),
    },
    slots: contributions,
    abilities: contributions
      .map((c) => c.ability)
      .filter((a): a is AbilityOutput => a !== null),
    complete: missing.length === 0,
    missing: [...new Set(missing)],
  };
}

/** Difference between two loadouts, from `a` to `b`. */
export function diffLoadouts(a: LoadoutResult, b: LoadoutResult): LoadoutDiff {
  return {
    dps: b.dps.total - a.dps.total,
    hp: b.hp.total - a.hp.total,
    effectiveHp: b.effectiveHp.value - a.effectiveHp.value,
    comparable: a.complete && b.complete,
  };
}

function assertValidLoadout(heroState: HeroState, slots: EquipSelection[]) {
  if (slots.length > EQUIPMENT_SLOTS_PER_HERO) {
    throw new Error(
      `a hero has ${EQUIPMENT_SLOTS_PER_HERO} equipment slots, got ${slots.length}`,
    );
  }

  if (heroState.level < 1) {
    throw new Error(`hero level must be at least 1, got ${heroState.level}`);
  }

  if (
    heroState.hero.maxLevel !== null &&
    heroState.level > heroState.hero.maxLevel
  ) {
    throw new Error(
      `${heroState.hero.name} caps at level ${heroState.hero.maxLevel}, got ${heroState.level}`,
    );
  }

  const seen = new Set<string>();
  for (const { equipment, level } of slots) {
    if (equipment.hero !== heroState.hero.id) {
      throw new Error(
        `${equipment.name} belongs to ${equipment.hero}, not ${heroState.hero.id}`,
      );
    }
    if (seen.has(equipment.id)) {
      throw new Error(`${equipment.name} cannot fill both slots`);
    }
    seen.add(equipment.id);

    if (level < 1 || level > equipment.maxLevel) {
      throw new Error(
        `${equipment.name} level must be 1..${equipment.maxLevel}, got ${level}`,
      );
    }
  }
}

function toAbilityOutput(
  equipmentId: string,
  name: string,
  kind: "passive" | "instant" | "duration",
  effects: EffectValue[],
): AbilityOutput {
  if (kind !== "duration") return { kind, equipmentId, name, effects };

  const duration = effects.find((e) => e.unit === "seconds");
  return {
    kind: "duration",
    equipmentId,
    name,
    durationSeconds: duration?.value ?? 0,
    effects: effects.filter((e) => e !== duration),
  };
}

function toEffectValue(key: string, value: number): EffectValue {
  return { key, label: humaniseKey(key), value, unit: unitFor(key) };
}

function unitFor(key: string): EffectUnit {
  if (/duration$/i.test(key)) return "seconds";
  if (/count$/i.test(key)) return "count";
  return "number";
}

/**
 * Things a plain HP total does not capture. These are the open modelling
 * questions from data/README.md — naming them beats silently folding a guess
 * into the number.
 */
function unmodelledFor(contributions: SlotContribution[]): string[] {
  const unmodelled: string[] = [];
  for (const c of contributions) {
    if (c.equipmentId === "healer-puppet") unmodelled.push("Healer Puppet sustain");
    if (c.equipmentId === "invisibility-vial")
      unmodelled.push("Invisibility Vial uptime");
  }
  return unmodelled;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
