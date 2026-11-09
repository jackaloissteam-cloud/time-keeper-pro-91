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

export function calcTotals(entries: Entry[], settings: Settings, carryOverHours = 0): Totals {
  const worked = entries.reduce((sum, e) => sum + (entryHours(e) ?? 0), 0);
  const totalHours = Math.round((worked + carryOverHours) * 100) / 100;
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

/** Schlüssel des Vormonats, z. B. "2026-01" → "2025-12". */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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

/** Trennzeichen zwischen Beginn und Ende, z. B. "-", "–" oder "bis". */
const SEPARATOR = /[-–—]|\bbis\b/i;

/** True, wenn der Text schon ein Trennzeichen enthält. */
export function hasTimeSeparator(value: string): boolean {
  return SEPARATOR.test(value);
}

/** True, wenn nach dem Trennzeichen genug Ziffern für eine vollständige Zeit stehen. */
export function isCompleteTimeRange(value: string): boolean {
  if (!hasTimeSeparator(value)) return false;
  const parts = value
    .split(SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length !== 2) return false;
  const tail = parts[1] ?? "";
  return (tail.match(/\d/g) ?? []).length >= 2;
}

/**
 * Liest einen Zeitraum aus Freitext: "7-15", "7:30-15", "07:00 – 15:00",
 * "700-1500", "7 bis 15". Ohne Trennzeichen (Handy-Tastatur hat oft keins)
 * wird nur geraten, wenn genau eine Lesart möglich ist: "73015" → 07:30–15:00.
 * Sonst null.
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

  const text = value.trim();
  if (!text) return null;

  if (SEPARATOR.test(text)) {
    const parts = text
      .split(SEPARATOR)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length !== 2) return null;
    const start = norm(parts[0] ?? "");
    const end = norm(parts[1] ?? "");
    if (!start || !end) return null;
    return { start, end };
  }

  const digits = text.replace(/\D/g, "");
  if (digits.length < 3 || digits.length > 6) return null;
  const options: { start: string; end: string }[] = [];
  for (let i = 1; i < digits.length; i++) {
    const start = norm(digits.slice(0, i) ?? "");
    const end = norm(digits.slice(i) ?? "");
    if (start && end) options.push({ start, end });
  }
  return options.length === 1 ? (options[0] ?? null) : null;
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

/** Druckfreundliches A4-PDF; lange Bemerkungen werden ohne Abschneiden fortgesetzt. */
export async function downloadPdf(entries: Entry[], settings: Settings, totals: Totals, carryOverHours = 0) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  // Neutral print palette: readable in monochrome, without large ink-heavy fills.
  const ink = 30;
  const muted = 90;
  const rule = 190;
  const paperTint = 245;
  const left = 14;
  const right = 196;
  const month = formatMonth(settings.month);
  doc.setProperties({ title: `Stundenzettel – ${month}`, subject: "Arbeitszeiten und monatliche Vergütungsberechnung", creator: "Stundenzettel-Rechner" });
  const heading = () => {
    doc.setTextColor(ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Stundenzettel", left, 18);
    doc.setFontSize(12);
    doc.text(month, right, 18, { align: "right" });
    doc.setDrawColor(rule);
    doc.setLineWidth(0.25);
    doc.line(left, 22, right, 22);
  };
  heading();
  autoTable(doc, {
    startY: 25,
    body: [["Mitarbeiter", settings.employee || ""]],
    theme: "plain",
    styles: { fontSize: 9, textColor: ink, cellPadding: 1, overflow: "linebreak" },
    columnStyles: { 0: { cellWidth: 25, textColor: muted } },
    margin: { left, right: left },
  });
  const tableStart = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 32) + 4;

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
    head: [["Tag", "Beginn", "Ende", "Pause (Min.)", "Stunden", "Tour / Bemerkung"]],
    body,
    startY: tableStart,
    styles: { fontSize: 8.5, cellPadding: 1, textColor: ink, lineColor: rule, lineWidth: 0.1, overflow: "linebreak" },
    headStyles: { fillColor: 235, textColor: ink, fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 18, halign: "center" },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 23, halign: "right" },
      4: { cellWidth: 19, halign: "right" },
      5: { cellWidth: "auto" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && isWeekend(entries[data.row.index]?.date ?? "")) {
        data.cell.styles.fillColor = paperTint;
      }
    },
    theme: "grid",
    rowPageBreak: "avoid",
    margin: { left, right: left, top: 28, bottom: 18 },
    willDrawPage: () => { if (doc.getNumberOfPages() > 1) heading(); },
  });

  let y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60) + 5;
  // Keep the full calculation together instead of splitting totals between pages.
  if (y > 228) {
    doc.addPage();
    heading();
    y = 30;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Stundenübersicht", left, y);
  const pauseMinutes = entries.reduce((sum, entry) => sum + (entry.breakMinutes || 0), 0);
  autoTable(doc, {
    startY: y + 3,
    body: [
      ["Arbeitsstunden gesamt", "Basis-Stunden", "Überstunden", "Pausen gesamt (manuell)"],
      [`${formatHours(totals.totalHours)} Std.${carryOverHours ? ` (inkl. ${formatHours(carryOverHours)} Übertrag)` : ""}`, `${formatHours(totals.baseHours)} Std.`, `${formatHours(totals.overtimeHours)} Std.`, `${pauseMinutes} Min.`],
    ],
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 1, textColor: muted },
    didParseCell: (data) => {
      if (data.row.index === 1) {
        data.cell.styles.fontSize = 11;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = ink;
      }
    },
    margin: { left, right: left },
    tableWidth: right - left,
  });
  const calculationY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 18) + 5;
  doc.setTextColor(ink);
  doc.setFontSize(10);
  doc.text("Vergütungsberechnung", left, calculationY);

  autoTable(doc, {
    startY: calculationY + 3,
    head: [["Vergütung", "Stunden", "Satz / Std.", "Betrag"]],
    body: [
      [`Basis (bis ${formatHours(settings.capHours)} Std.)`, formatHours(totals.baseHours), formatEuro(settings.baseRate), formatEuro(totals.basePay)],
      ["Überstunden", formatHours(totals.overtimeHours), formatEuro(settings.overtimeRate), formatEuro(totals.overtimePay)],
    ],
    styles: { fontSize: 9, cellPadding: 1.2, textColor: ink },
    headStyles: { textColor: muted, fontSize: 8, fontStyle: "normal" },
    columnStyles: { 0: { cellWidth: 83 }, 1: { cellWidth: 27, halign: "right" }, 2: { cellWidth: 34, halign: "right" }, 3: { halign: "right", fontStyle: "bold" } },
    theme: "plain",
    margin: { left, right: left },
  });
  const payY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? calculationY + 25) + 3;
  doc.setDrawColor(ink);
  doc.line(left, payY, right, payY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Auszahlung gesamt", left, payY + 7);
  doc.setFontSize(15);
  doc.text(formatEuro(totals.totalPay), right, payY + 7, { align: "right" });
  // Unterschriftszeilen für den ausgedruckten Monatszettel.
  let signY = payY + 22;
  if (signY > 272) { doc.addPage(); heading(); signY = 50; }
  doc.setDrawColor(ink);
  doc.setLineWidth(0.2);
  doc.line(left, signY, left + 75, signY);
  doc.line(right - 75, signY, right, signY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(muted);
  doc.text("Datum, Unterschrift Mitarbeiter", left, signY + 4);
  doc.text("Datum, Unterschrift Vorgesetzter", right - 75, signY + 4);
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(rule);
    doc.line(left, 282, right, 282);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(muted);
    doc.text(month, left, 287);
    doc.text(`Seite ${page} von ${pages}`, right, 287, { align: "right" });
  }
  doc.save(`Stundenzettel_${settings.month}.pdf`);
}
