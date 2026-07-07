# Changelog

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
