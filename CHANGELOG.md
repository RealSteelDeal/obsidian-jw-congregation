# Changelog

## Unreleased

### Neue Funktionen

- **„Wiederholung"-Notiz**: legt zusätzlich `Wiederholung.md` mit den drei Standard-Reflexionsfragen für die Kongress-Wiederholung in der Versammlung an. Bei Kreiskongressen mit Link zur bereits vorhandenen Notiz „Beantworte die folgenden Fragen", bei Regionalen Kongressen mit Hinweis auf das Highlights-Video (dafür gibt's keine auswertbaren Daten in der Programmdatei). Über die neue Einstellung „Wiederholungs-Notiz erstellen" abschaltbar (Standard: an).

## 1.4.0

### Neue Funktionen

- **Kein Wrapper-Ordner mehr beim Import**: Der Standard-Zielordner ist jetzt die Vault-Wurzel – jeder Kongress entsteht direkt als eigener Top-Level-Ordner, ohne zusätzlichen „Kongress"-Ordner darüber. Im Import-Dialog steht „Vault-Wurzel (kein Unterordner)" als eigene Dropdown-Option; ein bestehender oder neuer Ordner kann weiterhin gewählt werden.

### Fehlerbehebungen

- **Lieder-Link-`docid` korrigiert**: Die bisherige Formel (`docid = 1102016800 + Liednummer`) war keine verlässliche Regel, sondern traf nur zufällig für einen Teil der Lieder zu (z. B. Lied 14, 54, 94) – bei Lied 160 wich die echte `docid` um 6000 ab und der Link führte ins Leere. Die echte `docid` steht bereits in der jwpub-Datei selbst (im `jwpub://p/X:...`-Link jedes Liedes) und wird jetzt direkt daraus gelesen statt berechnet. Die alte Formel dient nur noch als Fallback für den RTF-Importpfad, der keine `docid` im Quellmaterial enthält.
- **„Psalm" statt „Psalmen"** bei Einzelzitaten aus den Psalmen (z. B. „Psalm 16:11“) – entspricht jetzt der offiziellen Vorlage.

## 1.3.5

### Fehlerbehebungen

- **Lieder-Link erneut korrigiert**: `jwlibrary://` funktionierte für Lieder auf einem echten iPhone nicht (weder mit noch ohne vollen Parametersatz). Lieder-Links nutzen jetzt wieder `https://www.jw.org/finder?...&docid=...` – die einzige Variante, die je nachweislich funktioniert hat. Bibeltexte bleiben unverändert bei `jwlibrary://`.

## 1.3.4

### Fehlerbehebungen

- **JW-Library-Links vervollständigt**: Lieder- und Bibeltext-Links enthielten bisher nur den jeweiligen Inhalts-Parameter (`docid=`/`bible=`), nicht aber `srcid`/`wtlocale`/`prefer`, die im per JW-Library-„Teilen"-Funktion bestätigten Referenzlink ebenfalls enthalten sind. Beide Linktypen nutzen jetzt exakt denselben Parametersatz wie die App selbst erzeugt.

### Sonstiges

- Veralteten, nirgends referenzierten Bau-Prompt (`docs/build-prompt.md`) entfernt – widersprach dem aktuellen Stand (z. B. `isDesktopOnly: true`, Frontmatter in Notizen).

## 1.3.3

### Fehlerbehebungen

- **Lieder-Link: endgültige Ursache behoben**: Das in 1.3.2 eingeführte `docid`-Format war korrekt (per echtem Test außerhalb Obsidian bestätigt), scheiterte aber innerhalb Obsidian, weil `https://`-Links auf Mobile über eine eingebaute WebView geöffnet werden, in der Universal Links (der App-Öffnen-Mechanismus) nicht funktionieren. Der Link nutzt jetzt wieder das `jwlibrary://`-Schema (wie Bibeltexte), das diese Falle umgeht.
- **Bibeltext-Links**: `&pub=nwtsty` ergänzt, passend zum Format, das JW Library Desktop selbst beim Teilen einer Bibelstelle erzeugt.

## 1.3.2

### Fehlerbehebungen

- **Lieder-Link endgültig repariert**: Das in 1.3.1 eingeführte `lank`-Format schlug ebenfalls auf einem echten iPhone fehl. Über JW Librarys eigene „Teilen"-Funktion wurde das korrekte, docid-basierte Format verifiziert (`https://www.jw.org/finder?...&docid=NNNNNNNNNN`) – bestätigt an zwei echten Liedern aus „Singt voller Freude für Jehova".

## 1.3.1

### Fehlerbehebungen

- **Lieder-Link repariert**: JW Library erkannte das bisherige Link-Format nicht und leitete stattdessen auf eine kaputte Web-Adresse um (bestätigt durch echten Smartphone-Test). Der Link nutzt jetzt das aus echten jw.org-Exporten bestätigte `lank`-Format (`jwlibrary:///finder?lank=pub-sjjm_NNN`, NNN = Liednummer + 500).

## 1.3.0

### Neu

- **Mobile-Unterstützung (iOS/Android)**: Das Plugin läuft jetzt auch auf Obsidian Mobile, nicht mehr nur auf Desktop (`isDesktopOnly: false`). Die jwpub-Entschlüsselung wurde komplett auf plattformunabhängige Web-APIs umgestellt:
  - AES-128-CBC-Entschlüsselung und SHA-256-Schlüsselableitung laufen jetzt über die Web-Crypto-API (`crypto.subtle`) statt über Node's `crypto`-Modul
  - zlib-Dekomprimierung läuft über `pako` statt Node's `zlib`-Modul
  - ZIP-Handling (jwpub- und RTF-Import) läuft über `fflate` statt `adm-zip`, das zwingend Node `fs`/`path`/`zlib` voraussetzte
  - Die Entschlüsselung wurde gegen eine unabhängige Referenzimplementierung auf Byte-Identität der entschlüsselten Inhalte geprüft
  - Klare Fehlermeldung statt kryptischem Absturz, falls ein Gerät ausnahmsweise kein WebCrypto/WebAssembly unterstützt

### Fehlerbehebungen

- **CSS-Lint-Warnung behoben**: Die Regeln zum Entfernen des Externe-Link-Icons bei Bibeltext-/Lieder-Links nutzten `!important`; das wurde durch höhere Selektor-Spezifität ersetzt (funktional identisch)

## 1.2.0

### Fehlerbehebungen

- **RTF-Fallback grundlegend repariert**: Der Import über RTF-ZIP erkannte bei echten Kongressdateien bisher keinen einzigen Tag/Programmpunkt (falsches Zeitformat-Muster, durchsickernde Hyperlink-URLs/Metadaten im Text). RTF funktioniert jetzt gleichwertig zum jwpub-Import:
  - Zeitformat „H Uhr [MM]" (z. B. „9 Uhr 20", volle Stunde nur „11 Uhr") statt des nicht vorkommenden „H:MM"
  - Neuer klammer-bewusster RTF-Decoder statt flachem Regex-Strip
  - Lieder, Musikvideos und Pausen werden jetzt als Programmpunkte erkannt (vorher komplett verworfen)
  - Bibeldrama-Untertitel und Vortragsreihen-Teile (mit eigenen Bibelstellen pro Teil) werden korrekt zusammengesetzt
  - Tagesmotto samt Bibeltext sowie Kongress-Motto und -Jahr werden jetzt auch aus RTF-Dateien gelesen
  - Mehrfach gezählte Bibelstellen (durch über mehrere Textläufe verteilte Zitate) werden dedupliziert

## 1.1.0

### Neu

- **Tagesmotto in der Übersicht**: Der Wochentag steht jetzt als große Überschrift (ohne "Tag:"-Präfix), darunter das Tagesmotto samt verlinkter Bibelstelle (z. B. „Geben macht glücklicher als Empfangen" (Apostelgeschichte 20:35)) – wird direkt aus dem jwpub-Tagesdokument gelesen.
- **Bibeltexte im Klammer-Format**: In Übersicht und Notizen stehen Bibeltexte jetzt wie im offiziellen gedruckten Programm in einer gemeinsamen Klammer (z. B. „(Matthäus 5:1-2; Psalmen 100:2)"), mit kurzem Bindestrich statt Halbgeviertstrich für Versbereiche.
- **Externes-Link-Icon entfernt**: Bibeltext- und Lieder-Links (`jwlibrary://`) zeigen kein Externe-Link-Icon mehr – weder in der Leseansicht noch beim Bearbeiten (Live Preview).

### Fehlerbehebungen

- **Bibeldrama-Zitat-Dopplung behoben**: Der Untertitel eines Bibeldramas zeigte die Bibelstellen-Zitate zusätzlich zum bereits separat verlinkten Bibeltext-Block an; die Zitate werden jetzt wie bei normalen Titeln aus dem Untertitel entfernt.

### Sonstiges

- Automatisierte Unit-Tests (Parser, Normalizer, NoteBuilder) über Node's eingebauten Test-Runner ergänzt.
- Ungenutzten `sql-wasm.wasm`-Rest aus dem Projekt-Root entfernt.

## 1.0.0

### Sonstiges

- **Release-Workflow korrigiert**: GitHub-Releases werden jetzt direkt veröffentlicht statt als Draft angelegt. Der Draft-Status verhinderte, dass Obsidians automatische Release-Prüfung das Release validieren konnte.

## 0.2.0

### Neu

- **Titelbild in der Übersicht**: Das Titelbild des jeweiligen Tages (Regionaler Kongress) bzw. des Kongresses (Kreiskongress, hat nur ein Deckblattbild) wird beim Import als `Titelbild.jpg` neben die Notizen geschrieben und oben in `00. Übersicht.md` eingebettet.
- **Pausen und Musikvideos in der Übersicht**: wurden bisher komplett übersprungen, erscheinen jetzt (wie Lieder) in der Tagesübersicht – ohne eigene Notiz.
- **Lieder-Zeile zeigt den vollständigen Programmtext**: statt nur „Lied NNN" wird jetzt die komplette Zeile übernommen, damit begleitende Hinweise (z. B. „Lied 43 (Bekanntmachungen und Gebet)") nicht mehr verloren gehen – in der Übersicht ist dabei weiterhin nur „Lied NNN" selbst verlinkt, der Rest steht als normaler Text daneben.

- **Zielordner-Auswahl im Import-Dialog**: bestehenden Vault-Ordner aus einem Dropdown wählen oder über „➕ Neuer Ordner …" einen neuen anlegen, statt nur den fest eingestellten Standardordner zu nutzen.
- **Eigener Kongressordner** pro Import, benannt nach Kongresstyp, Jahr/Saison und Motto (z. B. `Regionaler Kongress 2026 – Ewiges Glück` bzw. `Kreiskongressprogramm 2026-2027 – mit dem Kreisaufseher – „Titel"`).
- **Tagesordner für Regionale Kongresse** (Freitag/Samstag/Sonntag); Kreiskongresse bleiben eintägig ohne Unterordner.
- **Notiz-Nummerierung** in Programmreihenfolge (`01.`, `02.`, …) statt freier Titel – sorgt für eine chronologisch sortierte Dateiliste.
- **„Übersicht"-Notiz pro Tag** (`00. Übersicht.md`) mit dem kompletten Tagesprogramm:
  - jeder Programmpunkt verlinkt direkt auf seine Notiz
  - Vortragsreihen-Teile verlinken auf den passenden Abschnitt in der jeweiligen Notiz
  - Bibeltexte sind inline verlinkt
- **Lieder werden jetzt erfasst** (vorher komplett ignoriert) und erscheinen in der Übersicht mit JW-Library-Deeplink – weiterhin ohne eigene Notiz.
- **„Beantworte die folgenden Fragen"** (Kreiskongress-Wiederholungsfragen, im jwpub ein eigenständiges Dokument) wird jetzt erkannt und als eigene Notiz mit einer Überschrift pro Frage erzeugt; steht durch die Nummerierung immer an letzter Stelle.
- **Vereinfachtes Notiz-Format**: kein Frontmatter mehr, stattdessen direkt sichtbare Felder (`**Tag:**`, `**Uhrzeit:**`, `**Bibeltexte:**`, `**Redner:**`); die „Tag:"-Zeile entfällt bei Kreiskongressen (eintägig, aber terminlich variabel).

### Fehlerbehebungen

- **sql.js/WASM-Ladefehler behoben**: `initSqlJs()` fand die `.wasm`-Datei im Obsidian/Electron-Kontext nicht. Die `.wasm`-Datei wird jetzt beim Build per esbuild-`binary`-Loader als Base64 direkt in `main.js` eingebettet, statt separat per `fs.readFileSync` vom Dateisystem geladen zu werden – notwendig, da der Community-Plugin-Installer aus einem GitHub-Release ausschließlich `main.js`, `manifest.json` und `styles.css` herunterlädt und eine zusätzliche `sql-wasm.wasm`-Datei dort nie ankäme.
- **Titel-Duplikate behoben**: Bibelstellen-Zitate am Titelende (z. B. „(Psalm 16:11; 100:2)") wurden nicht mehr entfernt, da sie ohnehin separat als Bibeltext-Links angezeigt werden – jetzt auch bei Vortragsreihen-/Fragen-Teiltiteln.
- **Windows-inkompatible Ordnernamen behoben**: gerade Anführungszeichen (`"`) und Schrägstriche (`/`) in generierten Namen konnten die Ordnererstellung unter Windows lautlos scheitern lassen (z. B. `2026/2027` wurde als Unterordner interpretiert). Verbotene Zeichen werden jetzt durch optisch ähnliche Unicode-Zeichen ersetzt statt entfernt, damit z. B. ein Fragezeichen am Titelende erhalten bleibt.
- **Stille Importfehler behoben**: Fehler bei Ordner-/Notizerstellung werden jetzt abgefangen und als Obsidian-Notice angezeigt statt kommentarlos zu scheitern.
- **Nicht-transaktionaler Import behoben**: Schlägt der Import mitten in der Notiz-Erstellung fehl, werden die in diesem Durchlauf bereits erstellten Notizen jetzt automatisch wieder entfernt (`FileManager.trashFile`), statt eine unvollständige Notizmenge im Vault zurückzulassen. Dadurch `minAppVersion` auf 1.6.6 angehoben.
- **RTF-Fallback grundlegend überarbeitet**: Die bisherige Text-Normalisierung entfernte versehentlich sämtliche Absatzumbrüche, wodurch pro RTF-Datei praktisch nur ein einziger (meist unbrauchbarer) Programmpunkt erkannt wurde. Absatzgrenzen (`\par`/`\line`/`\page`) werden jetzt vor dem Entfernen der übrigen RTF-Steuerwörter erhalten. Zusätzlich werden Bibelstellen-Hyperlinks jetzt pro Absatz statt global über das gesamte Dokument zugeordnet. Eine direkt ausgewählte (nicht gezippte) `.rtf`-Datei wird jetzt ebenfalls erkannt, statt beim Entpacken eine Exception zu werfen.
- **Doppelte Bibelstellen bei Vortragsreihen behoben**: Die übergeordnete Vortragsreihen-Zeile zeigte zusätzlich zu jedem Teil auch noch die Bibelstellen aller Teile zusammengefasst an (Redundanz in Notiz und Übersicht). Die Teile-Liste wird bei der Extraktion jetzt ausgeschlossen.
- **Übersicht-Notiz aufgeräumt**: Bibelstellen-Referenzen werden jetzt visuell abgeschwächt dargestellt (kleiner, gedämpfte Farbe via `styles.css`), damit der Titel-Link bei Programmpunkten mit vielen Referenzen der visuelle Fokus bleibt.

### Sonstiges

- `scripts/test-parse.mjs` nutzt jetzt den echten `JwpubParser` (per `jiti` direkt aus der TypeScript-Quelle importiert) statt einer separat gepflegten Kopie der Parser-Logik – verhindert unbemerktes Auseinanderdriften zwischen Test und Produktivcode.
- Toten Code entfernt: nie erzeugter `ItemType` `'symposium'` und die dazugehörige, nirgends aufgerufene `NoteBuilder.itemTypeLabel()`.

## 0.1.0

Erste Implementierung: jwpub-Parser (AES-128-CBC + zlib Entschlüsselung), RTF-ZIP-Fallback, Datenmodell, Notiz-Generierung mit Frontmatter, Import-Dialog mit Vorschau.
