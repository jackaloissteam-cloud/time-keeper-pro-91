export type Entry = {
  id: string;
  date: string; // yyyy-mm-dd
  start: string; // HH:MM
  end: string; // HH:MM
  breakMinutes: number;
  note: string;
};

export type Settings = {
  month: string; // yyyy-MM
  baseRate: number;
  overtimeRate: number;
  capHours: number;
};

export const defaultSettings: Settings = {
  month: new Date().toISOString().slice(0, 7),
  baseRate: 13.9,
  overtimeRate: 12,
  capHours: 43,
};

export function createEntry(date = ""): Entry {
  return {
    id: crypto.randomUUID(),
    date,
    start: "",
    end: "",
    breakMinutes: 0,
    note: "",
  };
}

/** Arbeitszeit in Stunden; unterstützt Schichten über Mitternacht. */
export function entryHours(entry: Entry): number | null {
  if (!entry.start || !entry.end) return null;
  const [sh = NaN, sm = NaN] = entry.start.split(":").map(Number);
  const [eh = NaN, em = NaN] = entry.end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  minutes -= Number.isFinite(entry.breakMinutes) ? entry.breakMinutes : 0;
  return Math.round((minutes / 60) * 100) / 100;
}

export type Totals = {
  totalHours: number;
  baseHours: number;
  overtimeHours: number;
  basePay: number;
  overtimePay: number;
  totalPay: number;
  remainingToCap: number;
};

export function calcTotals(entries: Entry[], settings: Settings): Totals {
  const totalHours =
    Math.round(entries.reduce((sum, e) => sum + (entryHours(e) ?? 0), 0) * 100) / 100;
  const baseHours = Math.min(totalHours, settings.capHours);
  const overtimeHours = Math.max(0, Math.round((totalHours - settings.capHours) * 100) / 100);
  const basePay = Math.round(baseHours * settings.baseRate * 100) / 100;
  const overtimePay = Math.round(overtimeHours * settings.overtimeRate * 100) / 100;
  return {
    totalHours,
    baseHours,
    overtimeHours,
    basePay,
    overtimePay,
    totalPay: Math.round((basePay + overtimePay) * 100) / 100,
    remainingToCap: Math.max(0, Math.round((settings.capHours - totalHours) * 100) / 100),
  };
}

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const number = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatEuro = (value: number) => euro.format(value);
export const formatHours = (value: number) => number.format(value);

export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

export function formatDate(date: string): string {
  if (!date) return "";
  const d = new Date(date + "T00:00:00");
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function toCsv(entries: Entry[], settings: Settings, totals: Totals): string {
  const rows: string[][] = [
    ["Datum", "Beginn", "Ende", "Pause (Min)", "Arbeitszeit (Std)", "Tour / Bemerkung"],
    ...entries.map((e) => [
      formatDate(e.date),
      e.start,
      e.end,
      String(e.breakMinutes || 0),
      entryHours(e) === null ? "" : formatHours(entryHours(e) as number),
      e.note,
    ]),
    [],
    ["Gesamtstunden", formatHours(totals.totalHours)],
    [`Basis-Stunden (bis ${formatHours(settings.capHours)})`, formatHours(totals.baseHours)],
    ["Überstunden", formatHours(totals.overtimeHours)],
    ["Summe Basis", formatEuro(totals.basePay)],
    ["Summe Überstunden", formatEuro(totals.overtimePay)],
    ["Gesamtsumme", formatEuro(totals.totalPay)],
  ];
  return rows
    .map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return 31;
  return new Date(y, m, 0).getDate();
}

/** Erzeugt für jeden Tag des Monats eine Zeile; vorhandene Einträge bleiben erhalten. */
export function buildMonthEntries(month: string, existing: Entry[] = []): Entry[] {
  const byDate = new Map(existing.map((e) => [e.date, e]));
  const count = daysInMonth(month);
  return Array.from({ length: count }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    return byDate.get(date) ?? createEntry(date);
  });
}

export function dayLabel(date: string): string {
  if (!date) return "";
  const d = new Date(date + "T00:00:00");
  if (Number.isNaN(d.getTime())) return date;
  const wd = d.toLocaleDateString("de-DE", { weekday: "short" });
  return `${String(d.getDate()).padStart(2, "0")}. ${wd}`;
}

export function isWeekend(date: string): boolean {
  const d = new Date(date + "T00:00:00");
  if (Number.isNaN(d.getTime())) return false;
  return d.getDay() === 0 || d.getDay() === 6;
}

/** Erzeugt eine Excel-Datei (.xlsx) des aktuellen Monats und lädt sie herunter. */
export async function downloadXlsx(entries: Entry[], settings: Settings, totals: Totals) {
  const XLSX = await import("xlsx");
  const rows: (string | number)[][] = [
    ["Stundenzettel", formatMonth(settings.month)],
    [],
    ["Datum", "Beginn", "Ende", "Pause (Min)", "Arbeitszeit (Std)", "Tour / Bemerkung"],
    ...entries.map((e) => {
      const h = entryHours(e);
      return [
        formatDate(e.date),
        e.start,
        e.end,
        e.breakMinutes || 0,
        h === null ? "" : h,
        e.note,
      ];
    }),
    [],
    ["Gesamtstunden", totals.totalHours],
    [`Basis-Stunden (bis ${formatHours(settings.capHours)})`, totals.baseHours],
    ["Überstunden", totals.overtimeHours],
    [`Summe Basis (${settings.baseRate} €/Std.)`, totals.basePay],
    [`Summe Überstunden (${settings.overtimeRate} €/Std.)`, totals.overtimePay],
    ["Gesamtsumme (€)", totals.totalPay],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 26 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 28 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stundenzettel");
  XLSX.writeFile(wb, `Stundenzettel_${settings.month}.xlsx`);
}
