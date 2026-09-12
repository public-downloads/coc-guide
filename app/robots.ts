import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * `force-static` is required by `output: "export"`: metadata routes are
 * generated at build time, and without it Next refuses rather than guessing.
 */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
