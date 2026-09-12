import type { MetadataRoute } from "next";
import { getEquipmentCatalog } from "@/lib/data/catalog";
import { getGuides } from "@/lib/content/guides";
import { HERO_IDS, HEROES } from "@/lib/schema/hero";
import { SITE_URL } from "@/lib/site";
import { localePath, LOCALES } from "@/lib/i18n/config";

/**
 * `force-static` is required by `output: "export"`: metadata routes are
 * generated at build time, and without it Next refuses rather than guessing.
 */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  // Every page exists once per locale.
  return LOCALES.flatMap((locale) => {
    const at = (route: string) => `${SITE_URL}${localePath(locale, route)}`;

    return [
      ...["/", "/practice", "/sim", "/guides", "/equipment"].map((route) => ({
        url: at(route),
        changeFrequency: "weekly" as const,
        priority: route === "/" ? 1 : 0.8,
      })),
      ...HERO_IDS.map((heroId) => ({
        url: at(`/sim/${HEROES[heroId].dirSlug}`),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...getEquipmentCatalog().items.map((item) => ({
        url: at(`/equipment/${item.id}`),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
      ...getGuides().map((guide) => ({
        url: at(`/guides/${guide.meta.slug}`),
        lastModified: new Date(guide.meta.updatedAt),
        changeFrequency: "monthly" as const,
        priority: 0.9,
      })),
    ];
  });
}
