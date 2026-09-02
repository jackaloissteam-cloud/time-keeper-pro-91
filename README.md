# Stundenzettel-Web-App

Eine browserbasierte Monatsvorlage zum Erfassen von Arbeitszeiten, Pausen und Bemerkungen. Die App berechnet automatisch die Gesamtstunden, wendet eine gestaffelte Vergütung an und bietet Exporte für Excel und PDF.

---

## Funktionen

- **Kalenderbasierte Eingabe:** Für jeden Monat werden die Tage 1 bis 30/31 vorgegeben, inklusive Wochentagsanzeige.
- **Automatische Stundenberechnung:** Beginn, Ende und Pause werden pro Tag in Dezimalstunden umgerechnet.
- **Gestaffelte Vergütung:** Stunden bis zur Kappungsgrenze werden mit dem Basis-Satz vergütet, darüber liegende Stunden mit dem Überstunden-Satz.
- **Mehrere Monate speichern:** Erfasste Daten werden im Browser (`localStorage`) pro Monat gespeichert und können über ein Dropdown-Menü umgeschaltet werden.
- **Excel-Export:** Download der aktuellen Monatsvorlage als `.xlsx`.
- **PDF-Export:** Druckfertiges PDF im A4-Hochformat mit allen Tagen und der Abrechnung.
- **Druckansicht:** Die Monatsübersicht passt auf eine DIN-A4-Seite.
- **Mitarbeiterfeld optional:** Das Feld "Mitarbeiter" bleibt standardmäßig leer und wird nicht vorausgefüllt.

---

## Technischer Stack

- **Framework:** [TanStack Start](https://tanstack.com/start) mit React 19 und Vite 8
- **Sprache:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **UI-Komponenten:** shadcn/ui (Radix UI)
- **State & Data Fetching:** TanStack Query
- **Build-Ziel:** Edge/Cloudflare Worker (TanStack Start Vite-Template)

---

## Voraussetzungen

- [Node.js](https://nodejs.org/) **22+** oder [Bun](https://bun.sh/) 1.2+
- Ein Terminal mit Git

> Dieses Projekt verwendet TanStack Start. Im Entwicklungsmodus läuft ein Vite-Dev-Server; für Produktion wird ein Worker-Build erzeugt.

---

## Schritt-für-Schritt: Lokales Setup

### 1. Repository klonen

```bash
git clone <REPO-URL>
cd tanstack_start_ts
```

### 2. Abhängigkeiten installieren

Mit **Bun** (empfohlen, da das Projekt `bun`-basiert ist):

```bash
bun install
```

Oder mit **npm**:

```bash
npm install
```

### 3. Entwicklungsserver starten

```bash
bun dev
```

bzw.

```bash
npm run dev
```

Die App ist dann unter folgender URL erreichbar:

```
http://localhost:8080
```

Der Server startet üblicherweise auf Port `8080`. Falls der Port belegt ist, schlägt Vite einen alternativen Port vor.

### 4. Produktions-Build erstellen

```bash
bun run build
```

bzw.

```bash
npm run build
```

Der Build landet im Verzeichnis `dist/`.

### 5. Produktions-Build lokal testen

```bash
bun run preview
```

bzw.

```bash
npm run preview
```

Auch hier ist die App unter `http://localhost:8080` erreichbar.

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

Die Vergütung erfolgt auf Basis eines gestaffelten Stundensatzes mit einer Kappungsgrenze:

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

---

## Projektstruktur (Auszug)

```text
src/
├── lib/timesheet.ts      # Berechnungslogik, Speicherung, Excel-/PDF-Export
├── routes/
│   ├── __root.tsx        # Root-Layout
│   ├── index.tsx         # Hauptseite mit der Monatsvorlage
│   └── api/              # Server-Routen (TanStack Start)
├── styles.css            # Tailwind-Designsystem
└── ...
```

---

## Hinweise

- **Kein Backend nötig:** Alle Daten werden lokal im Browser gespeichert. Für einen geteilten Zugang kann die App veröffentlicht werden.
- **Keine persönlichen Daten vorausgefüllt:** Weder Firmenname noch Mitarbeitername sind in der Vorlage enthalten.
- **Drucken:** Über den PDF-Button oder die Browser-Druckfunktion (`Strg + P` / `Cmd + P`) kann die Monatsübersicht ausgedruckt werden.
