import { z } from "zod";

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be a lowercase kebab-case slug");

/** The patch a set of numbers was read from, e.g. "2025.10". */
export const gameVersionSchema = z
  .string()
  .regex(/^\d{4}\.\d{1,2}$/, 'must look like "2025.10"');

/**
 * `stub`       — metadata is correct, level table not compiled yet.
 * `unverified` — level table exists but has not been checked in-game.
 * `verified`   — level table matches observed in-game values.
 *
 * Nothing should ship to a guide or a build link off `stub` data, and
 * `unverified` must be surfaced in the UI.
 */
export const dataQualitySchema = z.enum(["stub", "unverified", "verified"]);
export type DataQuality = z.infer<typeof dataQualitySchema>;

export const DATA_QUALITY_LABEL: Record<DataQuality, string> = {
  stub: "no stats yet",
  unverified: "unverified",
  verified: "verified",
};
