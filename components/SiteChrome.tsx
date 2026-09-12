import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function SiteHeader({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  const nav = [
    { href: "/practice", label: t.site.nav.practice },
    { href: "/sim", label: t.site.nav.sim },
    { href: "/guides", label: t.site.nav.guides },
    { href: "/equipment", label: t.site.nav.equipment },
  ];

  return (
    // The header has its own token set rather than the page's: Clash paints it
    // clan red, and the neutral themes map the tokens straight back to
    // background/foreground so they keep a plain bar.
    <header className="sticky top-0 z-20 border-b border-header-border bg-header/95 text-header-foreground backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
        <Link
          href={localePath(locale)}
          className="text-lg font-semibold tracking-tight"
        >
          {t.site.name}
        </Link>
        <ul className="flex gap-5 text-base text-header-muted">
          {nav.map((item) => (
            <li key={item.href}>
              <Link
                href={localePath(locale, item.href)}
                className="transition-colors hover:text-header-foreground"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher locale={locale} label={t.site.language} />
          <ThemeToggle label={t.site.theme} themeLabels={t.site.themes} />
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter({ t }: { t: Dictionary }) {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-8 text-xs leading-relaxed text-muted">
        {/*
          Required by the Supercell Fan Content Policy, which is the licence
          this site relies on to use their names and art at all. It has to be
          the policy's own wording, it has to link to the policy, and it has to
          be on every page — which is why it lives in the chrome and not on a
          legal page somewhere.
        */}
        <p>
          {t.site.footer.disclaimer}{" "}
          <a
            href="https://supercell.com/en/fan-content-policy/"
            className="underline hover:text-foreground"
          >
            supercell.com/fan-content-policy
          </a>
        </p>
        <p className="mt-2">{t.site.footer.dataNote}</p>
      </div>
    </footer>
  );
}
