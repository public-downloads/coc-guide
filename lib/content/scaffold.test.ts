import { describe, expect, it } from "vitest";
import matter from "gray-matter";
import { guideFrontmatterSchema, localised } from "./guides";
import {
  CURRENT_PATCH,
  guideSlug,
  readArmyTag,
  renderGuide,
  serializeGuide,
  today,
  writeArmyTag,
  type GuideDraft,
} from "./scaffold";

const draft: GuideDraft = {
  title: "Queen Charge Hybrid",
  summary: "A summary.",
  thLevel: 15,
  armyComp: ["hog-rider", "miner", "healer"],
  difficulty: "advanced",
  updatedAt: "2026-08-12",
  patch: CURRENT_PATCH,
};

describe("guideSlug", () => {
  it("kebab-cases the title and appends the town hall", () => {
    expect(guideSlug("Queen Charge Hybrid", 15)).toBe(
      "queen-charge-hybrid-th15",
    );
  });

  it("strips punctuation and accents rather than encoding them", () => {
    expect(guideSlug("Süi Lalo (fast!)", 13)).toBe("sui-lalo-fast-th13");
  });

  it("does not repeat a town hall the title already carries", () => {
    expect(guideSlug("Mass Dragon TH11", 11)).toBe("mass-dragon-th11");
  });
});

describe("today", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(today(new Date(2026, 0, 4))).toBe("2026-01-04");
  });
});

describe("renderGuide", () => {
  // The scaffolder is only useful if what it writes passes `validate:data`,
  // so the template is checked against the real schema, not a snapshot.
  it("emits frontmatter the guide schema accepts", () => {
    const { data } = matter(renderGuide(draft, "queen-charge-hybrid-th15"));
    const parsed = guideFrontmatterSchema.safeParse(data);

    expect(parsed.error?.issues).toBeUndefined();
    expect(parsed.success && parsed.data).toMatchObject({
      title: "Queen Charge Hybrid",
      thLevel: 15,
      armyComp: ["hog-rider", "miner", "healer"],
      difficulty: "advanced",
      draft: true,
    });
  });

  it("survives a title containing YAML punctuation", () => {
    const { data } = matter(
      renderGuide({ ...draft, title: 'Hybrid: "the workhorse"' }, "x-th15"),
    );

    expect(guideFrontmatterSchema.parse(data).title).toBe(
      'Hybrid: "the workhorse"',
    );
  });

  it("round-trips through serializeGuide unchanged", () => {
    // What the studio does on every save: parse a file, edit, write it back.
    const original = renderGuide(draft, "queen-charge-hybrid-th15");
    const parsed = matter(original);
    const meta = guideFrontmatterSchema.parse(parsed.data);

    const rewritten = serializeGuide(meta, parsed.content);
    const reparsed = matter(rewritten);

    expect(guideFrontmatterSchema.parse(reparsed.data)).toEqual(meta);
    expect(reparsed.content.trim()).toBe(parsed.content.trim());
  });

  it("keeps the patch a string when serialized", () => {
    // Unquoted, YAML reads 2025.10 as a float and drops the trailing zero.
    const meta = guideFrontmatterSchema.parse(
      matter(renderGuide(draft, "x-th15")).data,
    );
    expect(matter(serializeGuide(meta, "body")).data.patch).toBe("2025.10");
  });

  it("seeds the army row from the frontmatter", () => {
    expect(renderGuide(draft, "queen-charge-hybrid-th15")).toContain(
      '<Army units="hog-rider, miner, healer" />',
    );
  });

  it("prefers the spec's counts over the bare frontmatter list", () => {
    const text = renderGuide(
      { ...draft, armySpec: "hog-rider x12, miner x6, healer x4" },
      "queen-charge-hybrid-th15",
    );
    expect(text).toContain('<Army units="hog-rider x12, miner x6, healer x4" />');
  });
});

describe("translations", () => {
  const meta = guideFrontmatterSchema.parse(
    matter(renderGuide(draft, "queen-charge-hybrid-th15")).data,
  );

  it("falls back to the English a guide is written in", () => {
    expect(localised(meta, "de")).toEqual({
      title: "Queen Charge Hybrid",
      summary: "A summary.",
    });
  });

  it("prefers a translation once one exists", () => {
    const translated = { ...meta, translations: { de: { title: "Königin", summary: "Kurz." } } };
    expect(localised(translated, "de")).toEqual({ title: "Königin", summary: "Kurz." });
    // The English reader is unaffected by a German translation existing.
    expect(localised(translated, "en").title).toBe("Queen Charge Hybrid");
  });

  it("falls back per field, not per language", () => {
    // A half-finished translation should not blank out the other field.
    const half = { ...meta, translations: { de: { title: "Königin", summary: "" } } };
    expect(localised(half, "de")).toEqual({
      title: "Königin",
      summary: "A summary.",
    });
  });

  it("round-trips through serializeGuide", () => {
    const translated = { ...meta, translations: { de: { title: "Königin", summary: "Kurz." } } };
    const reparsed = guideFrontmatterSchema.parse(
      matter(serializeGuide(translated, "body")).data,
    );
    expect(reparsed.translations).toEqual({ de: { title: "Königin", summary: "Kurz." } });
  });

  it("writes no translations block when there is nothing to translate", () => {
    // An untranslated guide keeps the frontmatter it has always had.
    expect(serializeGuide(meta, "body")).not.toContain("translations");
  });
});

describe("the body's army tag", () => {
  // The studio writes counts here because the frontmatter cannot hold them.
  const body = 'Intro.\n\n<Army units="hog-rider x12" />\n\n## Reading the base\n';

  it("reads the first tag", () => {
    expect(readArmyTag(body)).toBe("hog-rider x12");
    expect(readArmyTag("no army here")).toBeNull();
  });

  it("rewrites in place, leaving the prose alone", () => {
    expect(writeArmyTag(body, "hog-rider x14, healer x4")).toBe(
      'Intro.\n\n<Army units="hog-rider x14, healer x4" />\n\n## Reading the base\n',
    );
  });

  it("only touches the first tag, not the one documenting it", () => {
    // The scaffolded body carries a second tag inside a JSX comment; rewriting
    // that would edit the instructions rather than the army.
    const twice = `<Army units="a" />\n\n{/* <Army units="a" /> */}`;
    expect(writeArmyTag(twice, "b")).toBe(
      `<Army units="b" />\n\n{/* <Army units="a" /> */}`,
    );
  });

  it("adds a tag to a body that has none", () => {
    expect(writeArmyTag("Just prose.", "balloon x30")).toBe(
      '<Army units="balloon x30" />\n\nJust prose.',
    );
  });

  it("keeps other attributes on the tag", () => {
    expect(writeArmyTag('<Army compact units="a" />', "b")).toBe(
      '<Army compact units="b" />',
    );
  });

  it("drops the tag when the army is emptied", () => {
    expect(writeArmyTag(body, "")).toBe("Intro.\n\n## Reading the base\n");
  });
});
