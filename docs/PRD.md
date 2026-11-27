# PRD: Stolash Optimizer — PRO100 v5 to L1 strips

| | |
|---|---|
| Status | Ready to implement (v1) |
| Product | Static workshop app, GitHub Pages |
| UI languages | English and Polish, switchable |
| Document version | 3.2 |
| v1 scope | 100% in the browser, no backend |
| Later | Accounts, cloud storage, Supabase |

This document is the source of truth for the build. Where the original notes allowed two readings, this PRD picks one. The confirmed input is a PRO100 v5 **Lista formatek** save (section 9). The **Lista elementów** tab is still an open question.

Glossary used in code and in this document:

| Term | Meaning |
|---|---|
| Part | One cut piece from the PRO100 formatka list (formatka) |
| Strip | A long board ripped to one width, edge-banded along its length, then crosscut in the shop (pas) |
| L1 | Edge banding on one long edge of the strip |
| L1+L2 | Edge banding on both opposite long edges |
| Grain | Wood-decor direction. PRO100 length runs with the grain, width runs across it |
| Kerf | Saw blade thickness lost between adjacent parts |

## 1. Problem

From a PRO100 v5 "element list" report, the workshop picks out parts banded on one edge, or on two opposite edges, and lays them onto long strips for a wholesaler order. Fronts, parts banded on three or four sides, and parts with no banding sit in the same report. A wrong strip width, kerf, or grain direction ruins the order or the shop cut list.

The app turns that report into three lists:

1. a strip order for the wholesaler,
2. parts to order already finished,
3. a cut map for each strip at the saw.

## 2. User and context

One user: the person building the material order on the shop floor. They work at the same computer often. They know their wholesaler's material and edge-banding names. They do not run a server and do not create an account to cut a list.

The CSV stays on that computer. v1 does not send the file, the clipboard contents, or the results anywhere beyond the browser.

The UI is bilingual. A cabinetmaker can work in Polish. An English-speaking user can work in English. Imported names (part, material, edge product) stay in the language of the file.

## 3. Goals for v1

- A PRO100 file or paste becomes a strip order and a cut map without hand grouping.
- Saw, board, and edge settings survive a reload.
- The order can be copied into a wholesaler form and printed as a shop cut sheet.
- The app is a static build (Vite, React, TypeScript) on GitHub Pages, with no backend.
- Every interface string exists in English and Polish, and a menu control switches the language immediately.

Acceptance at delivery: the scenarios in section 17 produce the numbers in this document, a sample file parses after the column map is confirmed, and both languages cover the same screens.

## 4. Scope

### In v1

- One page: import, parameters, strip preview, result tabs.
- CSV/TXT and paste parsing, column mapping, classification, 1D packing, CSV and XLSX export, printable lists and drawings.
- Every workshop assumption is a preference, including sheet size. v1 stores preferences in `localStorage`. Supabase later stores the same objects.
- English and Polish UI, with a language toggle in the header menu.

### Later on purpose

- Accounts, project sync, Supabase (section 16).
- A library of many saved jobs in the cloud.
- Pricing, stock, and sending the order to the wholesaler.
- 2D nesting of parts on whole sheets. Parts are packed along strips, and whole strips are then laid out on boards (section 13).
- A PRO100 plugin or automatic report download.
- A third UI language.

## 5. Assumptions

1. PRO100 length is the dimension along the grain. Width is across the grain. Rotating a part's texture by 90° in the PRO100 material properties swaps length and width in the formatka report, so the report alone fixes the grain direction. Left and right edges run along the length. Top and bottom edges run along the width.
2. The wholesaler bands the strip along its length. The shop crosscuts it into parts. The banded edge of a part therefore lies along the strip. Strip width is the dimension perpendicular to that edge.
3. A full strip is ordered at the board length (`maxLength`). End-trim allowance only reduces the length available for parts.
4. Strips are ordered at full length. With `shortStrips` switched on, a poorly filled strip is ordered shorter: the parts, the kerfs between them, and the same trim allowance.
5. PRO100 dimensions are the finished part size. The wholesaler mills each edge by the banding thickness before gluing, so nothing is subtracted from the ordered width. A switch turns subtraction on for a supplier who does not mill.
6. With grain lock on, the grain direction of every part is kept. Banding only on an end (top or bottom) needs a strip ripped across the board, which can be no longer than `maxWidth`.
7. With grain lock off, the banded edge sets orientation, including when that edge lies across the nominal length.
8. Narrow strips are flagged. For any one-edge group, narrow or not, the user opts in before two full strips are ordered as one wider L1+L2 blank and ripped in half in the shop. The workshop cuts all parts from the strips itself.
9. The confirmed export is headerless Lista formatek: eight columns, edge marks in their own fields. Other layouts still go through the synonym map.
10. The active UI language changes labels, messages, export headers, and printed chrome. It does not change packing, imported names, or stored millimeters.

## 6. Flow

