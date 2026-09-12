"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { computeLoadout, diffLoadouts } from "@/lib/sim/loadout";
import {
  encodeBuild,
  parseBuild,
  type BuildResolver,
  type BuildState,
  type SlotRef,
} from "@/lib/sim/url";
import type { LoadoutResult } from "@/lib/sim/types";
import type { Equipment } from "@/lib/schema/equipment";
import type { HeroStats } from "@/lib/schema/hero";
import { HEROES } from "@/lib/schema/hero";
import { formatNumber, formatSigned } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { DataQualityBadge, RarityBadge } from "@/components/ui/Badge";

/** Used only to bound the level control while a hero's real cap is unknown. */
const ASSUMED_HERO_CAP = 100;

export function Simulator({
  hero,
  equipment,
  t,
}: {
  hero: HeroStats;
  equipment: Equipment[];
  t: Dictionary;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const byId = useMemo(
    () => new Map(equipment.map((e) => [e.id, e])),
    [equipment],
  );

  const resolver = useMemo<BuildResolver>(
    () => ({
      heroMaxLevel: () => hero.maxLevel,
      equipment: (_heroId, equipmentId) => byId.get(equipmentId),
    }),
    [byId, hero.maxLevel],
  );

  const { build, errors } = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("hero", HEROES[hero.id].dirSlug);
    return parseBuild(params, resolver);
  }, [searchParams, hero.id, resolver]);

  const state = build ?? {
    heroId: hero.id,
    heroLevel: 1,
    slots: [null, null],
    compare: null,
  };

  const update = useCallback(
    (next: BuildState) => {
      const query = encodeBuild(next, { includeHero: false });
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router],
  );

  const primary = useLoadout(hero, state.heroLevel, state.slots, byId);
  const comparison = useLoadout(hero, state.heroLevel, state.compare, byId);

  const heroCap = hero.maxLevel ?? ASSUMED_HERO_CAP;

  return (
    <div className="mt-8 flex flex-col gap-8">
      {errors.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-medium">{t.sim.linkAdjusted}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-800/80 dark:text-amber-200/80">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-xl border border-border p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-medium">{hero.name}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {hero.maxLevel === null
                ? t.sim.levelCapUnknown
                : `${t.sim.levelCap} ${hero.maxLevel}`}
            </p>
          </div>
          <LevelControl
            label={t.sim.heroLevel}
            value={state.heroLevel}
            max={heroCap}
            onChange={(heroLevel) => update({ ...state, heroLevel })}
          />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <LoadoutColumn
          title={state.compare ? t.sim.loadoutA : t.sim.loadout}
          slots={state.slots}
          equipment={equipment}
          result={primary}
          onChange={(slots) => update({ ...state, slots })}
          t={t}
        />

        {state.compare && comparison && (
          <LoadoutColumn
            title={t.sim.loadoutB}
            slots={state.compare}
            equipment={equipment}
            result={comparison}
            diff={diffLoadouts(primary, comparison)}
            onChange={(compare) => update({ ...state, compare })}
            t={t}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() =>
            update({
              ...state,
              compare: state.compare ? null : [null, null],
            })
          }
          className="rounded-full border border-border-strong px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-raised"
        >
          {state.compare ? t.sim.stopCompare : t.sim.compare}
        </button>
        <ShareButton copy={t.sim.copyBuild} copied={t.sim.linkCopied} />
      </div>
    </div>
  );
}

function useLoadout(
  hero: HeroStats,
  heroLevel: number,
  slots: (SlotRef | null)[] | null,
  byId: Map<string, Equipment>,
): LoadoutResult {
  return useMemo(() => {
    const selections = (slots ?? [])
      .filter((slot): slot is SlotRef => slot !== null)
      .flatMap((slot) => {
        const equipment = byId.get(slot.equipmentId);
        return equipment ? [{ equipment, level: slot.level }] : [];
      });
    return computeLoadout({ hero, level: heroLevel }, selections);
  }, [hero, heroLevel, slots, byId]);
}

function LoadoutColumn({
  title,
  slots,
  equipment,
  result,
  diff,
  onChange,
  t,
}: {
  title: string;
  slots: (SlotRef | null)[];
  equipment: Equipment[];
  result: LoadoutResult;
  diff?: { dps: number; hp: number; comparable: boolean };
  onChange: (slots: (SlotRef | null)[]) => void;
  t: Dictionary;
}) {
  const takenIds = slots.filter((s): s is SlotRef => s !== null).map((s) => s.equipmentId);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
        {title}
      </h2>

      {slots.map((slot, index) => (
        <SlotPicker
          key={index}
          slot={slot}
          equipment={equipment.filter(
            (e) => e.id === slot?.equipmentId || !takenIds.includes(e.id),
          )}
          onChange={(next) => {
            const copy = [...slots];
            copy[index] = next;
            onChange(copy);
          }}
          t={t}
        />
      ))}

      <Results result={result} diff={diff} t={t} />
    </section>
  );
}

