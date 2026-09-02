import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Printer, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type Entry,
  type Settings,
  buildMonthEntries,
  calcTotals,
  dayLabel,
  defaultSettings,
  entryHours,
  formatEuro,
  formatHours,
  formatMonth,
  isWeekend,
  toCsv,
  downloadXlsx,
} from "@/lib/timesheet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stundenzettel-Rechner mit 43-Stunden-Regel" },
      {
        name: "description",
        content:
          "Monatlicher Stundenzettel: Zeiten eintragen, Summen, 43-Stunden-Abgleich und Auszahlung werden automatisch berechnet.",
      },
      { property: "og:title", content: "Stundenzettel-Rechner mit 43-Stunden-Regel" },
      {
        property: "og:description",
        content:
          "Zeiten eintragen, Überstunden ab 43 Stunden automatisch berechnen und als CSV oder PDF sichern.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Timesheet,
});

const STORAGE_KEY = "vpt-stundenzettel-v1";

type Store = { settings: Settings; months: Record<string, Entry[]> };

function hasData(entries: Entry[] = []) {
  return entries.some((e) => e.start || e.end || e.note || e.breakMinutes);
}

function Timesheet() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [months, setMonths] = useState<Record<string, Entry[]>>({});
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let next = defaultSettings;
    let storedMonths: Record<string, Entry[]> = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Store> & { entries?: Entry[] };
        next = { ...defaultSettings, ...parsed.settings };
        storedMonths = parsed.months ?? {};
        // Migration älterer Speicherstände (nur ein Monat)
        if (!parsed.months && parsed.entries) storedMonths[next.month] = parsed.entries;
      }
    } catch {
      /* ignore */
    }
    setSettings(next);
    setMonths(storedMonths);
    setEntries(buildMonthEntries(next.month, storedMonths[next.month] ?? []));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const nextMonths = { ...months, [settings.month]: entries };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ settings, months: nextMonths } satisfies Store),
    );
  }, [settings, entries, months, loaded]);

  const savedMonths = useMemo(() => {
    const keys = new Set(
      Object.entries(months)
        .filter(([, v]) => hasData(v))
        .map(([k]) => k),
    );
    if (hasData(entries)) keys.add(settings.month);
    return Array.from(keys).sort().reverse();
  }, [months, entries, settings.month]);

  const setMonth = (month: string) => {
    if (!month || month === settings.month) return;
    setMonths((prev) => ({ ...prev, [settings.month]: entries }));
    setSettings((prev) => ({ ...prev, month }));
    setEntries(buildMonthEntries(month, months[month] ?? []));
  };

  const totals = useMemo(() => calcTotals(entries, settings), [entries, settings]);
  const overCap = totals.totalHours > settings.capHours;

  const update = (id: string, patch: Partial<Entry>) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const resetMonth = () => {
    if (!confirm("Alle Einträge dieses Monats löschen?")) return;
    setEntries(buildMonthEntries(settings.month));
  };

  const exportCsv = () => {
    const blob = new Blob(["\uFEFF" + toCsv(entries, settings, totals)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Stundenzettel_${settings.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="print-sheet mx-auto max-w-6xl px-4 py-8 md:py-12">

      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Stundenzettel
          </p>
          <h1 className="mt-2 text-3xl font-bold text-foreground md:text-4xl">
            {formatMonth(settings.month)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bis {formatHours(settings.capHours)} Std. zu {formatEuro(settings.baseRate)}/Std., jede
            weitere Stunde zu {formatEuro(settings.overtimeRate)}/Std.
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadXlsx(entries, settings, totals)}
          >
            <FileSpreadsheet /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadPdf(entries, settings, totals)}
          >
            <FileText /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer /> Drucken
          </Button>

          <Button variant="ghost" size="sm" onClick={resetMonth}>
            <RotateCcw /> Monat leeren
          </Button>
        </div>
      </header>

      <section className="print-compact mt-6 grid gap-4 rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-raise)] sm:grid-cols-2 lg:grid-cols-6">
        <Field label="Mitarbeiter (optional)">
          <Input
            value={settings.employee}
            onChange={(e) => setSettings({ ...settings, employee: e.target.value })}
          />
        </Field>
        <Field label="Monat">
          <Input
            type="month"
            value={settings.month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </Field>
        <Field label="Gespeicherte Monate">
          <select
            value={savedMonths.includes(settings.month) ? settings.month : ""}
            onChange={(e) => setMonth(e.target.value)}
            className="no-print h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none"
          >
            <option value="" disabled>
              {savedMonths.length ? "Monat wählen" : "Noch keine Daten"}
            </option>
            {savedMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonth(m)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Basis-Satz (€/Std.)">
          <Input
            type="number"
            step="0.01"
            value={settings.baseRate}
            onChange={(e) => setSettings({ ...settings, baseRate: Number(e.target.value) })}
          />
        </Field>
        <Field label="Überstunden-Satz (€/Std.)">
          <Input
            type="number"
            step="0.01"
            value={settings.overtimeRate}
            onChange={(e) => setSettings({ ...settings, overtimeRate: Number(e.target.value) })}
          />
        </Field>
        <Field label="Kappungsgrenze (Std.)">
          <Input
            type="number"
            step="0.25"
            value={settings.capHours}
            onChange={(e) => setSettings({ ...settings, capHours: Number(e.target.value) })}
          />
        </Field>
      </section>

      <section className="mt-6 overflow-x-auto rounded-lg border border-border bg-card shadow-[var(--shadow-sheet)]">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              {["Tag", "Beginn", "Ende", "Pause (Min)", "Arbeitszeit", "Tour / Bemerkung"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ),
              )}
              <th className="no-print w-10 px-2 py-2.5" aria-label="Zeile leeren" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const hours = entryHours(entry);
              const weekend = isWeekend(entry.date);
              const filled = Boolean(entry.start || entry.end || entry.note || entry.breakMinutes);
              return (
                <tr
                  key={entry.id}
                  className={`border-t border-border ${weekend ? "bg-muted/70" : "even:bg-muted/40"}`}
                >
                  <td className="tabular whitespace-nowrap px-3 py-1.5 font-medium">
                    {dayLabel(entry.date)}
                  </td>
                  <td className="px-2 py-1.5">
                    <CellInput
                      type="time"
                      value={entry.start}
                      onChange={(v) => update(entry.id, { start: v })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <CellInput
                      type="time"
                      value={entry.end}
                      onChange={(v) => update(entry.id, { end: v })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <CellInput
                      type="number"
                      value={entry.breakMinutes ? String(entry.breakMinutes) : ""}
                      placeholder="0"
                      onChange={(v) => update(entry.id, { breakMinutes: Number(v) || 0 })}
                    />
                  </td>
                  <td className="tabular px-3 py-1.5 text-right font-medium">
                    {hours === null ? "–" : formatHours(hours)}
                  </td>
                  <td className="px-2 py-1.5">
                    <CellInput
                      value={entry.note}
                      onChange={(v) => update(entry.id, { note: v })}
                      placeholder="z. B. HU FED RADEV HU"
                    />
                  </td>
                  <td className="no-print px-1 py-1.5 text-center">
                    <button
                      type="button"
                      disabled={!filled}
                      onClick={() =>
                        update(entry.id, { start: "", end: "", breakMinutes: 0, note: "" })
                      }
                      title={`Eintrag ${dayLabel(entry.date)} löschen`}
                      aria-label={`Eintrag ${dayLabel(entry.date)} löschen`}
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-primary/30 bg-secondary">
              <td colSpan={4} className="px-3 py-3 text-right text-sm font-semibold">
                Gesamtstunden
              </td>
              <td className="tabular px-3 py-3 text-right text-base font-bold">
                {formatHours(totals.totalHours)}
              </td>
              <td colSpan={2} className="px-3 py-3 text-sm">
                {overCap ? (
                  <span className="font-medium text-warning-foreground">
                    {formatHours(totals.overtimeHours)} Std. über der Grenze
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Noch {formatHours(totals.remainingToCap)} Std. bis zur Grenze
                  </span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>


      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <SummaryCard
          label={`Basis-Stunden (bis ${formatHours(settings.capHours)})`}
          hours={totals.baseHours}
          amount={totals.basePay}
        />
        <SummaryCard
          label="Überstunden"
          hours={totals.overtimeHours}
          amount={totals.overtimePay}
          accent={overCap}
        />
        <div className="rounded-lg border-2 border-primary bg-primary p-5 text-primary-foreground shadow-[var(--shadow-sheet)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">
            Gesamtsumme
          </p>
          <p className="tabular mt-3 text-3xl font-bold">{formatEuro(totals.totalPay)}</p>
          <p className="mt-2 text-sm opacity-80">
            {formatHours(totals.totalHours)} Std. gesamt
          </p>
        </div>
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        Eingaben werden automatisch in diesem Browser gespeichert. Schichten über Mitternacht (z. B.
        22:00 – 05:00) werden korrekt berechnet.
      </p>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function CellInput({
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <Input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 border-transparent bg-transparent px-2 shadow-none focus-visible:border-input focus-visible:bg-background"
    />
  );
}

function SummaryCard({
  label,
  hours,
  amount,
  accent,
}: {
  label: string;
  hours: number;
  amount: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border bg-card p-5 shadow-[var(--shadow-raise)] ${
        accent ? "border-accent" : "border-border"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="tabular mt-3 text-2xl font-bold text-foreground">{formatEuro(amount)}</p>
      <p className="tabular mt-1 text-sm text-muted-foreground">{formatHours(hours)} Std.</p>
    </div>
  );
}