1. The user drops a file or pastes a table.
2. The app detects encoding and delimiter, shows the first rows, and proposes a column map.
3. The user checks the setup tabs: which elements to include, "Keep grain direction" per material (suggested from the name), parameters, and the column map.
4. "Generate cut lists" classifies the parts, packs strips and draws the result.
5. A later change leaves the shown result alone, marks it out of date, and turns the button into "Update cut lists".
6. The user copies the order, downloads CSV or XLSX, or prints the lists and drawings.

A new import replaces the current part list. Parameters, the column map, and the language stay.

## 7. Language

Supported locales: `en` and `pl`.

The header has a menu. Inside it, a language control offers two choices, each written in its own language: **English** and **Polski**. The current choice is marked. Choosing one closes the menu, sets `document.documentElement.lang`, and re-renders the page. Packing is not rerun. Numbers on screen follow the new locale.

Persistence key: `stolash.locale.v1`. Clearing the session does not change it.

First visit, when the key is absent:

- `pl` when `navigator.language` starts with `pl`,
- `en` otherwise.

Strings live in `src/i18n/` as two dictionaries keyed by the same ids. The UI reads strings only through that module. A missing key is a bug, surfaced in development as the key itself.

What switches with the locale:

- Header, menu, buttons, tabs, field labels, placeholders, validation, empty states.
- Grain checkbox, warning flags, exception reasons, skipped-row reasons, cut-map notes.
- Export column headers, sheet names, and the clipboard header row.
- The generated default edge label, while the user has not typed their own.
- `lang` on the document, so the browser hyphenates and the print dialog matches the language.

What stays as imported data:

- Part names, material names, and edge-product text taken from the file.
- A `defaultEdgeLabel` the user has edited.
- User-edited rows in the single-column edge value table.

Number format on screen, in print, and in the clipboard:

| Locale | Decimal | CSV delimiter | CSV decimals |
|---|---|---|---|
| `pl` | comma (`3,2`) | `;` | comma |
| `en` | dot (`3.2`) | `,` | dot |

CSV is UTF-8 with BOM in both locales, so Excel keeps Polish characters in imported names. Internal math stays in millimeters as JS numbers. Locale affects display and export text only.

Stable reason ids (translated at render time): `badDimension`, `badQuantity`, `unknownEdge`, `nonPositiveWidth`, `widthExceedsBoard`, `longerThanBoard`, `adjacentEdges`, `finishedPart`, `mixedEdgeProducts`, `shortStrip`, `narrowStrip`, `doubledStrip`, `acrossGrain`, `trimTight`.

## 8. Preferences

Sheet size and every other workshop assumption are preferences. `classify` and `pack` receive a `Settings` object. They do not contain 2760, 2030, 3.2, 10, 0.8, 70, or 0.40 as literals. The numbers in this document are factory defaults, applied only when nothing is stored yet.

v1 writes preferences through `ProjectStore` into `localStorage`. The browser is the only copy. A later Supabase implementation stores the same JSON (section 16). Field names stay stable so the move does not change packing.

| What | Storage key in v1 | Survives "Clear session" |
|---|---|---|
| Workshop settings, the table below | `stolash.settings.v1` | yes |
| UI language | `stolash.locale.v1` | yes |
| Column map and one-column edge value table | `stolash.columnMap.v1` | yes |
| Parsed parts, grain choices, double-strip toggles | `stolash.session.v1` | no |

First visit writes the factory settings. After that, the stored object wins, including values the user set back to a factory number. "Reset preferences" in the header menu writes the factory settings again and recalculates. It leaves language, the column map, and the session in place.

| Field | Factory default | Meaning | Validation |
|---|---|---|---|
| `maxLength` | 2760 mm | Sheet length after trimming, and the order length of a full strip | > 0 |
| `maxWidth` | 2030 mm | Sheet width. A wider strip is not ordered | > 0 |
| `sawKerf` | 3.2 mm | Kerf between neighboring parts. Also the rip kerf of a doubled strip | ≥ 0 |
| `trimAllowance` | 10 mm | Allowance for squaring the ends. Removed from the usable length | ≥ 0 and < `maxLength` |
| `subtractEdge` | no | Order the width narrower by the banding. Off because edges are milled before gluing | yes / no |
| `defaultEdgeThickness` | 0.8 mm | Edge thickness when the file has no number. Lista formatek always uses this | > 0 |
| `defaultEdgeLabel` | from thickness and locale | Edge name when the file has no product name. Lista formatek always uses this | non-empty text |
| `minStripWidth` | 70 mm | Below this ordered width the row is flagged | > 0 |
| `shortStrips` | no | Order poorly filled strips shorter than the board | yes / no |
| `shortStripRatio` | 0.40 | Short-strip threshold against usable length | 0–1 |
| `orderDecimals` | 1 | Decimal places on ordered length and width, and on the packing group width | integer 0–3 |
| `minOffcut` | 300 mm | A leftover with both sides at least this long counts as reusable | > 0 |
| `fitNarrower` | yes | Narrower parts may go on wider strips when that orders less material | yes / no |

The untouched edge label is "0.8 mm edge" in English and "Obrzeże 0,8 mm" in Polish, using the current thickness. Once the user edits the label, that text is stored and kept across language switches. Reset preferences restores the generated label.

