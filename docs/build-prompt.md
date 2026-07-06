# Bau-Prompt: Obsidian-Plugin „JW-Kongressprogramm → Notizen"

> Dieses Dokument ist ein vollständiges Briefing für ein KI-Modell (Claude), das daraus ein Obsidian-Community-Plugin programmieren soll. Alle Format-Angaben wurden an echten Dateien (regionaler Kongress `CO-pgm26`, Kreiskongress `CA-copgm27` / `CA-brpgm27`) verifiziert.

---

## 1. Rolle & Auftrag

Du bist ein erfahrener TypeScript-Entwickler für Obsidian-Plugins. Baue ein **veröffentlichungsreifes Community-Plugin**, das Programmdateien von Kongressen der Zeugen Jehovas einliest und daraus strukturierte Markdown-Notizen im Vault erzeugt. Arbeite Modul für Modul, liefere kompilierbaren Code (`main.ts` + Module), eine `manifest.json` und eine `README.md`. Frage bei echten Format-Unklarheiten nach, statt zu raten.

---

## 2. Ziel & Nutzungskontext

- **Zweck:** Notizen während Zusammenkünften/Kongressen. Nutzer importiert die offizielle Programmdatei, das Plugin legt daraus ein vorbereitetes Notiz-Gerüst an (Titel, Untertitel, Zeiten, Programmpunkte, Bibeltexte, Lieder).
- **Verteilung:** öffentlicher Obsidian-Community-Plugin-Store (Developer Policies beachten).
- **Kongresstypen (alle unterstützen):**
  - `CO-pgm` — regionaler Kongress (mehrtägig: Freitag/Samstag/Sonntag).
  - `CA-copgm` — Kreiskongress mit Kreisaufseher (eintägig).
  - `CA-brpgm` — Kreiskongress mit Zweigbüro-Vertreter (eintägig).

---

## 3. Quellstrategie (fix)

- **jwpub = führende Quelle (primär).** Reichhaltiger, strukturierter, sofort nach Veröffentlichung verfügbar.
- **RTF = Fallback.** Nur nutzen, wenn kein jwpub vorliegt oder das jwpub-Parsing scheitert.
- **PDF = nicht unterstützen.**

Erkennung: Eingabe per Dateiendung/Container-Signatur bestimmen, jwpub bevorzugen; bei Fehlschlag automatisch auf RTF zurückfallen und den Nutzer informieren.

---

## 4. jwpub-Format — verifizierte Spezifikation

