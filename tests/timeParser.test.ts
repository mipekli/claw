import { describe, expect, it } from "vitest";
import { parseDateTime } from "../src/timeParser";

describe("parseDateTime", () => {
  const baseDate = new Date("2026-06-03T12:00:00.000Z"); // UTC 12:00

  it("parses seconds duration", () => {
    const result = parseDateTime("30s", baseDate);
    expect(result?.toISOString()).toBe("2026-06-03T12:00:30.000Z");
  });

  it("parses minutes duration", () => {
    const result = parseDateTime("10m", baseDate);
    expect(result?.toISOString()).toBe("2026-06-03T12:10:00.000Z");
  });

  it("parses hours duration", () => {
    const result = parseDateTime("2h", baseDate);
    expect(result?.toISOString()).toBe("2026-06-03T14:00:00.000Z");
  });

  it("parses days duration", () => {
    const result = parseDateTime("3d", baseDate);
    expect(result?.toISOString()).toBe("2026-06-06T12:00:00.000Z");
  });

  it("parses HH:MM today when in future", () => {
    // baseDate is 12:00, parsing 15:30
    const baseLocal = new Date();
    baseLocal.setHours(12, 0, 0, 0);

    const result = parseDateTime("15:30", baseLocal);
    expect(result?.getHours()).toBe(15);
    expect(result?.getMinutes()).toBe(30);
    expect(result?.getDate()).toBe(baseLocal.getDate());
  });

  it("parses HH:MM tomorrow when in past", () => {
    // baseDate is 12:00, parsing 08:30
    const baseLocal = new Date();
    baseLocal.setHours(12, 0, 0, 0);

    const result = parseDateTime("08:30", baseLocal);
    expect(result?.getHours()).toBe(8);
    expect(result?.getMinutes()).toBe(30);
    
    const tomorrow = new Date(baseLocal);
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(result?.getDate()).toBe(tomorrow.getDate());
  });

  it("parses YYYY-MM-DD HH:MM", () => {
    const result = parseDateTime("2026-06-04 15:30");
    expect(result?.getFullYear()).toBe(2026);
    expect(result?.getMonth()).toBe(5); // 0-indexed (June is 5)
    expect(result?.getDate()).toBe(4);
    expect(result?.getHours()).toBe(15);
    expect(result?.getMinutes()).toBe(30);
  });

  it("parses ISO format", () => {
    const result = parseDateTime("2026-06-05T18:00:00.000Z");
    expect(result?.toISOString()).toBe("2026-06-05T18:00:00.000Z");
  });

  it("returns null for invalid inputs", () => {
    expect(parseDateTime("invalid")).toBeNull();
    expect(parseDateTime("10x")).toBeNull();
  });
});