Usable length:

```
L_eff = maxLength - trimAllowance
```

Any valid change is saved immediately and takes effect at the next generation. An invalid value is not saved. The reason shows on that field.

Grain lock per material and "pair into a double strip" are session choices, stored with the session, not in the workshop settings. The name heuristic only suggests the grain checkbox. The stored choice wins on reload.

## 9. Input and parser

### Sources

- A `.csv` or `.txt` file.
- `Ctrl+V` into a text area. The browser clipboard is already Unicode, so Windows-1250 detection applies to files only.

### File encoding

Read an `ArrayBuffer`. `FileReader.readAsText` corrupts Windows-1250.

1. BOM `EF BB BF` means UTF-8.
2. Otherwise decode as UTF-8 with the fatal flag. A decode error means Windows-1250 (`TextDecoder` label `windows-1250`).
3. If UTF-8 succeeds and the text contains `U+FFFD`, use Windows-1250.

Polish characters in the preview (ą, ę, ł, ś, ć, ż, ź, ó, ń) are the visual check: the user sees the material name before confirming the map.

### Delimiter

On the first non-empty line, count `;`, tab, and `,` outside quotes. The highest count wins. Ties break in this order: semicolon, tab, comma. PapaParse receives the decoded string and that delimiter.

### Numbers

- Delimiter `;` or tab: comma is the decimal mark (`720,5` → 720.5).
- Delimiter comma: dot is the decimal mark.
- Spaces and non-breaking spaces inside numbers are removed.
- Quantity must be an integer ≥ 1. Any other quantity sends the row to the skipped list.
- Length and width must be > 0.

Parsing numbers does not follow the UI locale. It follows the file delimiter, because a Polish PRO100 export keeps comma decimals even when the UI is English.

### Confirmed profile: Lista formatek

Source checked against a sample `lista formatek` CSV and the matching `.txt` from PRO100 v5 (report **Lista formatek**, button Zapisz / the copy buffer). The on-screen grid draws the edge mark inside the dimension cell. The file stores that mark as the next column.

Both files are Windows-1250, CRLF, and have **no header row**.

| | CSV | TXT and Kopiuj |
|---|---|---|
| Delimiter | `;` | tab |
| Quoting | every field quoted | none |

Eight columns, in this order:

| Index | Role | Example |
|---|---|---|
| 1 | Part name | `Przykład A`. May be empty |
| 2 | Length, mm | `2390` |
| 3 | Length edge mark | three spaces, `—`, or `=` |
| 4 | Width, mm | `600` |
| 5 | Width edge mark | three spaces, `—`, or `=` |
| 6 | Thickness, mm | `18` |
| 7 | Quantity | `4` |
| 8 | Material | empty, or `Inne\lustro srebrne` |

The length edge mark describes the edges whose length is the length column (left and right, parallel to the grain). The width edge mark describes the edges whose length is the width column (top and bottom, across the grain). PRO100 does not say which single side of a pair. One mark is enough, because a strip is banded along the whole edge.

| Mark in the file | After Windows-1250 decode | Meaning |
|---|---|---|
| three spaces `0x20 0x20 0x20` | empty after trim | no banding on that dimension |
| byte `0x97` | em dash `—` (U+2014) | one edge of that dimension |
| `=` | `=` | both edges of that dimension |

Also accept hyphen `-` and en dash `–` as one edge, so a paste that changed the em dash still parses. Any other mark skips the row with `unknownEdge`.

This profile carries no edge-product name and no edge thickness. Every banded part uses `defaultEdgeThickness` and `defaultEdgeLabel`. Those two settings are what the wholesaler order prints as the banding.

Material uses a backslash between catalog and name (`Inne\lustro srebrne`). Keep the full string. In the checked file the board rows have an empty material even with **Pokaż katalogi materiałów** turned on. Only the non-board row is filled. Empty material is one group, shown as "(no material)" / "(brak materiału)". The group key is the empty string, so a language switch does not split the group. The order still shows thickness, which is what distinguishes the 18 mm boards.

Detection, applied before the synonym map: PapaParse with `header: false`. If every row has 8 fields, columns 2 and 4 are numbers, and columns 3 and 5 are empty, `-`, `–`, `—`, or `=`, assign this profile and label the preview "PRO100 Lista formatek". The user still sees the map, already filled. A first row whose length cell is not numeric is a header row instead, and the synonym map below takes over.

Decoded rows from the checked file:

| Name | L | L mark | W | W mark | Thick. | Qty | Material |
|---|---|---|---|---|---|---|---|
| | 300 | | 650 | | 18 | 2 | |
| | 282 | | 614 | | 18 | 5 | |
| | 2354 | | 282 | | 18 | 2 | |
| Przykład B | 600 | | 1024 | one | 18 | 2 | |
| Przykład C | 590 | | 1024 | one | 18 | 3 | |
| Przykład A | 2390 | one | 600 | | 18 | 4 | |
| Przykład D | 2388 | both | 528 | both | 18 | 2 | |
| Przykład E | 15 | | 15 | | 1024 | 1 | Inne\lustro srebrne |
| Przykład B | 600 | | 1264 | one | 18 | 2 | |
| Przykład C | 590 | | 1264 | one | 18 | 3 | |
| Przykład D | 2388 | both | 648 | both | 18 | 2 | |
| Przykład E | 15 | | 15 | | 1264 | 1 | Inne\lustro srebrne |

