import { UnitCard } from "@/components/ui/UnitCard";
import { UnitChip } from "@/components/ui/UnitChip";
import {
  castleUse,
  groupArmy,
  parseArmy,
  type ArmySection,
  type ResolvedEntry,
} from "@/lib/content/army";
import { unitArt, equipmentArt } from "@/lib/data/art";
import { getUnits } from "@/lib/data/units";
import { getEquipmentCatalog } from "@/lib/data/catalog";
import { capacityAt, getCapacity, type Capacity } from "@/lib/data/capacity";
import {
  ARMY_TAB_LABEL,
  CATEGORY_TONE,
  LEVELLED,
  MAX_HEROES,
  MAX_SIEGE_MACHINES,
} from "@/lib/schema/unit";
import { formatNumber } from "@/lib/format";

/**
 * The army a guide assumes, laid out like the in-game army screen: heroes
 * first with their equipment and pet tucked underneath, then the camps,
 * spells, sieges and Clan Castle, each with a used/total counter over it.
 *
 *   <Army units="hog-rider x12, cc:ice-golem x1, barbarian-king l95, frozen-arrow l27" />
 *
 * The author writes one flat list. Which compartment each id lands in comes
 * from `data/units.json`, and the totals from the Town Hall in the guide's
 * frontmatter — so a TH13 guide is measured against TH13's camps.
 *
 * A server component: the registry, the capacity tables and the art lookup all
 * read the filesystem.
 */
