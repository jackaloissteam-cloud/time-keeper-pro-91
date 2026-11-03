# Stundenzettel-Web-App (Time Keeper Pro)

Eine browserbasierte Monatsvorlage zum Erfassen von Arbeitszeiten, Pausen und Bemerkungen. Die App rechnet automatisch die Gesamtstunden aus, wendet eine gestaffelte Vergütung an (43-Stunden-Regel) und bietet Exporte nach Excel und PDF. **Jeder Nutzer arbeitet mit einem eigenen, gerätelokalen Stundenzettel** – Daten werden nicht zwischen Kollegen geteilt oder gemischt.

**Live-App:** <https://time-keeper-pro-91.lovable.app>

---

## Funktionen

### Zeiterfassung
- **Kalenderbasierte Eingabe:** Für jeden Monat werden die Tage 1 bis 30/31 vorgegeben, inklusive Wochentagsanzeige und Wochenend-Hervorhebung.
- **Automatische Stundenberechnung:** Beginn, Ende und Pause werden pro Tag in Dezimalstunden umgerechnet; Nacht- und Schichten über Mitternacht werden korrekt verrechnet.
- **Mobil optimierte Zeiteingabe:** Auf dem Handy genügt ein einziges Bereichsfeld pro Tag – z. B. `9-15`, `9-15`, `7:30-15` oder die reine Zifferneingabe `915` (09:00–15:00) mit separatem Trennzeichen-Button (–). Das Feld ist rein numerisch, Autokorrektur ist deaktiviert, iOS zoomt nicht.
- **Pausen und Bemerkungen:** Pro Tag erfassbar, inklusive Reset-Button, mit dem sich eine fehlerhafte Eingabe einzelner Tage vollständig löschen lässt.
- **Mitarbeiterfeld optional:** Das Feld „Mitarbeiter" bleibt standardmäßig leer und wird nicht vorausgefüllt. Keine Firmen- oder persönlichen Daten in der Vorlage.

