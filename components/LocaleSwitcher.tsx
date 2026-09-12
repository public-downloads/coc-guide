"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  isLocale,
  LOCALE_NAMES,
  LOCALES,
  type Locale,
} from "@/lib/i18n/config";

/**
 * Swaps the locale segment of the current path, keeping the rest of the route
 * and any query state — so switching language on a shared drill link keeps the
 * drill.
 */
export function LocaleSwitcher({
  locale,
  label,
}: {
  locale: Locale;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const switchTo = (next: string) => {
    const segments = pathname.split("/");
    // segments[0] is "" because the path starts with a slash.
    if (isLocale(segments[1] ?? "")) segments[1] = next;
    else segments.splice(1, 0, next);

    // Read the query straight off the location rather than with
    // useSearchParams: this component sits in the header of every page, and
    // that hook opts the whole page out of static prerendering.
    const query = window.location.search;
    router.push(`${segments.join("/")}${query}`);
  };

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{label}</span>
      <select
        value={locale}
        onChange={(e) => switchTo(e.target.value)}
        aria-label={label}
        className="select px-2.5 py-1.5 text-xs"
      >
        {LOCALES.map((option) => (
          <option key={option} value={option}>
            {LOCALE_NAMES[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
