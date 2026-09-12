/**
 * Build gate for /data and /content. Runs as `prebuild`, so a bad number from
 * a patch update or a malformed guide fails locally instead of shipping.
 *
 *   npm run validate:data
 */
import { loadEquipmentCatalog } from "../lib/data/catalog";
import { loadHeroStats } from "../lib/data/heroes";
import { loadGuides } from "../lib/content/guides";
import { loadPracticeData } from "../lib/data/bases";
import { loadUnits } from "../lib/data/units";
import { capacityAt, loadCapacity } from "../lib/data/capacity";
import { findEquipmentImage, findUnitImage } from "../lib/data/art";
import { HERO_IDS, HEROES } from "../lib/schema/hero";
import { SUPER_BASE } from "../lib/schema/unit";

const equipment = loadEquipmentCatalog();
const heroes = loadHeroStats();
const guides = loadGuides();
const practice = loadPracticeData();
const units = loadUnits();
const capacity = loadCapacity();

const issues = [
  ...equipment.issues.map((i) => ({ ...i, area: "data/equipment" })),
  ...heroes.issues.map((i) => ({ ...i, area: "data/heroes" })),
  ...guides.issues.map((i) => ({ ...i, area: "content/guides" })),
  ...practice.issues.map((i) => ({ ...i, area: "data" })),
  ...units.issues.map((i) => ({ ...i, area: "data" })),
  ...capacity.issues.map((i) => ({ ...i, area: "data" })),
];

if (issues.length > 0) {
  console.error(`\n${issues.length} problem(s):\n`);
  for (const issue of issues) {
    console.error(`  ${issue.area}/${issue.file}\n    ${issue.message}`);
  }
  console.error("");
  process.exit(1);
}

console.log(
  `\n${equipment.items.length} equipment file(s), ${heroes.items.length} hero file(s), ${guides.guides.length} guide(s), ` +
    `${practice.bases.length} practice base(s) with ${practice.buildings?.types.length ?? 0} building type(s) — all valid.\n`,
);

for (const heroId of HERO_IDS) {
  const items = equipment.byHero[heroId];
  if (items.length === 0) continue;

  const stats = heroes.byId.get(heroId);
  const cap =
    stats?.maxLevel === null || stats?.maxLevel === undefined
      ? "cap unknown"
      : `cap ${stats.maxLevel}`;
  console.log(`  ${HEROES[heroId].name} (${cap})`);

  for (const item of items) {
    const table =
      item.dataQuality === "stub"
        ? "no level table"
        : `${item.levels.length}/${item.maxLevel} levels`;
    console.log(
      `    ${item.name.padEnd(20)} ${item.rarity.padEnd(7)} ${item.dataQuality.padEnd(11)} ${table}`,
    );
  }
  console.log("");
}

const pending = [
  ...equipment.items.filter((e) => e.dataQuality === "stub").map((e) => e.id),
  ...heroes.items.filter((h) => h.dataQuality === "stub").map((h) => h.id),
];
const unverified = [
  ...equipment.items
    .filter((e) => e.dataQuality === "unverified")
    .map((e) => e.id),
  ...heroes.items
    .filter((h) => h.dataQuality === "unverified")
    .map((h) => h.id),
];
const drafts = guides.guides.filter((g) => g.meta.draft).map((g) => g.meta.slug);

if (pending.length > 0) {
  console.log(
    `${pending.length} still need hand-compiled stats: ${pending.join(", ")}`,
  );
}
if (unverified.length > 0) {
  console.log(`${unverified.length} unverified: ${unverified.join(", ")}`);
}
if (drafts.length > 0) {
  console.log(`${drafts.length} guide(s) still marked draft: ${drafts.join(", ")}`);
}

// Missing art is not an error — chips fall back to a label tile — but while
// the icon set is being filled in, the shopping list is the useful output.
const unitTags = [
  ...new Set(guides.guides.flatMap((g) => g.meta.armyComp)),
].sort();
// A comp can name equipment, whose art lives in public/equipment — checking
// only public/units reported pieces as missing that were sitting right there.
const missingArt = unitTags.filter(
  (tag) => !findUnitImage(tag) && !findEquipmentImage(tag),
);
if (missingArt.length > 0) {
  console.log(
    `${missingArt.length}/${unitTags.length} unit(s) in guides have no art in public/units: ${missingArt.join(", ")}`,
  );
}

