import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Laptop, Printer, RotateCcw, Search, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addSearchToHistory, removeSearchFromHistory, textMatches } from "@/lib/timesheet-search";
import { parseBackup, restoreMissingMonths, type MonthMap } from "@/lib/timesheet-backup";
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
  hasTimeSeparator,
  isCompleteTimeRange,
  isWeekend,
  formatTimeRange,
  parseTimeRange,
  toCsv,
  downloadXlsx,
  downloadPdf,
} from "@/lib/timesheet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stundenzettel-Rechner mit 43-Stunden-Regel" },
      {
        name: "description",
        content:
          "Persönlicher monatlicher Stundenzettel: Zeiten eintragen, Summen, 43-Stunden-Abgleich und Auszahlung werden automatisch berechnet – Daten bleiben nur auf dem eigenen Gerät.",
      },
      { property: "og:title", content: "Stundenzettel-Rechner mit 43-Stunden-Regel" },
      {
        property: "og:description",
        content:
          "Zeiten eintragen, Überstunden ab 43 Stunden automatisch berechnen und als Excel oder PDF sichern – lokal auf dem eigenen Gerät.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Timesheet,
});

const STORAGE_KEY = "vpt-stundenzettel-v2";
const SEARCH_HISTORY_KEY = "vpt-stundenzettel-search-history";

type Stored = { settings: Partial<Settings>; months: MonthMap };

function hasData(entries: Entry[] = []) {
  return entries.some((e) => e.start || e.end || e.note || e.breakMinutes);
}

