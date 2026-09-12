import type { Locale } from "./config";

/**
 * UI strings only. Game data (equipment names, building names) stays in its
 * source language because it comes from `/data`, and guide prose stays in the
 * language its MDX file was written in — see the note in the guides index.
 */
const en = {
  site: {
    name: "CoC Companion",
    tagline: "Clash of Clans companion",
    theme: "Theme",
    language: "Language",
    themes: {
      system: "System",
      clash: "Clash",
      "clash-night": "Clash Night",
      paper: "Paper",
      slate: "Slate",
      midnight: "Midnight",
      barracks: "Barracks",
    },
    nav: {
      practice: "Practice",
      sim: "Simulator",
      guides: "Guides",
      equipment: "Equipment",
    },
    footer: {
      // The Fan Content Policy specifies this wording, ending in a link to
      // the policy itself. Do not paraphrase it.
      disclaimer:
        "This material is unofficial and is not endorsed by Supercell. For more information see Supercell's Fan Content Policy:",
      dataNote:
        "Stats are compiled by hand from patch notes. There is no official equipment stats API.",
    },
  },
  home: {
    title: "Aim it properly, then work out what it's worth.",
    intro:
      "A trainer for the abilities that fire a line across the whole village, and a loadout simulator for everything else. Every drill and every build lives in its URL, so you can paste one straight into a clan chat.",
    practiceTitle: "Ability practice",
    simTitle: "Loadout simulator",
    simBody:
      "Two equipment slots at any levels, side by side, with the per-slot breakdown.",
    statusTitle: "Where this is up to",
  },
  practice: {
    title: "Ability practice",
    intro:
      "Both of these abilities fire a straight line across the whole village, and both are easy to waste. Line one up on a base, see exactly what it crosses, and compare it against the best line available.",
    ability: "Ability",
    viewFlat: "Flat",
    viewIso: "Isometric",
    isoNote: "View only — switch to Flat to place buildings.",
    noAbility: "None",
    noAbilityHelp:
      "No ability selected — the board is just a base. Pick one to draw its line.",
    pair: "Both",
    pairHelp:
      "Both heroes are out: the Queen in blue, the Duke in red. This is the earthquake opener — quakes crack the compartment, then both abilities go through the same high-hitpoint defence, because neither takes a Monolith or a Revenge Tower down alone. Drag either hero; clicking the ground moves whoever is nearer.",
    level: "Level",
    noDamage: "no damage data",
    thisLine: "This line",
    theseLines: "These lines",
    crossedByBoth: "Both cross",
    auraNote:
      "{count} more inside a Spell Tower aura without being crossed — partial credit.",
    score: "Score",
    defences: "Defences",
    buildings: "Buildings",
    bestLine: "Best line on this base:",
    bestPair: "Best pair on this base:",
    moveUsThere: "Move us there",
    youAreAt: "you are at",
    showBest: "Show best line",
    hideBest: "Hide best line",
    moveMeThere: "Move me there",
    base: "Base",
    townHall: "Town Hall",
    thNote:
      "{count} building types exist at this Town Hall. The number on each chip is its max level there.",
    placeBuildings: "Place buildings",
    searchBuildings: "Search {count} buildings…",
    noMatch: "Nothing matches",
    deleteSelected: "Delete selected",
    erase: "Erase",
    clear: "Clear",
    done: "Done",
    editInSandbox: "Edit in sandbox",
    custom: "custom",
    customCount: "buildings, stored in the link",
    share: "Share",
    copyLink: "Copy drill link",
    linkCopied: "Link copied",
    shareNote:
      "The whole drill — base, ability and hero position — is in the URL.",
    sandboxHelp:
      "Sandbox — click to place, drag a placed building to move it. Walls paint in a run if you drag. Shift-click adds to the selection and shift-drag on empty ground sweeps an area; dragging any selected building moves the whole group. Erase rubs buildings out by dragging over them. Buildings snap to the grid and may sit flush; red means the spot is taken.",
    attackingPrefix: "She is attacking the",
    attackingSuffix: "— the closest building. Move her to change what that is.",
    nothingInRange: "Nothing in range.",
    caveat:
      "Path widths are this project's approximations, not measured game values — the shape of the decision is right, the exact edge cases are not. Scoring weights are an opinion about what is worth hitting, not a game stat.",
    categories: {
      core: "core",
      defence: "defence",
      wall: "wall",
      resource: "resource",
      army: "army",
      other: "other",
    },
  },
  sim: {
    title: "Simulator",
    intro:
      "Pick a hero, fill both equipment slots, and share the build as a link. No account, no saving — the URL is the build.",
    noEquipment: "no equipment catalogued yet",
    cap: "cap",
    pieces: "pieces",
    piece: "piece",
    heroLevel: "Hero level",
    levelCapUnknown: "Level cap not compiled yet",
    levelCap: "Level cap",
    loadout: "Loadout",
    loadoutA: "Loadout A",
    loadoutB: "Loadout B",
    emptySlot: "Empty slot",
    level: "Level",
    compare: "Compare two loadouts",
    stopCompare: "Stop comparing",
    copyBuild: "Copy build link",
    linkCopied: "Link copied",
    slot: "Slot",
    linkAdjusted: "This link was adjusted",
  },
  guides: {
    title: "Guides",
    intro:
      "Attack strategies with the exact hero loadout each one assumes, wired to the simulator rather than screenshotted. Every guide shows when it was last updated and which patch it was written against.",
    townHall: "Town Hall",
    army: "Army",
    any: "Any",
    countOf: "of",
    guidesWord: "guides",
    noMatch: "No guide matches that combination yet.",
    updated: "updated",
    patch: "patch",
    draftWarning:
      "Draft — written from general strategy knowledge and not yet reviewed against live play or the current meta. Treat the specifics as a starting point, not gospel.",
    writtenAgainst: "written against patch",
    englishOnly:
      "Guides are written in English and translated one at a time. Anything not yet translated is shown in English.",
    notTranslated:
      "This guide has not been translated yet, so it is shown in English.",
  },
  equipment: {
    title: "Equipment",
    intro:
      "Every piece the simulator knows about. Stat tables are compiled by hand from patch notes — there is no official stats API — so each piece carries how far along its data is.",
    haveTable: "pieces have a level table",
    of: "of",
    max: "max",
    openInSim: "Open in simulator",
    levelTable: "Level table",
    noTable: "No level table yet",
    sources: "Sources",
    notes: "Notes",
    totalShiny: "Total shiny",
  },
  quality: {
    stub: "no stats yet",
    unverified: "unverified",
    verified: "verified",
  },
  // No `as const`: literal types here would force every translation to repeat
  // the English string exactly.
};

