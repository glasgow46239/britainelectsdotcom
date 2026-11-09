# britainelectsdotcom

The Britain Elects website: poll trackers built on one shared template.

## How it fits together

| Piece | Lives in | Does |
|---|---|---|
| Data | `glasgow46239/benma` | Nightly Action smooths the polls and `pipeline/export_page.py` writes `page.json` + `page-<group>.json` per tracker; `pipeline/articles.py` writes `site/articles.json` from the Substack feed |
| Look | `glasgow46239/style` | `be.css`, `be.js` and the logo files: colours, type, party names |
| Template | `assets/` here | `site.js` (header and footer), `site.css` (layout), `tracker.js` (cards, charts, comparison, articles) |
| Pages | e.g. `index.html`, `leaders/burnham/` | A thin HTML file with its own headline, labels and ranges in `<script id="tracker-config">` |

A change to `assets/` or to the style guide reaches every page on the next load.

## Adding a tracker page

1. In benma, give the tracker's `config.json` a `"page"` block (see the docstring in `pipeline/export_page.py`).
2. Here, copy `leaders/burnham/index.html` (leader) or `index.html` (voting intention) to a new folder, fix the relative `assets/` paths, and edit the JSON in `tracker-config`: `tracker`, `headline` or `person`, `among`, `ranges`, `markers`, `note`, `articles`.

## Chart heights

Set in `assets/site.css`, under "CHART HEIGHTS": `.tr-plot` (main chart) and `.tr-plot.cmp` (comparison chart), with a phone-size override in the media query below them. The charts redraw to whatever height the CSS gives.

## Page settings (`tracker-config`)

- `type`: `vi`, `leader`, or `leaders` (several leaders ranked; reads `source`, e.g. `site/leaders/`, which benma builds from `pages/leaders.json`)
- `tracker`: the benma tracker folder
- `headline` (vi), or `person` and `role` (leader)
- `among`: the label beside the dropdown
- `ranges`: time-range buttons, each `{ "label", "from"? }` or `{ "label", "days" }` (counted back from the latest data); `defaultRange` is an index
- `seeAlso` (leader): `{ "label", "href" }`, a link under the cards
- `markers`: vertical lines, `[date, label, short label?]`
- `note`: method note; `{bw}` is replaced by the smoothing window
- `compare` (leader): `title`, `dek`, `ranges` in days, `foot`; wording via `whoLabel`, `whoPlural`, `dayPhrase` ("in office" / "as leader"), `axis`, `left` ("Left office" / "Stood down")
- `articles`: `{ "match": regex or null, "kicker", "party" }`
- `dataBase` (optional): where to read benma from; defaults to its `main` branch on GitHub

`?group=scotland` in the address opens a page on that group.
