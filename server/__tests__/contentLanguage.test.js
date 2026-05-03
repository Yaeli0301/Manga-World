import { describe, it, expect } from "@jest/globals";
import { localizeManga, localizeChapterForReader, resolveContentLanguage } from "../src/utils/contentLanguage.js";

describe("contentLanguage", () => {
  it("resolveContentLanguage prefers header", () => {
    const req = { headers: { "x-content-language": "he" }, user: { language: "en" } };
    expect(resolveContentLanguage(req)).toBe("he");
  });

  it("localizeManga uses Hebrew when lang he and titleHe set", () => {
    const m = { title: "Hello", titleHe: "שלום", description: "A", descriptionHe: "א" };
    const out = localizeManga(m, "he");
    expect(out.title).toBe("שלום");
    expect(out.description).toBe("א");
  });

  it("localizeChapterForReader swaps page imageUrl when imageUrlHe set", () => {
    const ch = {
      title: "Ch",
      titleHe: "פרק",
      pages: [
        { index: 0, imageUrl: "https://en/0.webp", imageUrlHe: "https://he/0.webp" },
        { index: 1, imageUrl: "https://en/1.webp", imageUrlHe: "" },
      ],
    };
    const he = localizeChapterForReader(ch, "he");
    expect(he.title).toBe("פרק");
    expect(he.pages[0].imageUrl).toBe("https://he/0.webp");
    expect(he.pages[1].imageUrl).toBe("https://en/1.webp");
    const en = localizeChapterForReader(ch, "en");
    expect(en.pages[0].imageUrl).toBe("https://en/0.webp");
  });
});
