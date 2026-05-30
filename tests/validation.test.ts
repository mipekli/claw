import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/validation";

describe("validateConfig", () => {
  it("throws for missing api key", () => {
    expect(() =>
      validateConfig({
        provider: "openai",
        openai: { apiKey: "", model: "gpt-4o" },
      })
    ).toThrow();
  });

  it("accepts valid config", () => {
    expect(() =>
      validateConfig({
        provider: "openai",
        openai: { apiKey: "x", model: "gpt-4o" },
      })
    ).not.toThrow();
  });
});