/** Same shape as `en`; TypeScript enforces it. */
const de: typeof en = {
  site: {
    name: "CoC Companion",
    tagline: "Clash-of-Clans-Begleiter",
    theme: "Design",
    language: "Sprache",
    themes: {
      system: "System",
      clash: "Clash",
      "clash-night": "Clash Nacht",
      paper: "Papier",
      slate: "Schiefer",
      midnight: "Mitternacht",
      barracks: "Kaserne",
    },
    nav: {
      practice: "Training",
      sim: "Simulator",
      guides: "Guides",
      equipment: "Ausrüstung",
    },
    footer: {
      disclaimer:
        "Dieses Material ist inoffiziell und wird nicht von Supercell unterstützt. Weitere Informationen findest du in Supercells Fan-Content-Richtlinie:",
      dataNote:
        "Die Werte sind von Hand aus den Patch Notes zusammengetragen. Eine offizielle API für Ausrüstungswerte gibt es nicht.",
    },
  },
  home: {
    title: "Erst richtig zielen, dann ausrechnen, was es bringt.",
    intro:
      "Ein Trainer für die Fähigkeiten, die eine Linie quer durchs Dorf schießen, und ein Loadout-Simulator für alles andere. Jede Übung und jeder Build steckt in der URL — einfach in den Clan-Chat kopieren.",
    practiceTitle: "Fähigkeiten-Training",
    simTitle: "Loadout-Simulator",
    simBody:
      "Zwei Ausrüstungsplätze auf beliebigen Stufen, nebeneinander, mit Aufschlüsselung pro Platz.",
    statusTitle: "Aktueller Stand",
  },
  practice: {
    title: "Fähigkeiten-Training",
    intro:
      "Beide Fähigkeiten schießen eine gerade Linie quer durchs Dorf, und beide sind leicht verschenkt. Richte eine auf einer Basis aus, sieh genau, was sie trifft, und vergleiche sie mit der bestmöglichen Linie.",
    ability: "Fähigkeit",
    viewFlat: "Flach",
    viewIso: "Isometrisch",
    isoNote: "Nur Ansicht — zum Bauen auf Flach wechseln.",
    noAbility: "Keine",
    noAbilityHelp:
      "Keine Fähigkeit gewählt — das Feld ist einfach eine Basis. Wähle eine, um ihre Linie zu zeichnen.",
    pair: "Beide",
    pairHelp:
      "Beide Helden stehen auf dem Feld: die Königin in Blau, der Duke in Rot. Das ist die Erdbeben-Eröffnung — die Beben brechen das Segment auf, dann gehen beide Fähigkeiten durch dieselbe Verteidigung mit vielen Trefferpunkten, weil weder ein Monolith noch ein Rachenturm allein fällt. Zieh einen der beiden; ein Klick aufs Feld bewegt den näheren.",
    level: "Stufe",
    noDamage: "keine Schadenswerte",
    thisLine: "Diese Linie",
    theseLines: "Diese Linien",
    crossedByBoth: "Beide treffen",
    auraNote:
      "{count} weitere in der Aura eines Zauberturms, ohne getroffen zu werden — zählt anteilig.",
    score: "Punkte",
    defences: "Verteidigungen",
    buildings: "Gebäude",
    bestLine: "Beste Linie auf dieser Basis:",
    bestPair: "Bestes Paar auf dieser Basis:",
    moveUsThere: "Beide dorthin bewegen",
    youAreAt: "du bist bei",
    showBest: "Beste Linie zeigen",
    hideBest: "Beste Linie ausblenden",
    moveMeThere: "Dorthin bewegen",
    base: "Basis",
    townHall: "Rathaus",
    thNote:
      "{count} Gebäudetypen gibt es auf diesem Rathaus. Die Zahl auf jedem Chip ist die dortige Maximalstufe.",
    placeBuildings: "Gebäude platzieren",
    searchBuildings: "{count} Gebäude durchsuchen…",
    noMatch: "Nichts gefunden für",
    deleteSelected: "Auswahl löschen",
    erase: "Radieren",
    clear: "Leeren",
    done: "Fertig",
    editInSandbox: "Im Editor bearbeiten",
    custom: "eigene",
    customCount: "Gebäude, im Link gespeichert",
    share: "Teilen",
    copyLink: "Link kopieren",
    linkCopied: "Link kopiert",
    shareNote:
      "Die ganze Übung — Basis, Fähigkeit und Heldenposition — steckt in der URL.",
    sandboxHelp:
      "Editor — klicken zum Platzieren, ein platziertes Gebäude ziehen zum Verschieben. Mauern lassen sich durch Ziehen als Reihe malen. Shift-Klick erweitert die Auswahl, Shift-Ziehen auf freiem Boden zieht einen Rahmen; ein ausgewähltes Gebäude zu ziehen bewegt die ganze Gruppe. Radieren löscht Gebäude beim Darüberziehen. Gebäude rasten am Raster ein und dürfen bündig stehen; Rot heißt, der Platz ist belegt.",
    attackingPrefix: "Sie greift gerade",
    attackingSuffix:
      "an — das nächstgelegene Gebäude. Bewege sie, um das zu ändern.",
    nothingInRange: "Nichts in Reichweite.",
    caveat:
      "Die Pfadbreiten sind Näherungswerte dieses Projekts, keine gemessenen Spielwerte — die Entscheidung stimmt in der Form, die genauen Randfälle nicht. Die Punktgewichte sind eine Einschätzung, was sich zu treffen lohnt, kein Spielwert.",
    categories: {
      core: "Kern",
      defence: "Verteidigung",
      wall: "Mauer",
      resource: "Rohstoffe",
      army: "Armee",
      other: "Sonstiges",
    },
  },
  sim: {
    title: "Simulator",
    intro:
      "Wähle einen Helden, belege beide Ausrüstungsplätze und teile den Build als Link. Kein Konto, kein Speichern — die URL ist der Build.",
    noEquipment: "noch keine Ausrüstung erfasst",
    cap: "max.",
    pieces: "Teile",
    piece: "Teil",
    heroLevel: "Heldenstufe",
    levelCapUnknown: "Maximalstufe noch nicht erfasst",
    levelCap: "Maximalstufe",
    loadout: "Loadout",
    loadoutA: "Loadout A",
    loadoutB: "Loadout B",
    emptySlot: "Leerer Platz",
    level: "Stufe",
    compare: "Zwei Loadouts vergleichen",
    stopCompare: "Vergleich beenden",
    copyBuild: "Build-Link kopieren",
    linkCopied: "Link kopiert",
    slot: "Platz",
    linkAdjusted: "Dieser Link wurde angepasst",
  },
  guides: {
    title: "Guides",
    intro:
      "Angriffsstrategien mit dem genauen Helden-Loadout, das sie voraussetzen — mit dem Simulator verknüpft statt als Screenshot. Jeder Guide zeigt, wann er zuletzt aktualisiert wurde und für welchen Patch er geschrieben ist.",
    townHall: "Rathaus",
    army: "Armee",
    any: "Alle",
    countOf: "von",
    guidesWord: "Guides",
    noMatch: "Für diese Kombination gibt es noch keinen Guide.",
    updated: "aktualisiert",
    patch: "Patch",
    draftWarning:
      "Entwurf — aus allgemeinem Strategiewissen geschrieben und noch nicht gegen echte Angriffe oder das aktuelle Meta geprüft. Nimm die Details als Ausgangspunkt, nicht als Gesetz.",
    writtenAgainst: "geschrieben für Patch",
    englishOnly:
      "Guides werden auf Englisch geschrieben und nach und nach übersetzt. Was noch nicht übersetzt ist, erscheint auf Englisch.",
    notTranslated:
      "Dieser Guide ist noch nicht übersetzt und wird deshalb auf Englisch angezeigt.",
  },
  equipment: {
    title: "Ausrüstung",
    intro:
      "Jedes Teil, das der Simulator kennt. Die Werttabellen sind von Hand aus den Patch Notes zusammengetragen — eine offizielle API gibt es nicht — deshalb trägt jedes Teil, wie weit seine Daten sind.",
    haveTable: "Teile haben eine Werttabelle",
    of: "von",
    max: "max.",
    openInSim: "Im Simulator öffnen",
    levelTable: "Werttabelle",
    noTable: "Noch keine Werttabelle",
    sources: "Quellen",
    notes: "Anmerkungen",
    totalShiny: "Glänzend gesamt",
  },
  quality: {
    stub: "noch keine Werte",
    unverified: "ungeprüft",
    verified: "geprüft",
  },
};

export type Dictionary = typeof en;

const DICTIONARIES: Record<Locale, Dictionary> = { en, de };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/** Fills `{name}` placeholders. */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  );
}
