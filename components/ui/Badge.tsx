import type { ReactNode } from "react";
import { DATA_QUALITY_LABEL, type DataQuality } from "@/lib/schema/common";
import type { Rarity } from "@/lib/schema/equipment";

export function Badge({
  children,
  className = "bg-foreground/10 text-foreground/70",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

const RARITY_STYLES: Record<Rarity, string> = {
  common: "bg-foreground/10 text-foreground/70",
  epic: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return <Badge className={RARITY_STYLES[rarity]}>{rarity}</Badge>;
}

const QUALITY_STYLES: Record<DataQuality, string> = {
  stub: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  unverified: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  verified: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export function DataQualityBadge({ quality }: { quality: DataQuality }) {
  return (
    <Badge className={QUALITY_STYLES[quality]}>
      {DATA_QUALITY_LABEL[quality]}
    </Badge>
  );
}
