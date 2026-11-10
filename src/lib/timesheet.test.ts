import { test } from "node:test";
import assert from "node:assert/strict";

import { calcTotals, defaultSettings, parseTimeRange, previousMonth, type Entry } from "./timesheet";

const entry = (start: string, end: string): Entry => ({
  id: start,
  date: "2026-09-01",
  start,
  end,
  breakMinutes: 0,
  note: "",
});

test("carry-over counts toward total hours and the cap", () => {
  // 8 worked hours + 40 carry-over = 48 → 43 base, 5 overtime
  const totals = calcTotals([entry("07:00", "15:00")], { ...defaultSettings, capHours: 43 }, 40);
  assert.equal(totals.totalHours, 48);
  assert.equal(totals.baseHours, 43);
  assert.equal(totals.overtimeHours, 5);
});

test("previous month's overtime flows straight into overtime", () => {
  // 10 worked hours + 35 carry-over = 45 → 2 overtime
  const totals = calcTotals([entry("06:00", "16:00")], { ...defaultSettings, capHours: 43 }, 35);
  assert.equal(totals.totalHours, 45);
  assert.equal(totals.overtimeHours, 2);
});

test("without carry-over the calculation is unchanged", () => {
  const totals = calcTotals([entry("07:00", "15:00")], defaultSettings);
  assert.equal(totals.totalHours, 8);
  assert.equal(totals.overtimeHours, 0);
});

test("previousMonth stays within the year", () => {
  assert.equal(previousMonth("2026-09"), "2026-08");
});

test("previousMonth crosses the year boundary", () => {
  assert.equal(previousMonth("2026-01"), "2025-12");
});

test("parseTimeRange akzeptiert Punkt als Minuten-Trennzeichen", () => {
  assert.deepEqual(parseTimeRange("9.15-15.25"), { start: "09:15", end: "15:25" });
  assert.deepEqual(parseTimeRange("7,30-15"), { start: "07:30", end: "15:00" });
  assert.deepEqual(parseTimeRange("9.15 – 15.25"), { start: "09:15", end: "15:25" });
});
