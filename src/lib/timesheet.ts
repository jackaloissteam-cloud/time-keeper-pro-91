export type Entry = {
  id: string;
  date: string; // yyyy-mm-dd
  start: string; // HH:MM
  end: string; // HH:MM
  breakMinutes: number;
  note: string;
};

export type Settings = {
  employee: string;
  month: string; // yyyy-MM
  baseRate: number;
  overtimeRate: number;
  capHours: number;
};

export const defaultSettings: Settings = {
  employee: "",
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

/** Zeitraum als Text, z. B. "07:00–15:00" (für das mobile Ein-Zeilen-Feld). */
export function formatTimeRange(entry: Entry): string {
  if (!entry.start && !entry.end) return "";
  return `${entry.start || "…"}–${entry.end || "…"}`;
}

/**
 * Liest einen Zeitraum aus Freitext: "7-15", "7:30-15", "07:00 – 15:00",
 * "700-1500", "7 bis 15". Gibt null zurück, wenn nichts Eindeutiges erkannt wird.
 */
export function parseTimeRange(value: string): { start: string; end: string } | null {
  const norm = (t: string): string | null => {
    const m = t.replace(/[.,]/g, ":").match(/^(\d{1,2})(?::?(\d{2}))?$/);
    if (!m) return null;
    const h = Number(m[1] ?? "");
    const min = m[2] ? Number(m[2]) : 0;
    if (h > 24 || min > 59) return null;
    return `${String(h % 24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  };
  const parts = value
    .split(/[-–—]|\bbis\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length !== 2) return null;
  const start = norm(parts[0] ?? "");
  const end = norm(parts[1] ?? "");
  if (!start || !end) return null;
  return { start, end };
}

/** Erzeugt eine Excel-Datei (.xlsx) des aktuellen Monats und lädt sie herunter. */
export async function downloadXlsx(entries: Entry[], settings: Settings, totals: Totals) {
  const XLSX = await import("xlsx");
  const rows: (string | number)[][] = [
    ["Stundenzettel", formatMonth(settings.month)],
    ["Mitarbeiter", settings.employee || ""],
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

/** Erzeugt ein kompaktes A4-PDF (Hochformat, eine Seite) des gesamten Monats. */
export async function downloadPdf(entries: Entry[], settings: Settings, totals: Totals) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(15);
  doc.text(`Stundenzettel – ${formatMonth(settings.month)}`, 14, 14);
  if (settings.employee) {
    doc.setFontSize(10);
    doc.text(`Mitarbeiter: ${settings.employee}`, 14, 20);
  }

  const body = entries.map((e) => {
    const h = entryHours(e);
    return [
      dayLabel(e.date),
      e.start || "",
      e.end || "",
      e.breakMinutes ? String(e.breakMinutes) : "",
      h === null ? "" : formatHours(h),
      e.note || "",
    ];
  });

  autoTable(doc, {
    head: [["Datum", "Beginn", "Ende", "Pause", "Std.", "Tour / Bemerkung"]],
    body,
    startY: settings.employee ? 24 : 19,
    styles: { fontSize: 7.5, cellPadding: 0.9, lineColor: [210, 210, 210], lineWidth: 0.1 },
    headStyles: { fillColor: [31, 63, 110], textColor: 255, fontSize: 7.5 },
    alternateRowStyles: { fillColor: [246, 247, 249] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 16, halign: "center" },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 14, halign: "right" },
      5: { cellWidth: "auto" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && isWeekend(entries[data.row.index]?.date ?? "")) {
        data.cell.styles.fillColor = [231, 235, 241];
      }
    },
    theme: "grid",
    margin: { left: 14, right: 14 },
  });

  const y =
    ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60) + 4;

  autoTable(doc, {
    startY: y,
    body: [
      ["Gesamtstunden", `${formatHours(totals.totalHours)} Std.`],
      [
        `Basis-Stunden (bis ${formatHours(settings.capHours)})`,
        `${formatHours(totals.baseHours)} Std.`,
      ],
      ["Überstunden", `${formatHours(totals.overtimeHours)} Std.`],
      [`Summe Basis (${formatEuro(settings.baseRate)}/Std.)`, formatEuro(totals.basePay)],
      [
        `Summe Überstunden (${formatEuro(settings.overtimeRate)}/Std.)`,
        formatEuro(totals.overtimePay),
      ],
      ["Auszahlung gesamt", formatEuro(totals.totalPay)],
    ],
    styles: { fontSize: 8.5, cellPadding: 1.2 },
    columnStyles: { 0: { cellWidth: 90 }, 1: { halign: "right", fontStyle: "bold" } },
    theme: "plain",
    margin: { left: 14 },
    tableWidth: 130,
  });

  doc.save(`Stundenzettel_${settings.month}.pdf`);
}
