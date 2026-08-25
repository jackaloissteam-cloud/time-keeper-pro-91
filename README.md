# VPT Stundenzettel – Dokumentation & Berechnungsschema

Diese Dokumentation beschreibt die Logik und Struktur zur Erstellung des Stundenzettels für **Werner Jedlicsek** (VPT GmbH) für den Monat **August 2026**.

---

## 1. Berechnungsgrundlage & Tariflogik

Die Vergütung erfolgt auf Basis eines gestaffelten Stundensatzes mit einer Kappungsgrenze bei **42 Arbeitsstunden** pro Monat:

| Kategorie | Regelung | Stundensatz |
| :--- | :--- | :---: |
| **Basis-Arbeitszeit** | Bis maximal 42,00 Stunden | **13,90 € / Std.** |
| **Überstunden** | Alle Stunden oberhalb von 42,00 Stunden | **12,00 € / Std.** |

---

## 2. Abrechnung August 2026

### Übersicht der geleisteten Arbeitszeiten

* **04.08.2026:** 07:30 – 15:45 (8,25 Std.) – *HU FED RADEV RS FWD HU*
* **07.08.2026:** 09:15 – 12:45 (3,50 Std.) – *HU MZ WI MZ HU*
* **10.08.2026:** 09:00 – 15:15 (6,25 Std.) – *HU DITZ MZ HU DITZ FED HU*
* **12.08.2026:** 12:30 – 15:00 (2,50 Std.) – *HU FW Wölf HU*
* **13.08.2026:** 09:10 – 15:45 (6,58 Std.) – *HU LAD WFD HU MZ MZ HU*
* **17.08.2026:** 07:00 – 12:30 (5,50 Std.) – *HU AB Kirch HERSF HU*
* **18.08.2026:** 08:30 – 10:50 (2,33 Std.) – *HU FWD HU HU*
* **19.08.2026:** 11:00 – 15:25 (4,42 Std.) – *HU URSEL HU RÖDEL FWD HU*
* **20.08.2026:** 11:00 – 16:25 (5,42 Std.) – *HU FWD HU FWD HU*
* **21.08.2026:** 07:45 – 13:05 (5,33 Std.) – *Esee ROCK GREBEN HU HU FWD HU*
* **24.08.2026:** 10:00 – 15:10 (5,17 Std.) – *HU F MZ WI F HU*

**Gesamtarbeitszeit:** **55,25 Stunden**

---

### Finanzielle Aufschlüsselung

$$\text{Basis-Stunden: } 42{,}00 \text{ Std.} \times 13{,}90 \text{ €/Std.} = 583{,}80 \text{ €}$$

$$\text{Überstunden: } 13{,}25 \text{ Std.} \times 12{,}00 \text{ €/Std.} = 159{,}00 \text{ €}$$

$$\mathbf{Auszahlungsbetrag (Gesamtsumme): } \mathbf{742{,}80 \text{ €}}$$

---

## 3. Tabellenstruktur & Formeln (für OpenOffice / LibreOffice / Excel)

| Feld | Formel / Ausdrücke |
| :--- | :--- |
| **Arbeitszeit pro Tag (Std)** | `=IF(AND(B5<>""; C5<>""); (C5-B5)*24 - (IF(D5<>""; D5; 0)/60); "")` |
| **Gesamtstunden (Summe)** | `=SUM(E5:E35)` *(Ergebnis: 55,25)* |
| **Basis-Stunden (bis 42h)** | `=MIN(E35; 42)` *(Ergebnis: 42,00)* |
| **Überstunden (über 42h)** | `=MAX(0; E35-42)` *(Ergebnis: 13,25)* |
| **Summe Basis (€)** | `=Basis_Stunden * 13,90` *(Ergebnis: 583,80 €)* |
| **Summe Überstunden (€)** | `=Überstunden * 12,00` *(Ergebnis: 159,00 €)* |
| **Gesamtsumme (€)** | `=Summe_Basis + Summe_Überstunden` *(Ergebnis: 742,80 €)* |
