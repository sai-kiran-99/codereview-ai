import { describe, expect, it } from "vitest";
import { LineSplitter, parseReviewLine, sortIssues } from "../src/services/reviewParser.js";

describe("LineSplitter", () => {
  it("joins lines split across chunks", () => {
    const s = new LineSplitter();
    expect(s.push('{"a":')).toEqual([]);
    expect(s.push('1}\n{"b"')).toEqual(['{"a":1}']);
    expect(s.push(":2}\n")).toEqual(['{"b":2}']);
    expect(s.flush()).toEqual([]);
  });

  it("returns the last line without a newline on flush", () => {
    const s = new LineSplitter();
    s.push('{"x":1}');
    expect(s.flush()).toEqual(['{"x":1}']);
  });
});

describe("parseReviewLine", () => {
  it("parses a summary", () => {
    expect(parseReviewLine('{"type":"summary","title":"T","summary":"Looks ok"}', 10)).toEqual({
      kind: "summary",
      value: { title: "T", summary: "Looks ok" },
    });
  });

  it("parses an issue and normalizes severity/category", () => {
    const r = parseReviewLine(
      '{"type":"issue","line":"3","severity":"MAJOR","category":"Best Practice","message":"m","suggestion":"s"}',
      10,
    );
    expect(r).toEqual({ kind: "issue", value: { line: 3, severity: "major", category: "best-practice", message: "m", suggestion: "s" } });
  });

  it("clamps a line number past the end of the code", () => {
    const r = parseReviewLine('{"type":"issue","line":99,"severity":"minor","category":"bug","message":"m"}', 5);
    expect(r?.kind === "issue" && r.value.line).toBe(5);
  });

  it.each([
    ["blank", ""],
    ["code fence", "```json"],
    ["broken json", '{"type":"issue",'],
    ["unknown severity", '{"type":"issue","line":1,"severity":"huge","category":"bug","message":"m"}'],
    ["missing message", '{"type":"issue","line":1,"severity":"minor","category":"bug"}'],
    ["line 0", '{"type":"issue","line":0,"severity":"minor","category":"bug","message":"m"}'],
    ["unknown type", '{"type":"other"}'],
  ])("ignores %s", (_name, line) => {
    expect(parseReviewLine(line, 10)).toBeNull();
  });
});

describe("sortIssues", () => {
  it("sorts by severity, then line", () => {
    const base = { category: "bug" as const, message: "m", suggestion: "" };
    const sorted = sortIssues([
      { ...base, line: 9, severity: "info" },
      { ...base, line: 5, severity: "critical" },
      { ...base, line: 2, severity: "critical" },
      { ...base, line: 1, severity: "minor" },
    ]);
    expect(sorted.map((i) => `${i.severity}:${i.line}`)).toEqual(["critical:2", "critical:5", "minor:1", "info:9"]);
  });
});
