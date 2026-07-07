# JW Kongressprogramm – Obsidian Plugin

Ein Obsidian Community Plugin, das offizielle Programmdateien von Kongressen der Zeugen Jehovas einliest und daraus strukturierte, verlinkte Markdown-Notizen im Vault erstellt.

## Funktionen

- **Unterstützte Kongresstypen**
  - `CO` – Regionaler Kongress (Freitag / Samstag / Sonntag)
  - `CA-copgm` – Kreiskongress mit Kreisaufseher (eintägig)
  - `CA-brpgm` – Kreiskongress mit Zweigbüro-Vertreter (eintägig)
- **Primärquelle: `.jwpub`** – vollständige Entschlüsselung (AES-128-CBC + zlib) und HTML-Parsing
- **Fallback: RTF-ZIP** – automatisch, wenn kein jwpub vorliegt
- **Ein eigener Ordner pro Kongress**, benannt nach Kongresstyp, Jahr/Saison und Motto – standardmäßig direkt in der Vault-Wurzel, ohne zusätzlichen Wrapper-Ordner
  - Regionale Kongresse bekommen zusätzlich einen Unterordner je Tag (Freitag/Samstag/Sonntag)
  - Kreiskongresse (eintägig) legen die Notizen direkt im Kongressordner ab
- **Zielordner frei wählbar** beim Import – Vault-Wurzel (Standard), bestehenden Ordner auswählen oder neuen anlegen
- **Eine Notiz pro Programmpunkt**, durchnummeriert in Programmreihenfolge (`01.`, `02.`, …)
  - Vortragsreihen erhalten eine Notiz mit einer Überschrift pro Teil
- **„Übersicht"-Notiz pro Tag** (`00. Übersicht.md`) mit dem kompletten Tagesprogramm:
  - Titelbild des Tages (bei Regionalen Kongressen) bzw. des Kongresses (bei Kreiskongressen) oben in der Notiz
  - Wochentag als große Überschrift, darunter das Tagesmotto mit verlinkter Bibelstelle (bei Regionalen Kongressen)
  - jeder Programmpunkt verlinkt auf seine Notiz
  - Vortragsreihen-Teile verlinken direkt auf den passenden Abschnitt in der Notiz
  - Bibeltexte sind inline verlinkt
  - Lieder werden mit JW-Library-Deeplink angezeigt (ohne eigene Notiz)
  - Pausen und Musikvideos werden als Hinweis angezeigt (ohne eigene Notiz)
- **Klickbare Bibelstellen** als JW-Library-Deeplinks in allen Notizen
- **Bibeltext-Popup** (optional): mit einer eigenen Bibel-jwpub-Datei (siehe unten) zeigt ein Klick auf eine Bibelstelle den Vers-Text samt Fußnoten und Querverweisen direkt in Obsidian, mit Button zum Öffnen in JW Library
- **„Beantworte die folgenden Fragen"** (Kreiskongress-Wiederholungsfragen) wird als eigene Notiz mit einer Überschrift pro Frage erzeugt und steht immer an letzter Stelle
- **„Wiederholung"-Notiz** (optional, Standard: an) mit den drei Standard-Reflexionsfragen für die Kongress-Wiederholung in der Versammlung – bei Kreiskongressen mit Link zu den gedruckten Wiederholungsfragen, bei Regionalen Kongressen mit Hinweis auf das Highlights-Video

## Voraussetzungen

- Obsidian ≥ 1.6.6
- Läuft auf Desktop und Mobile (iOS/Android) – Entschlüsselung nutzt WebCrypto (`crypto.subtle`) statt Node-`crypto`, `pako` statt Node-`zlib`, `fflate` statt `adm-zip`

## Installation

### Manuell (Entwicklung / Test)