With grain lock on for the blank material and the default settings, that file classifies as:

- **Przykład A** — L1. Piece length 2390, `boardWidth` 600, thickness 18, quantity 4. Each piece occupies its own strip (`2390 + 3.2 + 2390 > 2750`). Fill 2390 / 2750 ≥ 0.40, so four order rows of 2760 × 600, or one aggregated row with quantity 4.
- **Przykład B** and **Przykład C** — the only band is on the width, across the grain, so they go on `acrossGrain` strips ripped across the board: piece length is the width column (1024 or 1264), `boardWidth` is the length column (600 for Przykład B, 590 for Przykład C), strip length at most 2030.
- **Przykład D** — exception `finishedPart` (four edges).
- Unnamed rows and **Przykład E** — unbanded strips, also listed in "No banding". It is a 15 × 15 row with no marks.

Turning grain lock off for the blank material keeps the same pieces and widths on ordinary 2760 strips, shared with other parts of that width. Strips are grouped by `boardWidth`, so both cabinets share a group.

### Other layouts

If the Lista formatek test fails, the user maps columns. A column is preselected when its normalized header hits a synonym. Normalization: trim, lowercase, strip Polish diacritics.

| Role | Required | Header synonyms |
|---|---|---|
| Part name | no | nazwa, element, nazwa elementu, opis, name, part |
| Material | no | material, materiał, plyta, płyta, dekor, board, decor |
| Length | yes | dlugosc, długość, dl., length |
| Width | yes | szerokosc, szerokość, szer., width |
| Thickness | no | grubosc, grubość, thickness |
| Quantity | yes | ilosc, ilość, qty, szt, sztuki, quantity |
| Length edge mark | when present | the column after length in the fixed profile |
| Width edge mark | when present | the column after width in the fixed profile |
| Left edge | in 4-edge mode | lewa, lewo, krawedz lewa, L, left |
| Right edge | in 4-edge mode | prawa, prawo, krawedz prawa, P, right |
| Top edge | in 4-edge mode | gora, góra, gorna, krawedz gorna, top |
| Bottom edge | in 4-edge mode | dol, dół, dolna, krawedz dolna, bottom |
| Edges (one column) | in one-column mode | obrzeza, obrzeże, okleina, krawedzie, edges, banding |

Named edge columns still accept a product string. A number in the cell sets thickness (`PCV 2,0 biały` → 2.0 mm) and the label is the whole cell. A marker with no number uses `defaultEdgeThickness` and `defaultEdgeLabel`. An empty cell, `-`, `brak`, `nie`, `no`, or `0` means that edge is bare.

One free-text edge column has no geometry of its own. A value table maps the cell to a mask. The user can edit it. Unknown values skip the row.

| Normalized value (starter table) | Mask |
|---|---|
| empty, `-`, `brak`, `0`, `nie`, `no`, `none` | none |
| `1`, `l1`, `1l`, `jedna`, `dluzsza`, `one`, `longer` | left |
| `2`, `l1l2`, `2l`, `przeciwlegle`, `dwie przeciwlegle`, `opposite` | left + right |
| `2s`, `kat`, `sasiednie`, `dwie sasiednie`, `adjacent` | left + top |
| `3`, `3l`, `trzy`, `three` | left + right + top |
| `4`, `4l`, `dookola`, `dookoła`, `around`, `all` | all four |

The column map and the value table are stored under `stolash.columnMap.v1`. An empty name is kept and shown blank. It is not a skipped row.

### Grain per material

After import, each distinct material has "Keep grain direction".

Suggestion from the name, which the user can override:

- Off when the name contains, ignoring case and Polish diacritics: `bial`, `szar`, `czarn`, `gladk`, `uni`, `jednolit`, `kolor`, `white`, `grey`, `gray`, `black`, `solid`, `color`, `colour`, `lustr`, `mirror`, `szkl`, `glass`. The Polish entries are word stems, so `biały`, `biała` and `białe` all match.
- On otherwise, including unknown decors. The safer default is to keep grain.

The choice is stored in the session.

### Skipped rows

A visible list, one reason per row: bad dimension, bad quantity, unknown edge value, strip width ≤ 0 (possible when `subtractEdge` is on). The skipped count sits above the results. An empty name stays in the result.

Quantity N expands to N pieces of the same name before packing. On the preview, consecutive pieces with the same name on one strip may collapse to "name × n".

## 10. Model

Part after parsing:

- `name`, `material`, `thickness` — thickness from the file, in mm. Missing thickness is allowed and groups as its own bucket
- `length`, `width` — file values, in mm
- `edges` — which of `left | right | top | bottom` are banded
- `edgeLabel`, `edgeThickness` — from the cell or from settings. In v1 every banded edge of one part shares one label and one thickness. If the four columns disagree, the part is an exception with reason `mixedEdgeProducts`
- `grainLock` — from the material

