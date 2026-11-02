import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { addSearchToHistory, textMatches } from "./timesheet-search";

describe("local timesheet search", () => {
  test("September matches a saved September regardless of case or spaces", () => {
    assert.equal(textMatches("September 2026", " September "), true);
    assert.equal(textMatches("Oktober 2026", "September"), false);
  });
  test("German month names work without an umlaut", () => {
    assert.equal(textMatches("März 2026", "Marz"), true);
    assert.equal(textMatches("März 2026", "Maerz"), true);
  });
  test("search history retains terms with the latest first, without duplicates", () => {
    assert.deepEqual(addSearchToHistory(["Oktober", "September"], " september "), ["september", "Oktober"]);
    assert.deepEqual(addSearchToHistory(["September"], " "), ["September"]);
  });
});