### Speichern, Monate, Suche
- **Mehrere Monate speichern:** Erfasste Daten werden im Browser (`localStorage`) pro Monat gespeichert und über ein Dropdown-Menü umgeschaltet. Beim Monatswechsel werden laufende Eingaben gesichert.
- **Suchfunktion nach früheren Stundenzetteln:** Suche nach Monat, Jahr, Mitarbeiter oder Bemerkung – umlauttolerant (`maerz` findet „März", `buro` findet „Büro"), auf iOS, Android und Windows (Desktop-Shortcut `Strg/⌘ + K`). Jeder Suchtreffer zeigt Monat, Jahr und Speicherort („dieser Browser auf diesem Gerät").
- **Suchverlauf:** Persistent, dedupliziert; einzelne Einträge lassen sich löschen oder der gesamte Verlauf leeren.
- **Sicherung & Wiederherstellung:** Export des gesamten Lokalbestands als JSON-Datei und Import auf einem neuen Gerät. Der Import füllt **nur fehlende oder leere Monate** auf und überschreibt niemals vorhandene Einträge; Suchverlauf und Sätze bleiben unberührt. Dateien bis 10 MB werden vollständig validiert (Struktur, Datumswerte, Zeiten, Pausen) – eine fehlerhafte Datei wird komplett abgelehnt.

### Export & Druck
- **Excel-Export:** Download der aktuellen Monatsvorlage als `.xlsx` mit allen Tagen, Summen, Stundenaufteilung und Vergütung.
- **PDF-Export:** Druckfertiges, übersichtliches A4-PDF mit Arbeitszeiten, Pausen, Stundenübersicht, Stundenaufteilung und Vergütungsberechnung – auch für einen über die Suche ausgewählten Monat.
- **Druckansicht:** Die Monatsübersicht passt auf eine DIN-A4-Seite (Hochformat).

---

## Technischer Stack

- **Framework:** [TanStack Start](https://tanstack.com/start) v1 mit React 19 und Vite 8
- **Sprache:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **UI-Komponenten:** shadcn/ui (Radix UI)
- **State & Data Fetching:** TanStack Query
- **Exporte:** [xlsx](https://www.npmjs.com/package/xlsx) (Excel), [jsPDF](https://www.npmjs.com/package/jspdf) + jspdf-autotable (PDF)
- **Tests:** Node-Testrunner (`node:test`) über `bun test` bzw. `node --test`
- **Build-Ziel:** Edge/Cloudflare Worker (TanStack Start Vite-Template)

---

## Voraussetzungen

- [Node.js](https://nodejs.org/) **22+** oder [Bun](https://bun.sh/) 1.2+
- Ein Terminal mit Git

## Schritt-für-Schritt: Lokales Setup

### 1. Repository klonen

```bash
git clone <REPO-URL>
cd tanstack_start_ts
```

### 2. Abhängigkeiten installieren

Mit **Bun** (empfohlen):

```bash
bun install
```

oder mit **npm**:

```bash
npm install
```

### 3. Entwicklungsserver starten

```bash
bun dev        # bzw. npm run dev
```

Die App läuft danach unter <http://localhost:8080>. Ist der Port belegt, schlägt Vite automatisch einen freien Port vor.

### 4. Tests ausführen

```bash
bun test src/lib        # bzw. npx node --test src/lib/*.test.ts
```

Getestet werden die Suchlogik (Umlaute, Verlauf, Treffer) und die Backup-Validierung (Struktur, Monate, fehlende Monate werden ergänzt, befüllte nie überschrieben).

### 5. Produktions-Build erstellen und testen

```bash
bun run build           # bzw. npm run build
bun run preview         # bzw. npm run preview
```

Der Build landet in `dist/`; der Preview-Server ist ebenfalls unter <http://localhost:8080> erreichbar.

---

## Verfügbare Scripts

| Script | Befehl | Beschreibung |
| :--- | :--- | :--- |
| `dev` | `bun dev` | Startet den Vite-Dev-Server mit HMR |
| `build` | `bun run build` | Erstellt einen optimierten Produktions-Build |
| `build:dev` | `bun run build:dev` | Erstellt einen Entwicklungs-Build |
| `preview` | `bun run preview` | Serviert den `dist/`-Build lokal |
| `lint` | `bun run lint` | Führt ESLint über das gesamte Projekt aus |
| `format` | `bun run format` | Formatiert das Projekt mit Prettier |

---

## Berechnungslogik

Die Vergütung erfolgt auf Basis eines gestaffelten Stundensatzes mit einer Kappungsgrenze von **43 Stunden**:

| Kategorie | Regelung | Stundensatz |
| :--- | :--- | :---: |
| **Basis-Arbeitszeit** | Bis maximal **43,00 Stunden** | **13,90 € / Std.** |
| **Überstunden** | Alle Stunden oberhalb von 43,00 Stunden | **12,00 € / Std.** |

### Formeln

- **Arbeitszeit pro Tag (Std):** `(Ende − Beginn) × 24 − Pause / 60`
- **Gesamtstunden:** Summe aller Tagesstunden
- **Basis-Stunden:** `MIN(Gesamtstunden; 43)`
- **Überstunden:** `MAX(0; Gesamtstunden − 43)`
- **Summe Basis (€):** `Basis-Stunden × 13,90`
- **Summe Überstunden (€):** `Überstunden × 12,00`
- **Gesamtsumme (€):** `Summe Basis + Summe Überstunden`

Die Logik liegt ausschließlich in `src/lib/timesheet.ts` und ist damit von der Oberfläche getrennt testbar.

---

## Datenspeicherung & Privatsphäre

- **Gerätelokal:** Alle Daten (Monate, Eingaben, Mitarbeiterfeld, Suchverlauf) liegen ausschließlich im `localStorage` des jeweiligen Browsers. Es gibt **keine** Server-Speicherung, keine Synchronisation zwischen Geräten und keine Sichtbarkeit von Daten unter Kollegen.
- **Verteilbar:** Jede Kollegin/jeder Kollege ruft dieselbe URL auf und erhält einen privaten, eigenen Stundenzettel.
- **Keine Vorgaben:** Weder Firmenname noch Mitarbeitername sind vorausgefüllt.
- **Backup-Dateien enthalten Monate, aber keinen Suchverlauf** und ändern keine Sätze.

---

## Projektstruktur (Auszug)

```text
src/
├── lib/
│   ├── timesheet.ts          # Berechnungslogik, Speicherung, Excel-/PDF-Export
│   ├── timesheet-search.ts   # Suche & Suchverlauf (browser-safe, separat testbar)
│   ├── timesheet-search.test.ts
│   ├── timesheet-backup.ts   # JSON-Backup-Export/Import mit Validierung
│   └── timesheet-backup.test.ts
├── routes/
│   ├── __root.tsx            # Root-Layout
│   ├── index.tsx             # Hauptseite mit der Monatsvorlage
│   └── README.md
├── styles.css                # Tailwind-Designsystem
└── start.ts                  # Server-Startkonfiguration
```

---

## Hinweise

- **Kein Backend nötig:** Die App läuft ohne Datenbank oder Login.
- **Drucken:** Über den PDF-Button oder die Browser-Druckfunktion (`Strg + P` / `Cmd + P`).
- **Mobil:** Optimiert für Android, iOS und Windows 11 (Desktop und Touch).