Strip in the result:

- `material`, `thickness`, `edgeL1`, `edgeL2` (`edgeL2` empty for L1 only)
- `stripWidth` — board width to order, mm
- `orderLength` — length to order, mm
- `pieces[]` — name and length occupied on the strip
- `usedLength` — sum of part lengths and kerfs between them
- `offcut` — leftover measured from the ordered length
- `flags` — `short`, `narrow`, `doubled`, `acrossGrain`, `trimTight`

## 11. Order dimensions

`nEdges` is 1 or 2: how many banded edges lie on the strip width (an opposite pair counts as 2).

`perp` is the part dimension perpendicular to the banded edge (the part's width in strip orientation).

```
boardWidth = subtractEdge
  ? perp - nEdges * edgeThickness
  : perp
```

Grouping and the order column "Width" use `boardWidth`. With `subtractEdge` off, the default, it equals the part dimension: milling removes what the banding adds back. With it on, the ordered board is narrower so that the banding brings it to the part dimension.

Example. A side 720 × 560, band on the 720 edge, 0.8 mm edge: piece length 720 and `boardWidth` 560. With `subtractEdge` on, `boardWidth` = 560 − 0.8 = 559.2.

`boardWidth` is rounded to `orderDecimals` only as a group key, half-up. Export writes length and width with that same precision.

`boardWidth` ≤ 0, or `boardWidth` > `maxWidth` (`maxLength` for a strip ripped across the board), removes the part from the strip pool. The exception reason is `widthExceedsBoard` or `nonPositiveWidth`.

## 12. Classification

A left or right edge is parallel to the grain. A top or bottom edge is perpendicular to it.

| Banded edges | Grain lock | Result |
|---|---|---|
| none | either | Unbanded strip. Piece length = `length`, strip width = `width`, nothing subtracted. Also listed in the "No banding" tab |
| one: left or right | either | L1 strip. Piece length = `length`, strip width from `width` |
| one: top or bottom | off | L1 strip. Piece length = `width`, strip width from `length`. An ordinary strip, no flag |
| one: top or bottom | on | Same dimensions, on a strip ripped across the board, flag `acrossGrain` |
| left and right | either | L1+L2 strip. Piece length = `length`, width from `width`, `nEdges` = 2 |
| top and bottom | off | L1+L2 strip. Piece length = `width`, width from `length`. No flag |
| top and bottom | on | Same dimensions, on a strip ripped across the board, flag `acrossGrain` |
| two adjacent | either | Exception `adjacentEdges` |
| three or four | either | Exception `finishedPart` |
| differing edge labels | either | Exception `mixedEdgeProducts` |

A 90° rotation does not move banding onto a different physical edge. One banded edge fixes the strip orientation. Both grain settings give a strip whose length is not the PRO100 length column. With grain lock on it must be ripped across the board; with it off, direction does not matter and the part shares strips with length-banded parts.

A strip ripped across the board keeps the grain. Everywhere in sections 11–13 its `maxLength` is the board's `maxWidth` and its `maxWidth` is the board's `maxLength`: it is ordered at 2030 when full, `L_eff` is 2020, and the short-strip ratio uses that. It has the flag `acrossGrain` and never shares a group with a strip ripped along the board.

Unbanded strips have no L1 or L2, never share a strip with banded parts, and cannot be paired into a double strip. A part wider than `maxWidth` or longer than `maxLength` is an exception like any other.

Packing group key (before narrower parts are fitted):

`material + board thickness + L1 label + L2 label + boardWidth (0.1 mm) + edge thickness + ripped across the board`

Two materials, two board thicknesses, two edge products, or two widths never share a strip.

## 13. Packing

Packing is a pure function: group parts and settings in, strips out. The same input always yields the same strips. Language is not an input.

For each group:

1. Sort pieces by strip length descending. Ties break by name, then by stable input order.
2. A piece longer than `maxLength` is not packed. It becomes exception `longerThanBoard`.
3. A piece longer than `L_eff` and within `maxLength` gets its own full-length strip and flag `trimTight`. Nothing else is added to it.
4. The remaining pieces are packed optimally (branch and bound). A strip holds its pieces when

```
sum of piece lengths + sawKerf * (pieces - 1) ≤ L_eff
```

Kerf sits between pieces, not after the last one.

5. Layouts are ranked in this order:
   1. fewest strips,
   2. shortest total order length (see below),
   3. fullest strips first, which leaves the largest single leftover.

6. The search starts from First Fit Decreasing and stops after a fixed number of steps, never after a time limit. A group too large to finish keeps the best layout found, which is never worse than First Fit Decreasing, and the screen says it is not proven optimal.

Order length:

- Ordinary strip: `orderLength = maxLength`.
- Short strip: only with `shortStrips` on, when `usedLength / L_eff < shortStripRatio`,

```
orderLength = usedLength + trimAllowance
```

and the flag is `short`. One piece, no kerf, and 10 mm trim orders at piece length + 10. The "820" figure in the original notes is an illustration, not the formula.

Preview offcut on a full strip: `maxLength - usedLength`. On a short strip: `trimAllowance` (the squaring allowance, not an empty banded tail).

### Narrow strip

When `boardWidth < minStripWidth`, every strip in the group gets `narrow`. The order stays single-width (L1, or L1+L2 already required by the part).

### Double strip

The workshop may order one strip banded on both long edges and rip it in half itself. "Pair into a double strip" is available for any one-edge (L1) group with at least two full-length strips, narrow or not, when

```
2 * boardWidth + sawKerf ≤ maxWidth
```

and the group is not already L1+L2 from two edges of the part. After the user turns it on, and only for full-length strips of that group:

- two full strips become one order row,
- ordered width = `2 * boardWidth + sawKerf`,
- L1 and L2 are the same label,
- length = `maxLength`,
- the number of those rows = `floor(full strip count / 2)`,
- a leftover full strip stays single, still flagged,
- short strips stay single, still flagged.

The cut map still lists each narrow strip and adds the note for `doubledStrip`: rip the double blank lengthwise first. Turning the action off restores the single-width order. The choice is stored in the session per group key.

### Narrower parts on wider strips

When `fitNarrower` is on, a second step runs after packing. Parts may move into the leftover of a strip at least as wide, with the same material, thickness, L1 product, edge thickness, grain direction and board direction. The shop rips such a part to width from the side without banding, so only L1 and unbanded strips take part. Strip by strip, least ordered first, parts are moved out, and the moves are kept only when the ordered area (width × order length, over all strips) gets smaller. Emptied strips are dropped. Drawings show each rip as a shop cut, and the piece list says the width to rip to.

### Strips on whole boards

The aim is the fewest whole boards, then the fewest meters of wholesaler cuts.

Strips of one material and board thickness share boards of `maxLength` × `maxWidth`, with the grain along the length. A strip is a rectangle that is never rotated against the grain: along-grain and across-grain strips may share a board, lying at right angles. A doubled pair is one blank of width `2 * boardWidth + sawKerf`. Every cut is a guillotine cut, edge to edge of the piece it divides, and costs `sawKerf`.

The layout is a deterministic heuristic: several item orders and placing rules, then seeded random variations, keeping the best by the aim above. It is not proven optimal.

### Versions

With `fitNarrower` on, three strip sets are tried: plain, with narrower parts fitted, and with strips also joined (two strips become one when one fits whole into the leftover of an equally wide or wider one and the boards or cut meters improve, even if the joined strip orders more length; the most similar widths are tried first and the number of tries is capped). Each set keeps a few near-best layouts both for the shortest cuts and for the largest leftovers.

Up to three different results are offered, never two with the same figures:

1. fewest wholesaler cut meters,
2. most reusable leftover area, then the largest single leftover,
3. fewest meters of the shop's own cuts.

When `shortStrips` is off, one more version follows, labelled "short strips": every part-filled strip is ordered at the length of its parts plus trim, ranked like goal 1. It is listed after the others and is never the default, even when it needs fewer boards.

The three goals compare only layouts with the strip lengths as set. All rank fewest boards first. A layout that wins several goals is listed once under all of them, and other different layouts fill the list as alternatives. The first is the default.

A table above the results shows, per version, boards, wholesaler cut meters, shop cut meters, waste, reusable leftover area and the largest leftover. Any column sorts it, best first. The chosen version drives the order, drawings, export and print, and is stored in the session. Waste is board area that ends up in no part, so versions with the same board count differ in how the waste is split rather than in its total.

## 14. Views

One page. Layout aimed at a wide shop monitor. A narrow window may scroll tables horizontally. Tailwind CSS, compiled at build time. No separate visual system.

The header shows the product name and a menu button. The menu contains the language control (section 7), "Reset preferences", and "Clear session".

The page is three numbered steps in cards:

1. **Import.** A drop zone and a paste area. After load: row count, profile, encoding and skipped count.
2. **Set up**, in tabs: Elements, Materials, Board and saw (`maxLength`, `maxWidth`, `sawKerf`, `trimAllowance`), Edge banding (`defaultEdgeThickness`, `defaultEdgeLabel`, `subtractEdge`), Optimisation (the other settings), and Columns (encoding, delimiter, preview of the first 5 rows, column map, one-column edge value table). The parameter tabs work without a file. The Columns tab needs the file in memory, so after a reload it asks for the file again.
3. **Results**, shown once generated: the versions table, then the result tabs.

Under all the settings, and kept in view while scrolling, is one button with a line of explanation:

| State | Button |
|---|---|
| No file, or no element ticked | "Generate cut lists", disabled |
| Not generated yet | "Generate cut lists" |
| Elements, materials or parameters differ from the last generation | "Update cut lists" |
| Nothing differs | "Up to date", disabled |

The shown result is always calculated from the inputs of the last generation. Choosing a version, pairing double strips and switching language act on it directly. A column map change reads the table again and needs a new generation.

### Element selection

Every parsed row is listed with name, material, dimensions, quantity, edges and a checkbox, all ticked by default, with "Select all" and "Select none". It is the first setup tab. A row is included or left out with its whole quantity. The choice is stored in the session. Changing the column map ticks everything again.

### Parameters

The fields from section 8, with mm beside each length. An invalid value is not saved and shows the reason on the field.

### Strip drawings

Each strip is a numbered SVG drawn on the board length, so lengths and widths compare by eye. A very narrow strip is drawn taller than scale. Part rectangles show the name and size, with both in `title`. Banded edges are drawn as a colored line, L1 at the bottom and L2 at the top. The offcut sits at the end. Above the drawing: material, width, order length, L1, L2, flags. Below: the cut sequence, for example `720 + kerf 3.2 + 564` in English and `720 + rzaz 3,2 + 564` in Polish.

Strips are drawn once, in the Strips tab. Above the tabs there is only the choice of which groups to pair into double strips.

### Tab "Strip order"

One row per identical strips (same aggregated quantity, length, width, thickness, material, L1, L2, remarks).

| Column | Content |
|---|---|
| Quantity | count of identical strips |
| Length | `orderLength` |
| Width | `boardWidth`, or the doubled width |
| Thickness | board thickness from the file |
| Material | name from the file, or the translated "(no material)" |
| Edge L1 | `defaultEdgeLabel` for a Lista formatek file |
| Edge L2 | label, or empty |
| Remarks | short strip, narrow strip, double strip, across grain, trim allowance short |

Buttons: "Copy" (TSV with a header, decimals for the active locale), "Download CSV" (rules in section 7), "Download XLSX" (SheetJS, one sheet). Sheet names: `Strips` / `Pasy`.

Polish column headers: Ilość, Długość, Szerokość, Grubość, Materiał, Okleina L1, Okleina L2, Uwagi.

### Tab "Finished parts"

Exceptions and their reason ids, rendered in the active language. Columns: name, material, thickness, length, width, quantity collapsed again, edges, reason. Same export actions. Sheet: `Parts` / `Formatki`.

### Tab "No banding"

Unbanded parts, quantity collapsed. Short note that they are cut from unbanded strips. Same export. Sheet: `Unbanded` / `Bez okleiny`.

### Tabs "Cut map" and "Strips"

First every board to scale, with its parts labelled by strip number, length, width and name. A wavy line marks each banded edge, `-` or `=` after the length says one or two, waste is hatched, and a caption gives material, thickness, board number and size, waste share, and the wholesaler's and the shop's cut counts with their lengths. "Strips" is its own tab: every strip, drawing plus piece list.

### Who does what

The wholesaler delivers every strip, banded or not, and the elements that come whole (`finishedPart`, `adjacentEdges`, `mixedEdgeProducts`). The shop crosscuts parts from the strips and rips double strips. The cut map starts with those counts, a drawing of each whole element, and a list of anything that is neither (too long, too wide, no width left). Drawings show a blue outline around what is delivered and a red dashed line for each shop cut, and every strip says in words who does what.

### Print

A print panel above the results has a checkbox each for who does what, strip order, finished parts, no banding, board drawings and strip drawings, all ticked by default, and one "Print" button that calls `window.print()`. The print layout is A4 portrait and holds only the ticked sections, each starting on a new page. The browser's own print command prints the same. The user saves PDF from the browser print dialog. Printed labels use the active language.

### Session

`stolash.session.v1` stores the parsed parts, grain choices, double-strip toggles, and a timestamp. Reload restores the last generated result and the inputs. "Clear session" removes that key and keeps settings, the column map, and the language.

## 15. GitHub Pages architecture

The app is written in TypeScript with React and built by Vite into static files in `dist/`. GitHub Actions runs the tests and the build, and publishes `dist/` from `main` to GitHub Pages. Tool versions are managed by mise, dependencies by Yarn.

Layout:

- `index.html` — shell
- `src/i18n/` — `en` and `pl` dictionaries and `t(locale, id)`
- `src/core/parse.ts` — decoding, delimiter, PapaParse, mapping
- `src/core/classify.ts` — classification and dimensions
- `src/core/pack.ts`, `binpack.ts` — optimal packing
- `src/core/order.ts` — double strips and order rows
- `src/store/` — `ProjectStore` (section 16)
- `src/ui/` — React components, events, SVG, export, print, menu

`classify.ts` and `pack.ts` do not touch the DOM, `localStorage`, or the dictionaries. They return reason ids.

Pinned dependencies, bundled into the build and locked by `yarn.lock`:

- PapaParse 5.4.1 — parse the decoded text
- SheetJS `xlsx` 0.18.5 — export only
- Tailwind CSS 4

Nothing is loaded from a CDN. The shop machine needs a network only to load the app itself. The user's file is not sent anywhere.

No analytics, no networked form, no service worker in v1.

## 16. Seam for Supabase

v1 has one storage interface. The v1 implementation is `LocalStore`. Views do not call `localStorage` or Supabase themselves.

```
ProjectStore
  loadSettings() -> Settings
  saveSettings(settings) -> Promise
  loadColumnMap() -> ColumnMap
  saveColumnMap(map) -> Promise
  loadLocale() -> "en" | "pl" | null
  saveLocale(locale) -> Promise
  loadSession() -> Session | null
  saveSession(session) -> Promise
  clearSession() -> Promise
```

`Session` holds mapped parts, grain choices, double-strip flags, and a timestamp. It does not hold the raw file text. Locale is separate from the session.

When the cloud phase starts, a second implementation of this interface arrives, plus methods v1 does not pretend to have:

- `listProjects`, `saveProject`, `loadProject`, `deleteProject`
- sign-in (magic link)
- `projects` table: `id`, `user_id`, `name`, `settings`, `column_map`, `locale`, `session`, `updated_at`
- RLS: a row is visible only when `user_id = auth.uid()`
- conflict rule for that phase: last write wins

Strip math stays in the browser. Supabase stores the project. It does not receive the CSV for server-side processing. GitHub Pages still hosts the app. The Supabase key in the static front end is the public key, and RLS limits access.

Until that phase the repo has no Supabase client, no environment variables, and no cloud project.

## 17. Acceptance criteria

`subtractEdge` off. `shortStrips` on (the default is off, which orders every strip at full length). Thickness 0.8 mm. `maxLength` 2760. `trimAllowance` 10. `sawKerf` 3.2. `L_eff` 2750. Short-strip threshold 0.40. Grain lock on. One edge product "PCV 0,8 biały" on the length edge, unless the scenario says otherwise.

1. Pieces 2100, 720, 720, and 564 of the same width produce two strips. The first holds 2100 + 3.2 + 564 = 2667.2. The second holds 720 + 3.2 + 720 = 1443.2. Both are ordered at 2760, because 1443.2 / 2750 ≥ 0.40. Order width = part width − 0.8.
2. A single 800 mm piece produces one strip flagged `short`, ordered at 810.
3. A 2800 mm piece becomes `longerThanBoard`. It is absent from the strip order.
4. A side banded on the 720 length, width 560, is a strip with piece length 720. The same part banded on both length edges (left and right) is L1+L2 with `boardWidth` = 560. Banding on the length and the width is `adjacentEdges`. Banding on three or four edges is `finishedPart`. No banding goes to "No banding" and onto an unbanded strip.
5. Banding only on the top or bottom forms a strip whose piece length equals the file width, With grain lock on it is flagged `acrossGrain`, ordered at most 2030 long, and a piece over 2030 is `longerThanBoard`. With grain lock off it is an ordinary strip, up to 2760 long.
6. Two widths, two materials, two board thicknesses, or two edge labels do not share a strip.
7. The sample `lista formatek` CSV decodes as Windows-1250, shows names with Polish characters correctly, and is recognized as the Lista formatek profile with no header. The tab TXT of the same report parses to the same 12 rows. A bad quantity is on the skipped list, and the other rows still produce a result.
8. A 50 mm strip width is flagged `narrow`. After pairing, two full strips become one row of width 50 + 50 + 3.2 = 103.2 with L1 and L2. A third full strip stays single.
9. Reload restores parameters, the column map, the last session, and the language. "Clear session" removes the result and keeps parameters and language. The browser network log shows no request carrying the CSV body.
10. The Polish CSV opens in Excel with Polish characters, semicolons, and comma decimals. The English CSV uses comma delimiters and dot decimals. The printed cut map has no import zone.
11. On a fresh profile with an English browser language, the UI is English. Choosing **Polski** in the header menu switches every chrome string, tab, remark, and export header without changing strip counts or ordered millimeters. Reload keeps Polish. Imported material names stay as they were in the file. The same coverage holds in the other direction.
12. On the sample Lista formatek file, with grain lock left on and `subtractEdge` off: the only banded strip order is quantity 4 of 2760 × 600 × 18, L1 set to the default edge label, material blank. The unbanded strip orders, with L1 and L2 empty, are 1 of 2760 × 650 (the five 614-wide parts are ripped from it), 2 of 2760 × 282, and 1 of 25 × 15 for each `Przykład E` row. Przykład B and C give `acrossGrain` orders of 4 × 2030 × 600 and 6 × 2030 × 590. Both door rows are `finishedPart`. The unnamed rows and both `Przykład E` rows are listed as unbanded.

## 18. Open questions

1. The **Lista elementów** tab is not in the sample. v1 targets **Lista formatek**. A later export of the other tab can add a second profile.
2. Whether the wholesaler (e-Rozkrój or another) wants integer millimeters. v1 exports one decimal place.
3. Whether the 10 mm trim stays on a short strip. v1 adds `trimAllowance` to the short strip so the ends can still be squared.
4. Board rows in the sample have an empty material with **Pokaż katalogi materiałów** checked. v1 groups those rows together and shows thickness. A later sample with real board names (`Biały 18mm`, `Dąb Hikora`) should fill the material column without a parser change.

## 19. After this document

v1 ends at local calculation and export, in both languages. The cloud phase will add auth, schema, and RLS in a follow-up document. Sections 11–13 stay as they are.
