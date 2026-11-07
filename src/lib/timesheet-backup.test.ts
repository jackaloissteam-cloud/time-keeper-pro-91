import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBackup, restoreMissingMonths } from "./timesheet-backup";

const september = { month: "2026-09", employee: "", entries: [{ id: "old-id", date: "2026-09-01", start: "09:00", end: "15:00", breakMinutes: 30, note: "Tour" }] };
test("backup restores earlier times, breaks and notes", () => {
  const parsed = parseBackup(JSON.stringify({ months: { "2026-09": september } }));
  assert.deepEqual(parsed["2026-09"]?.entries[0], { ...september.entries[0], id: "2026-09-01" });
});
test("restore keeps existing populated months and adds missing months", () => {
  const result = restoreMissingMonths({ "2026-09": september }, { "2026-09": { ...september, employee: "Other" }, "2026-10": { month: "2026-10", employee: "", entries: [] } });
  assert.equal(result.months["2026-09"]?.employee, "");
  assert.equal(result.imported, 1);
  assert.equal(result.skipped, 1);
});
test("empty current month can be restored", () => {
  assert.equal(restoreMissingMonths({ "2026-09": { ...september, entries: [] } }, { "2026-09": september }).imported, 1);
});
test("backup keeps the carry-over and rejects invalid carry-over values", () => {
  const parsed = parseBackup(JSON.stringify({ months: { "2026-09": { ...september, carryOverHours: 5.5 } } }));
  assert.equal(parsed["2026-09"]?.carryOverHours, 5.5);
  assert.equal(parseBackup(JSON.stringify({ months: { "2026-09": september } }))["2026-09"]?.carryOverHours, 0);
  assert.throws(() => parseBackup(JSON.stringify({ months: { "2026-09": { ...september, carryOverHours: -1 } } })));
});
test("invalid dates and times reject the entire import", () => {
  for (const patch of [{ date: "2026-09-31" }, { start: "25:00" }, { breakMinutes: -1 }]) {
    assert.throws(() => parseBackup(JSON.stringify({ months: { "2026-09": { ...september, entries: [{ ...september.entries[0], ...patch }] } } })));
  }
  assert.throws(() => parseBackup('{"months":{}}'));
});