/*
  A unit's per-Town-Hall table has to top out at exactly the cap its own file
  already states — the two are compiled from different pages of the same
  source, so a disagreement means one of them was misread. An error, not a
  note: a wrong ceiling would be shown to readers as fact.
*/
for (const unit of units.units) {
  if (!unit.maxLevelAt) continue;
  const top = Math.max(...Object.values(unit.maxLevelAt));
  // `heroes.byId` is keyed by the HeroId union; a registry slug is a plain
  // string, so it is matched against the list rather than cast into it.
  const cap =
    unit.category === "hero"
      ? heroes.items.find((hero) => hero.id === unit.id)?.maxLevel
      : equipment.byId.get(unit.id)?.maxLevel;
  if (cap !== undefined && cap !== null && top !== cap) {
    issues.push({
      area: "data",
      file: "units.json",
      message: `${unit.id}: maxLevelAt tops out at ${top} but its own file says maxLevel ${cap}`,
    });
  }
}

/*
  A super troop is always the same level as the unit it boosts, so its table
  has to *be* its base's. Asserted rather than merely generated once, or a
  balance change to the base would quietly leave the super behind.
*/
for (const [id, base] of Object.entries(SUPER_BASE)) {
  const unit = units.byId.get(id);
  const from = units.byId.get(base);
  if (!unit || !from) {
    issues.push({
      area: "data",
      file: "units.json",
      message: `SUPER_BASE names ${!unit ? id : base}, which is not in the registry`,
    });
    continue;
  }
  if (JSON.stringify(unit.maxLevelAt) !== JSON.stringify(from.maxLevelAt)) {
    issues.push({
      area: "data",
      file: "units.json",
      message: `${id}: maxLevelAt must match ${base}, the unit it boosts`,
    });
  }
}

const superTroops = units.units.filter((u) => u.category === "super-troop");
for (const unit of superTroops) {
  if (!(unit.id in SUPER_BASE)) {
    issues.push({
      area: "data",
      file: "units.json",
      message: `${unit.id} is a super troop with no entry in SUPER_BASE`,
    });
  }
}

if (issues.length > 0) {
  console.error(`\n${issues.length} problem(s):\n`);
  for (const issue of issues) {
    console.error(`  ${issue.area}/${issue.file}\n    ${issue.message}`);
  }
  console.error("");
  process.exit(1);
}

// Without a per-Town-Hall ceiling the studio cannot fill a level in for the
// author, so it leaves the box blank rather than guessing one.
const noMaxLevel = units.units.filter((u) => !u.maxLevelAt);
if (noMaxLevel.length > 0) {
  const byCategory = new Map<string, number>();
  for (const unit of noMaxLevel) {
    byCategory.set(unit.category, (byCategory.get(unit.category) ?? 0) + 1);
  }
  console.log(
    `${noMaxLevel.length}/${units.units.length} unit(s) have no maxLevelAt table, so no level is suggested for them: ` +
      [...byCategory].map(([c, n]) => `${n} ${c}`).join(", "),
  );
}

// Equipment is picked from its hero's own slot, so a piece with no `hero` in
// the registry is unreachable in the studio however good its art is.
const heroless = units.units
  .filter((u) => u.category === "equipment" && !u.hero)
  .map((u) => u.id);
if (heroless.length > 0) {
  console.log(
    `${heroless.length} equipment piece(s) have no hero in data/units.json and cannot be picked: ${heroless.join(", ")}`,
  );
}

const noHousing = units.units
  .filter((u) => u.housingSpace === null && u.category !== "hero" && u.category !== "pet" && u.category !== "equipment")
  .map((u) => u.id);
if (noHousing.length > 0) {
  console.log(
    `${noHousing.length}/${units.units.length} unit(s) have no housing space in data/units.json: ${noHousing.join(", ")}`,
  );
}

const missingEquipmentArt = equipment.items
  .map((item) => item.id)
  .filter((id) => !findEquipmentImage(id))
  .sort();
if (missingEquipmentArt.length > 0) {
  console.log(
    `${missingEquipmentArt.length}/${equipment.items.length} equipment piece(s) have no art in public/equipment: ${missingEquipmentArt.join(", ")}`,
  );
}
console.log("");

if (capacity.tables) {
  const sample = [11, 13, 15, 17].map((th) => {
    const c = capacityAt(capacity.tables!, th);
    return `TH${th} ${c.troops}/${c.spells}`;
  });
  console.log(`camp space / spell slots: ${sample.join("  ")}`);
}