### 4.1 Container
- `.jwpub` ist ein **ZIP** mit zwei Einträgen: `manifest.json` und `contents`.
- `contents` ist selbst ein **ZIP** (Kompression „store") mit:
  - einer SQLite-DB `<SYMBOL>.db` (z. B. `CA-copgm27_X.db`),
  - mehreren **unverschlüsselten** JPGs (Bilder/Collagen).

### 4.2 Datenbank
- Die SQLite-DB ist **direkt lesbar**; nur die Spalte `Document.Content` (BLOB) ist verschlüsselt.
- Metadaten (`Publication`, `Document.Title`, `Multimedia`, …) liegen im **Klartext**.
- Relevante Tabellen: `Document`, `Publication`, `Multimedia`, `DocumentMultimedia`. (`Question`, `BibleCitation` sind hier unzuverlässig/leer bzw. nutzen interne Verse-IDs → **nicht** darauf verlassen, siehe 4.4.)

### 4.3 Entschlüsselung von `Document.Content`
Ableitung des Schlüssels **aus der DB-Tabelle `Publication`**, nicht aus dem Manifest:

1. Card-String bilden: `MepsLanguageIndex + "_" + Symbol + "_" + Year`
   - Falls `IssueTagNumber != 0`: zusätzlich `+ "_" + IssueTagNumber`.
   - Beispiel (verifiziert): `2_CA-copgm27_2027`.
2. `sha256(cardString)` → 32 Byte.
3. Byteweise **XOR** mit der Konstante
   `11cbb5587e32846d4c26790c633da289f66fe5842a3a585ce1bc3a294af5ada7` → 32 Byte.
4. `key = xor[0:16]`, `iv = xor[16:32]`.
5. `Document.Content`: **AES-128-CBC** entschlüsseln → dann **zlib-inflate** → UTF-8-HTML.

`manifest.json` liefert `contentFormat: "z-a"` (zlib+AES) zur Bestätigung.

### 4.4 Struktur des entschlüsselten HTML (die eigentliche Nutzdaten-Quelle)
Der Programminhalt steckt **im HTML**, nicht in Nebentabellen. Merkmale:
- Absätze/Blöcke mit `id`/`data-pid`, Überschriften `<h1>`/`<h2>`, Programmzeilen im `bodyTxt`.
- Bibelstellen als Links: `jwpub://b/NWTR/BOOK:CHAP:VERSE-BOOK:CHAP:VERSE` (Buch numerisch, z. B. `20` = Sprüche).
- Bild-Referenzen: `jwpub-media://<dateiname>.jpg` (Datei liegt im `contents`-ZIP).
- Programmpunkte enthalten Uhrzeit, Typ (Lied/Vortrag/Vortragsreihe/Bibeldrama/Taufe/…), Titel, ggf. Untertitel, Bibelstellen, Liednummern.

→ **jwpub-Parser = HTML-Parser** über den entschlüsselten Content, angereichert mit Bild-Captions aus `Multimedia.FilePath`/`Caption`.

---

## 5. RTF-Format — verifizierte Spezifikation (Fallback)

- Auslieferung als **ZIP mit mehreren RTFs**: pro Tag eine Datei **plus** Zusatzseiten (Deckblatt/„Programm", „Informationen für Kongressbesucher").
- **Tageszuordnung über den Datei-Inhalt** (Tagesüberschrift „Freitag/Samstag/Sonntag"), **nicht** über den Dateinamen. Zusatzdateien erkennen und überspringen.
- Bibelstellen und Lieder liegen als eingebettete **`HYPERLINK`-Felder** vor:
  - Verse: `…finder?...&bible=BBCCCVVV[-BBCCCVVV]…` (z. B. `40005001` = Matthäus 5:1). Codes bevorzugt aus dem Hyperlink ziehen (verlustfrei), nicht aus dem angezeigten Text rekonstruieren.
  - Lieder: `…finder?...&lank=pub-sjjm_<NR>_VIDEO`.

---

## 6. Bibelstellen-Normalisierung (wichtig)

Es existieren **drei verschiedene Encodings** — auf ein internes Kanonformat normalisieren:

| Quelle | Encoding | Beispiel |
|---|---|---|
| jwpub-HTML | `book:chap:verse` | `20:16:20` |
| RTF-Hyperlink | `BBCCCVVV` | `40005001` |
| (jw.org-Link-Ziel) | `bible=BBCCCVVV` | `bible=40005001` |

- Internes Kanonformat definieren (z. B. `{book:int, chapter:int, verseStart:int, verseEnd:int}`) plus Buch-Nummer↔Name-Tabelle (mehrsprachig, mind. DE/EN).
- Für Ausgabe-Links das JW-Library-Format `jwlibrary:///finder?bible=BBCCCVVV` erzeugen (kompatibel zum bestehenden „JW Library Linker"-Plugin).

---

## 7. Gemeinsames Datenmodell (Zielstruktur beider Parser)

Beide Parser münden in **eine** Zwischenrepräsentation. Vorschlag:

- `Congress { type, theme, themeScripture, year/season, days[] }`
- `Day { name, weekday, date?, sessions[] }` (Session = Vormittag/Nachmittag)
- `ProgramItem { time, itemType, title, subtitle?, scriptures[], songs[], bulletPoints[] }`
- `Scripture { book, chapter, verseStart, verseEnd }`

Die Notiz-Generierung arbeitet **ausschließlich** gegen dieses Modell (quellenunabhängig).

---

## 8. Plugin-Architektur

- Obsidian `Plugin`-Klasse mit `onload()`/`onunload()`; alle Ressourcen über `register*()` sauber freigeben.
- Module (klare Trennung):
  - `JwpubParser` (primär): Container → DB → Entschlüsselung → HTML → Datenmodell.
  - `RtfParser` (Fallback): ZIP → RTFs → Hyperlink-Extraktion → Datenmodell.
  - `SourceRouter`: Format erkennen, jwpub bevorzugen, bei Fehler auf RTF fallen.
  - `ScriptureNormalizer`: Encoding-Normalisierung + Link-Erzeugung.
  - `NoteBuilder`: Datenmodell → Markdown via Template.
- `isDesktopOnly: true` prüfen: Krypto/zlib laufen über Node/Electron-APIs → Plugin ist Desktop-gebunden (im Manifest entsprechend deklarieren).

---

## 9. UI & Einstellungen

- **Import-Flow:** Command + Ribbon-Icon → Datei-Auswahl (jwpub/RTF-ZIP) → Vorschau (erkannter Kongresstyp, Motto, Tage) → Import-Bestätigung.
- **Settings-Tab:**
  - Zielordner im Vault.
  - Ausgabe-Granularität: eine Notiz pro Tag **oder** eine pro Kongress.
  - Sprache der Bibelbuch-Namen.
  - Bibelstellen-Linkformat (JW-Library-Link an/aus, Format).
  - Optionale Vorlagen-Datei (überschreibt Standard-Template).

---

## 10. Notiz-Generierung

- Aus dem Datenmodell pro Tag/Kongress eine Markdown-Notiz.
- Frontmatter mit Metadaten (`typ`, `motto`, `tag`, `datum`, `jahr`).
- Programmpunkte als Gliederung (Zeit · Typ · Titel · Untertitel), Bibelstellen als klickbare Links, Lieder mit Nummer.
- Leere Notiz-Bereiche für eigene Mitschriften je Punkt.
- Standard-Template mitliefern, per Settings überschreibbar.

---

## 11. Technische Rahmenbedingungen

- **Krypto/Kompression:** Node `crypto` (AES-128-CBC) + `zlib` (inflate). Keine unnötigen externen Krypto-Libs.
- **ZIP:** schlanke Lib oder Node-Bordmittel; verschachteltes ZIP (`.jwpub` → `contents`) beachten.
- **RTF:** eigener minimaler Extraktor für `HYPERLINK`-Felder + Klartext; Unicode-Escapes (`\uNNNN`) korrekt dekodieren.
- **SQLite:** Zugriff auf die entpackte `.db` (In-Memory oder Temp), nur benötigte Tabellen lesen.
- **Build:** TypeScript + esbuild (Sample-Plugin-Toolchain), `main.js`-Output.

---

## 12. Coding Standards

- Clean Code, minimal kommentiert.
- Naming: JS/TS `camelCase`, Klassen `PascalCase`.
- OOP für die Plugin-/Parser-Struktur.
- Performance beachten (keine unnötigen Full-Scans, Bilder nur bei Bedarf laden).
- Child-/Update-freundlich: Parser pro Jahrgang leicht anpassbar halten (Layout-Änderungen isolieren).

---

## 13. Community-Store & Copyright

- Das Plugin **verarbeitet ausschließlich nutzereigene, lokal vorliegende Dateien**; es lädt keine Inhalte herunter, bündelt oder verbreitet keine urheberrechtlich geschützten Texte.
- Kein Mitliefern von WTS-Material im Repo (keine Beispiel-Programme, keine entschlüsselten Inhalte).
- Developer Policies des Community-Stores einhalten (Manifest, Review-Prozess, keine Telemetrie ohne Zustimmung).

---

## 14. Definition of Done

- jwpub eines `CO-`, eines `CA-copgm-` und eines `CA-brpgm-`Programms importierbar → korrekte Notiz(en).
- RTF-Fallback greift automatisch, wenn kein jwpub vorliegt.
- Bibelstellen aus beiden Quellen identisch normalisiert und klickbar.
- Kompilierbar, lint-sauber, Store-Manifest vollständig, README mit Setup/Nutzung.

---

## 15. Offene Punkte für Rückfrage (nicht raten)

1. Endgültiges Notiz-Template (Felder/Reihenfolge) — Standard vorschlagen, bestätigen lassen.
2. Bibelbuch-Namenstabelle: nur DE/EN oder mehr Sprachen?
3. Abhängigkeit zum „JW Library Linker" (dessen Link-Erzeugung wiederverwenden) oder eigenständige Link-Logik?

---

## 16. Empfohlene Bau-Reihenfolge

1. Datenmodell + `ScriptureNormalizer` (Fundament).
2. `JwpubParser` (Container→DB→Entschlüsselung→HTML→Modell).
3. `NoteBuilder` + Standard-Template.
4. `RtfParser` + `SourceRouter` (Fallback).
5. UI (Import-Flow, Settings).
6. Store-Feinschliff (Manifest, README, Policies).
