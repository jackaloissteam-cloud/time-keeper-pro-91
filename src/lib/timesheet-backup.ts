import { daysInMonth, type Entry } from "./timesheet";

export type MonthRow = { month: string; employee: string; entries: Entry[] };
export type MonthMap = Record<string, MonthRow>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseBackup(text: string): MonthMap {
  const data: unknown = JSON.parse(text);
  if (!isRecord(data) || !isRecord(data["months"])) throw new Error("Bitte eine gültige Stundenzettel-Sicherung (.json) auswählen.");
  const result: MonthMap = {};
  const validTime = (time: unknown): time is string => typeof time === "string" && (time === "" || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time));
  for (const [month, row] of Object.entries(data["months"])) {
    if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) || !isRecord(row) || row["month"] !== month || typeof row["employee"] !== "string" || !Array.isArray(row["entries"])) {
      throw new Error("Die Sicherung enthält ungültige Monatsdaten. Es wurde nichts importiert.");
    }
    const dates = new Set<string>();
    const entries: Entry[] = [];
    for (const entry of row["entries"]) {
      if (!isRecord(entry) || typeof entry["date"] !== "string" || !entry["date"].startsWith(`${month}-`) || !/^\d{4}-\d{2}-\d{2}$/.test(entry["date"]) || Number(entry["date"].slice(-2)) < 1 || Number(entry["date"].slice(-2)) > daysInMonth(month) || dates.has(entry["date"]) || !validTime(entry["start"]) || !validTime(entry["end"]) || typeof entry["breakMinutes"] !== "number" || !Number.isFinite(entry["breakMinutes"]) || entry["breakMinutes"] < 0 || typeof entry["note"] !== "string") {
        throw new Error("Die Sicherung enthält ungültige Tageseinträge. Es wurde nichts importiert.");
      }
      dates.add(entry["date"]);
      entries.push({ id: entry["date"], date: entry["date"], start: entry["start"], end: entry["end"], breakMinutes: entry["breakMinutes"], note: entry["note"] });
    }
    result[month] = { month, employee: row["employee"], entries };
  }
  if (Object.keys(result).length === 0) throw new Error("Die Sicherung enthält keine Stundenzettel.");
  return result;
}

export function restoreMissingMonths(existing: MonthMap, incoming: MonthMap) {
  const merged = { ...existing };
  let imported = 0;
  let skipped = 0;
  for (const [month, row] of Object.entries(incoming)) {
    const current = existing[month];
    if (current && (current.employee || current.entries.some((entry) => entry["start"] || entry["end"] || entry["note"] || entry["breakMinutes"]))) {
      skipped++;
    } else {
      merged[month] = row;
      imported++;
    }
  }
  return { months: merged, imported, skipped };
}