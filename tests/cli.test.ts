import { describe, expect, it } from "vitest";
import { parseAskArgs } from "../src/cli";

describe("parseAskArgs", () => {
  it("parses inline question", () => {
    expect(parseAskArgs(["hello", "world"])).toEqual({ question: "hello world" });
  });

  it("parses --file argument", () => {
    expect(parseAskArgs(["--file", "/tmp/a.txt", "hello"])).toEqual({
      question: "hello",
      filePath: "/tmp/a.txt",
    });
  });
});