function Timesheet() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [months, setMonths] = useState<MonthMap>({});
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const [backupMessage, setBackupMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const historyTimer = useRef<number | null>(null);

  // Windows/Desktop: Strg+K oder „/“ springt in die Suche, Escape leert sie
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") {
        ev.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (ev.key === "/" && !typing) {
        ev.preventDefault();
        searchRef.current?.focus();
      } else if (ev.key === "Escape" && target === searchRef.current) {
        setSearch("");
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Nur lokal laden – keine Daten verlassen dieses Gerät
  useEffect(() => {
    try {
      const history: unknown = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) ?? "[]");
      if (Array.isArray(history)) setSearchHistory(history.filter((term): term is string => typeof term === "string"));
    } catch { /* Beschädigter Suchverlauf beeinflusst keine Monatsdaten. */ }
    let stored: Stored | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) stored = JSON.parse(raw) as Stored;
    } catch {
      stored = null;
    }
    const next: Settings = { ...defaultSettings, ...(stored?.settings ?? {}) };
    next.month = defaultSettings.month;
    const map = stored?.months ?? {};
    next.employee = map[next.month]?.employee ?? next.employee ?? "";
    setSettings(next);
    setMonths(map);
    setEntries(buildMonthEntries(next.month, map[next.month]?.entries ?? []));
    setLoaded(true);
  }, []);

  const rememberSearch = (query: string) => {
    setSearchHistory((previous) => addSearchToHistory(previous, query));
  };

  useEffect(() => {
    if (!loaded || !search.trim()) return;
    historyTimer.current = window.setTimeout(() => rememberSearch(search), 800);
    return () => { if (historyTimer.current !== null) window.clearTimeout(historyTimer.current); };
  }, [search, loaded]);

  const deleteHistory = (term?: string) => {
    if (historyTimer.current !== null) window.clearTimeout(historyTimer.current);
    if (term === undefined || term === search.trim()) setSearch("");
    setSearchHistory((previous) => term === undefined ? [] : removeSearchFromHistory(previous, term));
  };

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory)); }
    catch { /* Lokaler Speicher ist möglicherweise gesperrt. */ }
  }, [searchHistory, loaded]);

  // Lokal speichern
  useEffect(() => {
    if (!loaded) return;
    const all: MonthMap = {
      ...months,
      [settings.month]: { month: settings.month, employee: settings.employee, entries },
    };
    const payload: Stored = {
      settings: {
        employee: settings.employee,
        baseRate: settings.baseRate,
        overtimeRate: settings.overtimeRate,
        capHours: settings.capHours,
      },
      months: all,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* Speicher voll oder gesperrt */
    }
  }, [settings, entries, months, loaded]);

  const changeSettings = (patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const savedMonths = useMemo(() => {
    const keys = new Set(
      Object.values(months)
        .filter((m) => hasData(m.entries) || m.employee)
        .map((m) => m.month),
    );
    if (hasData(entries) || settings.employee) keys.add(settings.month);
    return Array.from(keys).sort().reverse();
  }, [months, entries, settings.month, settings.employee]);

  // Suche über alle gespeicherten Monate: Monatsname, Jahr, Mitarbeiter oder Bemerkung
  // (umlaut-tolerant, damit sie auf jeder Tastatur funktioniert)
  const searchResults = useMemo(() => {
    const q = search.trim();
    if (!q) return [];
    const all: MonthMap = {
      ...months,
      [settings.month]: { month: settings.month, employee: settings.employee, entries },
    };
    return Object.values(all)
      .filter((m) => hasData(m.entries) || m.employee)
      .filter((m) => {
        const haystack = [
          formatMonth(m.month),
          m.month,
          m.employee,
          ...m.entries.map((e) => e.note),
        ].join(" ");
        return textMatches(haystack, q);
      })
      .map((m) => ({
        month: m.month,
        employee: m.employee,
        hours: calcTotals(m.entries, settings).totalHours,
        matchingNotes: m.entries
          .filter((e) => textMatches(e.note, q))
          .map((e) => `${dayLabel(e.date)}: ${e.note}`),
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [search, months, entries, settings]);

  const setMonth = (month: string) => {
    if (!month || month === settings.month) return;
    setMonths((prev) => ({
      ...prev,
      [settings.month]: { month: settings.month, employee: settings.employee, entries },
    }));
    setSettings((prev) => ({ ...prev, month, employee: months[month]?.employee ?? "" }));
    setEntries(buildMonthEntries(month, months[month]?.entries ?? []));
  };

  const totals = useMemo(() => calcTotals(entries, settings), [entries, settings]);
  const overCap = totals.totalHours > settings.capHours;

  const update = (id: string, patch: Partial<Entry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const resetMonth = () => {
    if (!confirm("Alle Einträge dieses Monats löschen?")) return;
    setEntries(buildMonthEntries(settings.month));
  };

  const exportCsv = () => {
    const blob = new Blob(["﻿" + toCsv(entries, settings, totals)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Stundenzettel_${settings.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportBackup = () => {
    const all: MonthMap = { ...months, [settings.month]: { month: settings.month, employee: settings.employee, entries } };
    const saved = Object.fromEntries(Object.entries(all).filter(([, row]) => hasData(row.entries) || row.employee));
    if (!Object.keys(saved).length) { setBackupMessage("Keine ausgefüllten Stundenzettel zum Sichern vorhanden."); return; }
    const blob = new Blob([JSON.stringify({ format: "stundenzettel-backup", version: 1, months: saved }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Stundenzettel_Sicherung_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackupMessage(`${Object.keys(saved).length} Monate als Sicherungsdatei heruntergeladen.`);
  };

  const importBackup = async (file: File) => {
    setImporting(true);
    setBackupMessage("");
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Die Sicherungsdatei ist zu groß (maximal 10 MB).");
      const incoming = parseBackup(await file.text());
      const all: MonthMap = { ...months, [settings.month]: { month: settings.month, employee: settings.employee, entries } };
      const restored = restoreMissingMonths(all, incoming);
      // Write successfully before changing UI state: full/blocked storage must not claim a successful restore.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, months: restored.months }));
      setMonths(restored.months);
      const current = restored.months[settings.month];
      if (current) {
        setEntries(buildMonthEntries(settings.month, current.entries));
        setSettings((previous) => ({ ...previous, employee: current.employee }));
      }
      setBackupMessage(`${restored.imported} Monate wiederhergestellt. ${restored.skipped} bereits vorhandene Monate unverändert behalten.`);
    } catch (error) {
      setBackupMessage(error instanceof Error && error.name === "QuotaExceededError" ? "Der Browserspeicher ist voll. Es wurde nichts importiert." : error instanceof SyntaxError ? "Keine gültige JSON-Sicherungsdatei. Es wurde nichts importiert." : error instanceof Error ? error.message : "Die Sicherung konnte nicht importiert werden.");
    } finally { setImporting(false); }
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
          <p className="no-print mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Laptop className="size-3.5" />
            Nur auf diesem Gerät gespeichert – keine Daten werden geteilt.
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
            onChange={(e) => changeSettings({ employee: e.target.value })}
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
            onChange={(e) => changeSettings({ baseRate: Number(e.target.value) })}
          />
        </Field>
        <Field label="Überstunden-Satz (€/Std.)">
          <Input
            type="number"
            step="0.01"
            value={settings.overtimeRate}
            onChange={(e) => changeSettings({ overtimeRate: Number(e.target.value) })}
          />
        </Field>
        <Field label="Kappungsgrenze (Std.)">
          <Input
            type="number"
            step="0.25"
            value={settings.capHours}
            onChange={(e) => changeSettings({ capHours: Number(e.target.value) })}
          />
        </Field>
      </section>

      <section aria-label="Stundenzettelsuche" className="no-print mt-4 border-b border-border py-4">
        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Stundenzettel suchen
        </Label>
        <form className="mt-1.5 flex gap-2" onSubmit={(event) => { event.preventDefault(); rememberSearch(search); }}>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onInput={(e) => setSearch(e.currentTarget.value)}
            onBlur={() => rememberSearch(search)}
            placeholder="Monat, Jahr, Mitarbeiter oder Bemerkung, z. B. „September“ oder „HU FED“"
            aria-label="Gespeicherte Stundenzettel durchsuchen"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            className="pl-9 pr-9 text-base md:text-sm [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setSearch("");
                searchRef.current?.focus();
              }}
              aria-label="Suche löschen"
              className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        <Button type="submit" variant="outline" aria-label="Suche ausführen"><Search className="size-4" /></Button>
        </form>
        <p className="mt-2 text-sm text-muted-foreground">
          Suchort: gespeicherte Stundenzettel in diesem Browser auf diesem Gerät. Keine Suche auf anderen Geräten oder in Dateien.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {savedMonths.length ? `${savedMonths.length} gespeicherte Monate: ${savedMonths.map(formatMonth).join(" · ")}` : "In diesem Browser sind noch keine ausgefüllten Stundenzettel gespeichert."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Suchverlauf</span>
          {searchHistory.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => deleteHistory()} aria-label="Gesamten Suchverlauf leeren"><X className="size-4" /> Verlauf leeren</Button>}
        </div>
        {searchHistory.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">Noch keine Suchanfragen.</p> : (
          <ul className="mt-1 flex flex-wrap gap-2" aria-label="Bisherige Suchanfragen">
            {searchHistory.map((term) => <li key={term} className="flex max-w-full items-center gap-1"><Button type="button" variant="outline" size="sm" className="h-auto min-h-9 whitespace-normal break-words" onClick={() => { setSearch(term); rememberSearch(term); }}>{term}</Button><Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => deleteHistory(term)} aria-label={`Suchanfrage „${term}“ löschen`} title={`Suchanfrage „${term}“ löschen`}><X className="size-4" /></Button></li>)}
          </ul>
        )}
        {search.trim() && (
          <div className="mt-3" role="status" aria-live="polite" aria-atomic="true">
          <p className="mb-2 text-sm font-medium">Suche nach „{search.trim()}“: {searchResults.length} Treffer in {savedMonths.length} gespeicherten Monaten.</p>
          <div className="divide-y divide-border rounded-md border border-border">
            {searchResults.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Kein gespeicherter Stundenzettel für „{search.trim()}“ in diesem Browser gefunden. Einträge aus einem anderen Browser, Gerät oder dem Live-Link sind hier nicht verfügbar.
              </p>
            ) : (
              searchResults.map((r) => (
                <Button
                  key={r.month}
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    rememberSearch(search);
                    setMonth(r.month);
                    setSearch("");
                  }}
                  className="flex h-auto w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 whitespace-normal px-3 py-2.5 text-left text-sm"
                >
                  <span className="font-medium">
                    {formatMonth(r.month)}
                    {r.employee ? ` – ${r.employee}` : ""}
                  </span>
                  <span className="tabular text-muted-foreground">
                    {formatHours(r.hours)} Std.
                  </span>
                  <span className="w-full text-xs font-normal text-muted-foreground">Speicherort: dieser Browser auf diesem Gerät</span>
                  {r.matchingNotes.length > 0 && (
                    <span className="w-full truncate text-xs text-muted-foreground">
                      {r.matchingNotes.slice(0, 2).join(" · ")}
                    </span>
                  )}
                </Button>
              ))
            )}
          </div>
          </div>
        )}
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-sm font-medium">Sicherung &amp; Wiederherstellung</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={!loaded || importing} onClick={exportBackup}><Download /> Sicherung speichern</Button>
            <Button type="button" variant="outline" size="sm" disabled={!loaded || importing} onClick={() => backupRef.current?.click()}><Upload /> {importing ? "Wiederherstellen …" : "Sicherung importieren"}</Button>
            <input ref={backupRef} type="file" accept=".json,application/json" className="hidden" aria-label="Stundenzettel-Sicherungsdatei" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void importBackup(file); }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">JSON-Sicherungsdatei · Vorhandene ausgefüllte Monate bleiben unverändert. PDF- und Excel-Dateien sind keine Sicherungsdateien.</p>
          {backupMessage && <p role="status" className="mt-2 text-sm">{backupMessage}</p>}
        </div>
      </section>

      {/* Kompakte Kartenansicht fürs Handy: ein Zeitfeld statt zwei */}
      <section className="mt-4 space-y-2 md:hidden">
        <p className="px-1 text-xs text-muted-foreground">
          Zeit eintippen wie 7-15 oder 7:30-15. Keine Bindestrich-Taste? Einfach das „–“ rechts
          antippen.
        </p>
        {entries.map((entry) => {
          const hours = entryHours(entry);
          const weekend = isWeekend(entry.date);
          const filled = Boolean(entry.start || entry.end || entry.note || entry.breakMinutes);
          return (
            <div
              key={entry.id}
              className={`rounded-lg border border-border p-3 shadow-[var(--shadow-raise)] ${
                weekend ? "bg-muted/70" : "bg-card"
              }`}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <span className="tabular text-sm font-semibold">{dayLabel(entry.date)}</span>
                <div className="flex items-center gap-2">
                  <span className="tabular text-sm font-medium">
                    {hours === null ? "–" : `${formatHours(hours)} Std.`}
                  </span>
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
                </div>
              </div>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <TimeRangeInput
                  entry={entry}
                  onCommit={(start, end) => update(entry.id, { start, end })}
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Pause
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={entry.breakMinutes ? String(entry.breakMinutes) : ""}
                    placeholder="0"
                    onChange={(e) =>
                      update(entry.id, { breakMinutes: Number(e.target.value) || 0 })
                    }
                    className="h-9 w-16 px-2 text-center"
                  />
                </label>
              </div>
              <Input
                value={entry.note}
                onChange={(e) => update(entry.id, { note: e.target.value })}
                placeholder="Tour / Bemerkung"
                className="mt-2 h-9"
              />
            </div>
          );
        })}
      </section>

      <section className="mt-6 hidden overflow-x-auto rounded-lg border border-border bg-card shadow-[var(--shadow-sheet)] md:block">
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
        Eingaben werden automatisch nur in diesem Browser gespeichert – nichts wird geteilt.
        Schichten über Mitternacht (z. B. 22:00 – 05:00) werden korrekt berechnet.
      </p>
    </main>
  );
}

/** Ein einziges Zeitfeld fürs Handy: „7-15“, „7:30-15:00“ usw. werden zu Beginn/Ende. */
function TimeRangeInput({
  entry,
  onCommit,
}: {
  entry: Entry;
  onCommit: (start: string, end: string) => void;
}) {
  const [draft, setDraft] = useState(() => formatTimeRange(entry));
  const ref = useRef<HTMLInputElement>(null);
  const separatorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDraft(formatTimeRange(entry));
  }, [entry.start, entry.end]);

  const commit = (value: string = draft) => {
    if (!value.trim()) {
      if (entry.start || entry.end) onCommit("", "");
      return;
    }
    const parsed = parseTimeRange(value);
    if (parsed) {
      onCommit(parsed.start, parsed.end);
    } else {
      setDraft(formatTimeRange(entry));
    }
  };

  // Handy-Tastaturen haben oft kein "-": dieses Feld fügt das Trennzeichen ein.
  const addSeparator = () => {
    const el = ref.current;
    const value = el?.value ?? draft;
    if (!value.trim() || hasTimeSeparator(value)) {
      el?.focus();
      return;
    }
    const at = el?.selectionStart ?? value.length;
    setDraft(`${value.slice(0, at)}-${value.slice(at)}`);
    requestAnimationFrame(() => {
      const node = ref.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(at + 1, at + 1);
    });
  };

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Input
        ref={ref}
        value={draft}
        inputMode="numeric"
        placeholder="Zeit, z. B. 7-15"
        aria-label={`Arbeitszeit ${dayLabel(entry.date)}`}
        onChange={(e) => {
          const value = e.target.value;
          setDraft(value);
          // Ist das Zeitpaar vollständig, Stunden sofort anzeigen.
          if (isCompleteTimeRange(value)) {
            const parsed = parseTimeRange(value);
            if (parsed) onCommit(parsed.start, parsed.end);
          }
        }}
        onBlur={(e) => {
          // Beim Antippen der Trennzeichen-Taste ist die Startzeit noch unvollständig.
          if (e.relatedTarget === separatorRef.current) return;
          commit(e.currentTarget.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="h-9 min-w-0"
      />
      <Button
        ref={separatorRef}
        type="button"
        variant="outline"
        size="icon"
        onPointerDown={(e) => e.preventDefault()}
        onClick={addSeparator}
        title="Trennzeichen einfügen"
        aria-label={`Trennzeichen für Arbeitszeit ${dayLabel(entry.date)} einfügen`}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-background text-lg font-semibold leading-none text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground"
      >
        –
      </Button>
    </div>
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
      onInput={(e) => onChange((e.target as HTMLInputElement).value)}
      onBlur={(e) => onChange(e.target.value)}
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