export function Army({
  units,
  compact = false,
  townHall,
}: {
  units: string;
  compact?: boolean;
  /** Bound to the guide's `thLevel` where the component is registered. */
  townHall?: number;
}) {
  const entries = parseArmy(units);
  if (entries.length === 0) return null;

  const registry = getUnits().byId;
  const sections = groupArmy(entries, registry);

  // Rarity lives in the piece's own file rather than the unit registry, and it
  // is what decides whether a slab is gold.
  const epic = new Set(
    getEquipmentCatalog()
      .items.filter((item) => item.rarity === "epic")
      .map((item) => item.id),
  );
  const toneFor = (entry: ResolvedEntry) =>
    entry.category === "equipment" && epic.has(entry.id)
      ? "epic"
      : CATEGORY_TONE[entry.category];

  const ids = entries.map((entry) => entry.id);
  const art = { ...unitArt(ids), ...equipmentArt(ids) };

  const tables = getCapacity().tables;
  const capacity =
    tables && townHall !== undefined ? capacityAt(tables, townHall) : null;

  if (compact) {
    return (
      <div className="my-6 flex flex-wrap gap-2">
        {entries.map((entry) => (
          <UnitChip key={entry.id} id={entry.id} src={art[entry.id]} />
        ))}
      </div>
    );
  }

  // The pet and the two equipment pieces are shown under the hero that carries
  // them, the way the army screen does, rather than as compartments of loose
  // parts. Equipment knows its hero from the registry; a pet's rider is a fact
  // about this army, so it comes from the spec's `@hero`.
  const equipment = sections.find((s) => s.tab === "equipment");
  const heroSection = sections.find((s) => s.tab === "heroes");
  const rest = sections.filter((s) => s.tab !== "equipment" && s.tab !== "heroes");

  const heroes = (heroSection?.entries ?? []).filter((e) => e.category === "hero");
  const pets = (heroSection?.entries ?? []).filter((e) => e.category === "pet");

  const equipmentFor = (heroId: string) =>
    (equipment?.entries ?? []).filter(
      (entry) => registry.get(entry.id)?.hero === heroId,
    );
  const petFor = (heroId: string) =>
    pets.filter((entry) => entry.carrier === heroId);

  // Anything whose hero is not on this attack still shows, as its own card —
  // a guide naming a piece without its hero is worth seeing, not dropping.
  const loose = [
    ...pets.filter(
      (entry) => !entry.carrier || !heroes.some((h) => h.id === entry.carrier),
    ),
    ...(equipment?.entries ?? []).filter((entry) => {
      const owner = registry.get(entry.id)?.hero;
      return !owner || !heroes.some((h) => h.id === owner);
    }),
  ];

  return (
    /*
      The army screen's arrangement: heroes down the left, compartments to the
      right of them. Collapses to one column on a phone, where there is no room
      to stand them side by side.
    */
    <div className="card my-7 grid overflow-hidden p-0 md:grid-cols-[auto_1fr]">
      {heroSection && (
        <section className="border-b-2 border-border md:border-b-0 md:border-r-2">
          <Header
            label={ARMY_TAB_LABEL.heroes}
            detail={
              <Counter used={heroes.length} total={MAX_HEROES} suffix="heroes" />
            }
          />
          {/*
            Each hero column is as wide as the shelf under it — pet plus two
            pieces — rather than as wide as the portrait, or two heroes' gear
            runs into each other.
          */}
          <div className="flex flex-wrap gap-x-5 gap-y-6 px-4 py-4 md:max-w-[19rem]">
            {heroes.map((entry) => {
              const carried = [...petFor(entry.id), ...equipmentFor(entry.id)];
              return (
                <div
                  key={entry.id}
                  className="flex w-32 flex-col items-center gap-1.5"
                >
                  <Card entry={entry} art={art} size="portrait" tone={toneFor(entry)} />
                  {/* The pet and the two pieces, on one shelf under the hero. */}
                  {carried.length > 0 && (
                    <div className="surface-inset flex gap-1 rounded-[var(--radius-tile)] p-1">
                      {carried.map((piece) => (
                        <UnitCard
                          key={piece.id}
                          id={piece.id}
                          src={art[piece.id]}
                          level={piece.level}
                          size="sm"
                          tone={toneFor(piece)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {loose.map((piece) => (
              <Card key={piece.id} entry={piece} art={art} tone={toneFor(piece)} />
            ))}
          </div>
        </section>
      )}

      <div className="min-w-0">
        {rest.map((section, index) => (
          <section
            key={section.tab}
            className={index > 0 ? "border-t-2 border-border" : undefined}
          >
            <Header
              label={ARMY_TAB_LABEL[section.tab]}
              detail={<Totals section={section} capacity={capacity} />}
            />
            <div className="flex flex-wrap gap-x-3 gap-y-5 px-4 py-4">
              {section.entries.map((entry) => (
                <Card key={entry.id} entry={entry} art={art} tone={toneFor(entry)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Card({
  entry,
  art,
  size,
  tone,
}: {
  entry: ResolvedEntry;
  art: Record<string, string>;
  size?: React.ComponentProps<typeof UnitCard>["size"];
  /** Passed in where rarity overrides the category's own colour. */
  tone?: React.ComponentProps<typeof UnitCard>["tone"];
}) {
  return (
    <UnitCard
      id={entry.id}
      src={art[entry.id]}
      count={LEVELLED.has(entry.category) ? undefined : entry.count}
      level={entry.level}
      size={size}
      tone={tone ?? CATEGORY_TONE[entry.category]}
    />
  );
}

function Header({
  label,
  detail,
}: {
  label: string;
  detail: React.ReactNode;
}) {
  return (
    <header className="ribbon">
      <h3>{label}</h3>
      {detail}
    </header>
  );
}

/**
 * What a compartment holds against what it can hold.
 *
 * Everything trained is measured in *housing space*, spells included: a Rage
 * costs two of the factory's slots and a Clone three, so counting spells would
 * under-read a spell bar by half. The unit count rides alongside as the
 * secondary number, because "16 units" and "140 space" answer different
 * questions.
 */
function Totals({
  section,
  capacity,
}: {
  section: ArmySection;
  capacity: Capacity | null;
}) {
  // The castle holds three things against three separate capacities, and the
  // army screen prints all three on it.
  if (section.tab === "clan-castle") {
    const use = castleUse(section);
    const castle = capacity?.clanCastle ?? null;
    return (
      <>
        <Counter used={use.troops} total={castle?.troops ?? null} suffix="space" />
        {use.spells !== 0 && (
          <Counter used={use.spells} total={castle?.spells ?? null} suffix="spells" />
        )}
        {use.sieges !== 0 && (
          <Counter used={use.sieges} total={castle?.sieges ?? null} suffix="sieges" />
        )}
      </>
    );
  }

  if (section.tab === "sieges") {
    return (
      <Counter
        used={section.units}
        total={MAX_SIEGE_MACHINES}
        suffix="machines"
      />
    );
  }

  const total =
    section.tab === "army"
      ? (capacity?.troops ?? null)
      : section.tab === "spells"
        ? (capacity?.spells ?? null)
        : null;

  return (
    <>
      <Counter
        used={section.space}
        total={total}
        suffix="space"
        unknown={section.unknown}
      />
      <Meter used={section.space} total={total} />
      <span className="text-[0.7rem] font-normal normal-case tracking-normal text-muted">
        {formatNumber(section.units)}{" "}
        {section.tab === "spells" ? "spells" : "units"}
      </span>
    </>
  );
}

/** The x/y badge on a compartment, or an honest gap where data is missing. */
function Counter({
  used,
  total,
  suffix,
  unknown = [],
}: {
  used: number | null;
  total: number | null;
  suffix: string;
  /** Ids with no compiled housing space, so the badge can say why. */
  unknown?: string[];
}) {
  const over = used !== null && total !== null && used > total;

  if (used === null) {
    return (
      <span
        className="counter text-muted"
        title={
          unknown.length > 0
            ? `No housing space compiled for ${unknown.join(", ")}`
            : undefined
        }
      >
        {suffix} unknown
      </span>
    );
  }

  return (
    <span className={`counter${over ? " border-accent text-accent" : ""}`}>
      {formatNumber(used)}
      {total === null ? "" : ` / ${formatNumber(total)}`} {suffix}
    </span>
  );
}

/** How full the compartment is, at a glance. Absent when there is no total. */
function Meter({ used, total }: { used: number | null; total: number | null }) {
  if (used === null || total === null || total === 0) return null;
  return (
    <span className="meter" aria-hidden>
      <i style={{ width: `${Math.min(100, (used / total) * 100)}%` }} />
    </span>
  );
}