1. Repository klonen oder herunterladen
2. `npm install` im Projektordner
3. `npm run build` (einmalig) oder `npm run dev` (Watch-Modus)
4. `main.js`, `manifest.json` und `styles.css` in den Plugin-Ordner des Vaults kopieren:
   ```
   <Vault>/.obsidian/plugins/jw-congregation-program/
   ```
5. Obsidian neu laden → **Einstellungen → Community-Plugins → Plugin aktivieren**

### Community Plugin Store

> Noch nicht veröffentlicht – befindet sich in Entwicklung.

## Nutzung

1. **Ribbon-Icon** (Buchsymbol) oder **Befehlspalette** → „Kongressprogramm importieren"
2. Programmdatei auswählen (`.jwpub` oder RTF-ZIP)
3. Zielordner wählen („Vault-Wurzel" (Standard), bestehenden Ordner aus dem Dropdown oder „➕ Neuer Ordner …")
4. Vorschau prüfen (Kongresstyp, Motto, erkannte Tage/Programmpunkte)
5. **Importieren** – der Kongressordner samt Notizen wird angelegt (mit Fortschrittsanzeige bei größeren Kongressen)

**Erneuter Import in einen bereits bestehenden Kongressordner** (z. B. nach einem Plugin-Update): rein abgeleitete Dateien ohne Schreibplatz (`00. Übersicht.md`, `Titelbild.<ext>`) werden automatisch aktualisiert. Notizen mit Platz für eigene Einträge (Redner-Notizen, `Wiederholung.md`, die Wiederholungsfragen-Notiz) bleiben unangetastet, wenn sie schon existieren – der Ordner muss dafür nicht gelöscht werden.

## Einstellungen