function SlotPicker({
  slot,
  equipment,
  onChange,
  t,
}: {
  slot: SlotRef | null;
  equipment: Equipment[];
  onChange: (slot: SlotRef | null) => void;
  t: Dictionary;
}) {
  const selected = equipment.find((e) => e.id === slot?.equipmentId);

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={slot?.equipmentId ?? ""}
          onChange={(event) => {
            const id = event.target.value;
            if (!id) return onChange(null);
            const piece = equipment.find((e) => e.id === id);
            onChange({
              equipmentId: id,
              level: Math.min(slot?.level ?? 1, piece?.maxLevel ?? 1),
            });
          }}
          className="select min-w-45 grow"
        >
          <option value="">{t.sim.emptySlot}</option>
          {equipment.map((piece) => (
            <option key={piece.id} value={piece.id}>
              {piece.name}
            </option>
          ))}
        </select>

        {selected && (
          <LevelControl
            label={t.sim.level}
            value={slot?.level ?? 1}
            max={selected.maxLevel}
            onChange={(level) =>
              onChange({ equipmentId: selected.id, level })
            }
          />
        )}
      </div>

      {selected && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <RarityBadge rarity={selected.rarity} />
          <DataQualityBadge quality={selected.dataQuality} />
          <span className="text-xs text-muted">
            {selected.ability.kind}
          </span>
        </div>
      )}
    </div>
  );
}

function LevelControl({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <input
        type="range"
        min={1}
        max={max}
        value={Math.min(value, max)}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-28 accent-current"
        aria-label={label}
      />
      <span className="w-8 text-right tabular-nums">{Math.min(value, max)}</span>
      <span className="text-muted">/ {max}</span>
    </label>
  );
}

function Results({
  result,
  diff,
  t,
}: {
  result: LoadoutResult;
  diff?: { dps: number; hp: number; comparable: boolean };
  t: Dictionary;
}) {
  return (
    <div className="rounded-xl border border-border p-5">
      <dl className="grid grid-cols-3 gap-4">
        <Stat
          label="DPS"
          value={result.dps.total}
          available={result.complete}
          delta={diff?.comparable ? diff.dps : undefined}
        />
        <Stat
          label="HP"
          value={result.hp.total}
          available={result.complete}
          delta={diff?.comparable ? diff.hp : undefined}
        />
        <Stat
          label="Effective HP"
          value={result.effectiveHp.value}
          available={result.complete}
        />
      </dl>

      {!result.complete && (
        <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
          No numbers yet — {formatList(result.missing)}{" "}
          {result.missing.length === 1 ? "has" : "have"} not been compiled. The
          loadout above is still a valid build and the link still shares.
        </p>
      )}

      {result.effectiveHp.unmodelled.length > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Effective HP does not account for{" "}
          {formatList(result.effectiveHp.unmodelled)}.
        </p>
      )}

      {result.slots.length > 0 && (
        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="pb-2 font-medium">{t.sim.slot}</th>
              <th className="pb-2 text-right font-medium">DPS</th>
              <th className="pb-2 text-right font-medium">HP</th>
            </tr>
          </thead>
          <tbody>
            {result.slots.map((slot) => (
              <tr key={slot.equipmentId} className="border-b border-border">
                <td className="py-2">
                  {slot.name}{" "}
                  <span className="text-muted">lvl {slot.level}</span>
                </td>
                <td className="py-2 text-right tabular-nums">
                  {slot.dataAvailable ? formatSigned(slot.dmg) : "—"}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {slot.dataAvailable ? formatSigned(slot.hp) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {result.abilities.length > 0 && (
        <ul className="mt-5 space-y-3">
          {result.abilities.map((ability) => (
            <li key={ability.equipmentId} className="text-sm">
              <span className="font-medium">{ability.name}</span>{" "}
              <span className="text-xs text-muted">{ability.kind}</span>
              <ul className="mt-1 space-y-0.5 text-xs text-muted">
                {ability.kind === "duration" && (
                  <li>Duration: {ability.durationSeconds}s</li>
                )}
                {ability.effects.map((effect) => (
                  <li key={effect.key}>
                    {effect.label}: {effect.value}
                    {effect.unit === "seconds" ? "s" : ""}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  available,
  delta,
}: {
  label: string;
  value: number;
  available: boolean;
  delta?: number;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">
        {available ? formatNumber(value) : "—"}
      </dd>
      {available && delta !== undefined && delta !== 0 && (
        <p
          className={`text-xs tabular-nums ${
            delta > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {formatSigned(delta)} vs A
        </p>
      )}
    </div>
  );
}

function ShareButton({ copy, copied: copiedLabel }: { copy: string; copied: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded-full border border-border-strong px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-raised"
    >
      {copied ? copiedLabel : copy}
    </button>
  );
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
