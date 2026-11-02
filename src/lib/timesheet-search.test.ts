import { describe, expect, test } from "bun:test";
import { addSearchToHistory, textMatches } from "./timesheet-search";

describe("local timesheet search", () => {
  test("September matches a saved September regardless of case or spaces", () => {
    expect(textMatches("September 2026", " September ")).toBe(true);
    expect(textMatches("Oktober 2026", "September")).toBe(false);
  });
  test("German month names work without an umlaut", () => {
    expect(textMatches("März 2026", "Marz")).toBe(true);
    expect(textMatches("März 2026", "Maerz")).toBe(true);
  });
  test("search history retains terms with the latest first, without duplicates", () => {
    expect(addSearchToHistory(["Oktober", "September"], " september ")).toEqual(["september", "Oktober"]);
    expect(addSearchToHistory(["September"], " ")).toEqual(["September"]);
  });
});