| Einstellung | Standard | Beschreibung |
|---|---|---|
| Zielordner | *(Vault-Wurzel)* | Übergeordneter Ordner, in dem der Kongressordner angelegt wird (pro Import überschreibbar); leer = kein Wrapper-Ordner, Kongress landet direkt in der Vault-Wurzel |
| Sprache | `Deutsch` | Bibelbuch-Namen (DE / EN) |
| Bibelstellen verlinken | An | Erzeugt klickbare `jwlibrary://`-Links |
| Wiederholungs-Notiz erstellen | An | Legt zusätzlich `Wiederholung.md` mit den drei Standard-Reflexionsfragen an |
| Feld "Tag" / "Uhrzeit" / "Bibeltexte" / "Redner" anzeigen | jeweils An | Einzeln abschaltbar, falls ein Feld nicht gebraucht wird |
| Zusätzliche Felder | *(leer)* | Freitext, wird an jede Programmpunkt-Notiz angehängt (z. B. eine eigene `**Notizen:**`-Zeile) |
| Bibel-Datei | *(keine)* | Optional: eigene Bibel-jwpub-Datei für das Bibeltext-Popup, siehe [Bibeltext-Popup](#bibeltext-popup) |

## Bibeltext-Popup

Mit einer selbst bereitgestellten Bibel-jwpub-Datei zeigt ein Klick auf eine Bibelstelle den Vers-Text direkt in einem Obsidian-Popup an (mit Button zum Öffnen in JW Library), statt nur JW Library zu öffnen.

1. Eine Bibel-jwpub-Datei besorgen – z. B. von [jw.org](https://www.jw.org/) im JWPUB-Format herunterladen, oder eine bereits über JW Library heruntergeladene Datei verwenden
2. **Empfehlung: die Studienbibel (`nwtsty`)** statt der einfachen Ausgabe (`nwt`) wählen – sie enthält deutlich mehr Querverweise, wodurch mehr Bibelstellen im Popup auflösbar sind (getestet: Psalm 16:11 wird nur von der Studienbibel gefunden, nicht von der einfachen Ausgabe)
3. In den Plugin-Einstellungen unter „Bibel-Datei" → „Datei wählen …" die heruntergeladene `.jwpub`-Datei auswählen
4. Die Datei wird lokal im Plugin-Ordner gespeichert (nicht ins Vault kopiert, nicht synchronisiert) – danach zeigt jeder Klick auf eine Bibelstelle den Vers-Text an

Das Popup zeigt neben dem Vers-Text auch **Fußnoten** und **Querverweise** an (jeweils mit Vers-Nummer, falls mehrere Verse zitiert werden). Bei Querverweisen wird die Zielstelle angezeigt, wenn sie in der Bibel-Datei selbst mit einem lesbaren Buch/Kapitel/Vers auflösbar ist – sonst nur der Vers-Text ohne Stellenangabe (technisch bedingt, siehe [AGENTS.md](AGENTS.md)).

## Ordner- & Notizstruktur

Standardmäßig (Zielordner = Vault-Wurzel) direkt als eigene Top-Level-Ordner:

```
Regionaler Kongress 2026 – Ewiges Glück/
  Freitag/
    Titelbild.jpg
    00. Übersicht.md
    01. Ist ewiges Glück möglich.md
    02. Die gute Botschaft von Jesus.md
    ...
  Samstag/
    ...
  Sonntag/
    ...
  Wiederholung.md
Kreiskongressprogramm 2026-2027 – mit dem Kreisaufseher – „Titel"/
  Titelbild.jpg
  00. Übersicht.md
  01. Warum sollten wir mit ganzem Herzen auf Jehova vertrauen.md
  02. Uns die zum Vorbild nehmen, die auf Jehova vertraut haben.md
  ...
  09. Beantworte die folgenden Fragen.md   ← immer die höchste Nummer unter den Tages-Notizen
  Wiederholung.md
```

Bei einem gewählten Zielordner (z. B. „Kongress") entsteht darunter genau dieselbe Struktur, nur um eine Ebene eingerückt.

## Notiz-Format

Für jeden Programmpunkt (außer Liedern) wird eine eigene, durchnummerierte Notiz erstellt – ohne Frontmatter, mit den relevanten Feldern direkt sichtbar:

```markdown
**Tag:** Freitag           ← nur bei Regionalen Kongressen (mehrtägig)
**Uhrzeit:** 9:40
**Bibeltexte:** ([Psalm 16:11](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=19016011&pub=nwtsty); [Psalm 100:2](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=19100002&pub=nwtsty))
**Redner:**


```

Vortragsreihen erhalten eine Notiz mit einer Überschrift je Teil (die Übersicht verlinkt direkt dorthin):

```markdown
**Uhrzeit:** 11:15
**Bibeltexte:** ([Matthäus 8:16, 17](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=40008016-40008017&pub=nwtsty); …)

## 1. „Er hat unsere Krankheiten auf sich genommen"
**Bibeltexte:** ([Matthäus 8:16, 17](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=40008016-40008017&pub=nwtsty); …)
**Redner:**


## 2. „Er wird weder streiten noch laut rufen"
…
```

Die **Übersicht** (`00. Übersicht.md`) listet den kompletten Tag mit Links:

```markdown
![[Titelbild.jpg]]

## Vormittag
- **9:30** – [Lied 160](https://www.jw.org/finder?srcid=jwlshare&wtlocale=X&prefer=lang&docid=1102022960)
- **9:40** – [[01. Ist ewiges Glück möglich|Ist ewiges Glück möglich]] ([Psalm 16:11](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=19016011&pub=nwtsty))
- **11:15** – [[03. Messianische Prophezeiungen erfüllt|Messianische Prophezeiungen erfüllt]]
  - [[03. Messianische Prophezeiungen erfüllt#1. „Er hat unsere Krankheiten auf sich genommen"|1. „Er hat unsere Krankheiten auf sich genommen"]]
  - …
```

## Technische Details

- **Entschlüsselung:** `sha256(cardString)` XOR Konstante → AES-128-CBC-Key + IV, via `crypto.subtle` (WebCrypto) statt Node-`crypto` – läuft identisch auf Desktop und Mobile
- **Dekomprimierung:** `pako` (reines JS, kompatibel zu Node-`zlib`s `inflate`) statt Node-`zlib`
- **ZIP-Handling:** `fflate` (reines JS) statt `adm-zip`, das zwingend Node-`fs`/`path`/`zlib` voraussetzt
- **sql.js läuft mit eingebettetem WASM-Binary**: die `.wasm`-Datei wird beim Build per esbuild-`binary`-Loader als Base64 direkt in `main.js` eingebettet (kein Netzwerkzugriff, keine separate Datei nötig – wichtig, da der Community-Plugin-Installer aus einem Release nur `main.js`, `manifest.json` und `styles.css` lädt)
- **Parser-Strategie:** `DOMParser` (Web-Standard-API, sowohl im Electron-Renderer als auch in der mobilen WebView verfügbar) über den entschlüsselten HTML-Content
- **Bibelstellen:** direkt aus `<a href="jwpub://b/NWTR/...">` Links im HTML
- **Lieder:** erkannt über `<a href="jwpub://p/X:...">` ohne begleitenden Bibel-Link; Liednummer aus dem Linktext (`Lied NNN`), echte jw.org-`docid` direkt aus der Zahl in diesem Href gelesen (nicht berechnet – die docid ist keine lineare Funktion der Liednummer, siehe `AGENTS.md`)
- **Titelbilder:** pro Tagesdokument über die `Multimedia`/`DocumentMultimedia`-Tabellen der jwpub-Datenbank aufgelöst (`CategoryType 8`, die am Dokumentanfang eingebettete Bannervariante) und als `Titelbild.<ext>` neben die Notizen des Tages geschrieben; Kreiskongresse haben nur ein Bild auf dem Kongress-Deckblatt, das für den einzigen Tag übernommen wird
- **„Beantworte die folgenden Fragen"** ist im jwpub ein eigenständiges Dokument (kein Listenpunkt) und wird separat erkannt und der zugehörigen Tages-Session zugeordnet
- **Dateinamen:** für Windows verbotene Zeichen (`? " : / \ | * < >`) werden durch optisch ähnliche Unicode-Zeichen ersetzt statt gelöscht, damit z. B. Fragezeichen im Titel erhalten bleiben
- **Keine Netzwerkanfragen** – verarbeitet ausschließlich lokale Nutzerdateien
- **Kein urheberrechtlich geschütztes Material** im Repository

## Entwicklung

```bash
npm install      # Abhängigkeiten installieren
npm run dev      # Watch-Modus (esbuild)
npm run build    # Produktions-Build (TypeScript-Check + esbuild)
npm run lint     # ESLint
```

Analyse-Skripte für Entwicklung & Debugging:

```bash
node scripts/analyze-jwpub.mjs <datei.jwpub>   # DB-Metadaten + HTML ausgeben
node scripts/test-parse.mjs                     # Alle 3 Kongresstypen parsen (braucht Dateien)
```

## Dateistruktur

```
src/
  main.ts                    # Plugin-Einstiegspunkt
  settings.ts                # Einstellungen
  models/
    congress.ts              # Datenmodell (Congress, Day, ProgramItem, …)
  normalizer/
    ScriptureNormalizer.ts   # Bibelstellen-Normalisierung & Link-Erzeugung
    bookNames.ts             # Buchnamenstabelle DE / EN
  parser/
    JwpubParser.ts           # jwpub → Datenmodell (primär)
    RtfParser.ts             # RTF-ZIP → Datenmodell (Fallback)
    SourceRouter.ts          # Format-Erkennung & Routing
  builder/
    NoteBuilder.ts           # Datenmodell → Markdown-Notizen (Ordnernamen, Nummerierung, Übersicht)
  ui/
    ImportModal.ts           # Import-Dialog mit Zielordner-Auswahl & Vorschau
```

## Lizenz

0-BSD – siehe [LICENSE](LICENSE)
