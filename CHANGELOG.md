# Changelog

## 0.2.0

### Neu

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

- **sql.js/WASM-Ladefehler behoben**: `initSqlJs()` fand die `.wasm`-Datei im Obsidian/Electron-Kontext nicht. Wird jetzt per `fs.readFileSync` aus dem Plugin-Ordner geladen; `esbuild.config.mjs` kopiert `sql-wasm.wasm` bei jedem Build automatisch dorthin.
- **Titel-Duplikate behoben**: Bibelstellen-Zitate am Titelende (z. B. „(Psalm 16:11; 100:2)") wurden nicht mehr entfernt, da sie ohnehin separat als Bibeltext-Links angezeigt werden – jetzt auch bei Vortragsreihen-/Fragen-Teiltiteln.
- **Windows-inkompatible Ordnernamen behoben**: gerade Anführungszeichen (`"`) und Schrägstriche (`/`) in generierten Namen konnten die Ordnererstellung unter Windows lautlos scheitern lassen (z. B. `2026/2027` wurde als Unterordner interpretiert). Verbotene Zeichen werden jetzt durch optisch ähnliche Unicode-Zeichen ersetzt statt entfernt, damit z. B. ein Fragezeichen am Titelende erhalten bleibt.
- **Stille Importfehler behoben**: Fehler bei Ordner-/Notizerstellung werden jetzt abgefangen und als Obsidian-Notice angezeigt statt kommentarlos zu scheitern.

## 0.1.0

Erste Implementierung: jwpub-Parser (AES-128-CBC + zlib Entschlüsselung), RTF-ZIP-Fallback, Datenmodell, Notiz-Generierung mit Frontmatter, Import-Dialog mit Vorschau.
