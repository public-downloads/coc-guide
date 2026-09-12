"use client";

import { useSyncExternalStore } from "react";

/**
 * `system` stores nothing and removes the attribute, letting the default
 * Clash palette follow the OS's light/dark preference.
 */
export const THEMES = [
  { id: "system", label: "System" },
  { id: "clash", label: "Clash" },
  { id: "clash-night", label: "Clash Night" },
  { id: "paper", label: "Paper" },
  { id: "slate", label: "Slate" },
  { id: "midnight", label: "Midnight" },
  { id: "barracks", label: "Barracks" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const IDS: string[] = THEMES.map((t) => t.id);
const EVENT = "coc:themechange";

function apply(theme: string) {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
    localStorage.removeItem("theme");
  } else {
    root.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }
  window.dispatchEvent(new Event(EVENT));
}

/**
 * The theme lives in localStorage and on the <html> element, both outside
 * React — so it is read through an external store rather than mirrored into
 * state by an effect.
 */
function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readTheme(): ThemeId {
  const stored = localStorage.getItem("theme");
  return (stored && IDS.includes(stored) ? stored : "system") as ThemeId;
}

/** The server cannot know the stored preference; it always renders `system`. */
const serverTheme = (): ThemeId => "system";

export function ThemeToggle({
  label,
  themeLabels,
}: {
  label: string;
  /** Localised names, keyed by theme id. Falls back to the English label. */
  themeLabels?: Partial<Record<ThemeId, string>>;
}) {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{label}</span>
      <select
        value={theme}
        onChange={(e) => apply(e.target.value)}
        aria-label={label}
        className="select px-2.5 py-1.5 text-xs"
      >
        {THEMES.map((option) => (
          <option key={option.id} value={option.id}>
            {themeLabels?.[option.id] ?? option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Runs before first paint so a stored theme never flashes the default.
 * Inlined in the document head, hence the string.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('theme');if(t&&${JSON.stringify(
  IDS,
)}.indexOf(t)>-1&&t!=='system'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;
