import { describe, it, expect } from "@jest/globals";
import { translateText } from "../src/services/translation.service.js";

describe("translation service", () => {
  it("returns mock-safe output without API", async () => {
    const out = await translateText({ text: "Hello", from: "en", to: "he" });
    expect(out.translated).toBeTruthy();
    expect(typeof out.mock).toBe("boolean");
  });
});
