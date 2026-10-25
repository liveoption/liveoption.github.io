# LiveOption website

Static project website with benchmark results, figures, and recorded model demos.
No API key or backend is needed.

- `index.html`: project overview, scenario guide dialogs, three interactive benchmark charts, a QFinZero infrastructure section, the arXiv citation and collapsible detailed results.
- `demos.html`: recorded demos, selected by task, scenario and model. All eight models share one selector and opening comparison. Source builds remain internal provenance; reference inputs remain accessible by model and input differences are marked. Views separate the opening comparison, historical candles, paginated decision journal and run-level statistics.
- Both pages use the invisible Statcounter project `13361926`.

The Code buttons are intentionally disabled until a repository URL is supplied.

## Preview

```sh
python3 -m http.server 8788 --bind 127.0.0.1
```

Open http://127.0.0.1:8788/.

## GitHub Pages

Publish this repository as `liveoption/liveoption.github.io`.
In Settings → Pages, select **Deploy from a branch**, **main**, **/ (root)**.
The site will be available at https://liveoption.github.io/.

Edit the static files and push to main to update the website.

## Languages and future features

Both pages support English (`en`), Simplified Chinese (`cn`), and Japanese (`jp`).
The navigation selector remembers the choice; `?lang=cn` or `?lang=jp` shares a
specific language and works alongside demo task/scenario parameters. The initial
language follows an explicit URL, then a saved preference, then the browser.

`js/locales.js` holds the three matching message dictionaries. `js/i18n.js`
provides `LOI18n.t`, `number`, `date`, `apply`, and `setLanguage`.
Use semantic keys with `data-i18n` in HTML, and rerender dynamic interface labels
on `lo:languagechange`. See `AGENTS.md` for the requirements for future work.

Benchmark inputs, model replies, order identifiers, model names, citations and
paper figures remain in their original language, with explanatory labels.

```sh
node scripts/check-i18n.mjs
```

Scenario guides are implemented in `js/scenes.js`. Their original SVG diagrams
are conceptual illustrations; all captions and guide text are localized.

`js/homepage.js` draws mean/median returns and confidence intervals, overlay
return/drawdown trade-offs, and earnings structure composition directly from
`data/results.json`. Model highlighting and task/mandate selections persist
across language switches. Source results are not modified. The QFinZero section
links to the official project and its UPQ, ESP and PMB documentation; it does not
contact any financial service from this static website.

## Archived replay data

`js/replay.js` loads one model/run at a time from `data/replays/` and historical
OHLCV from `data/market/`. All records are from the existing five benchmark
cases. No model inference, brokerage writes or synthetic decisions occur.
Later observations are model-specific and must not be presented as a shared
prompt comparison. Proposed orders and recorded fills remain separate.

Run statistics use the first saved equity snapshot as their baseline.
Drawdown uses each day's last saved snapshot. The underlying return is a price-only
reference indexed to its first stored price, without option exposure or fees.
These selected-case views do not replace panel-wide benchmark statistics.

The public export includes original response text and prompt hashes, but not
later full observations, credentials, account identifiers or server paths.
The existing opening observation remains available in the comparison header.
JSON downloads contain background, settings and results for the selected run.

Regenerate on the archive host with Python 3.11+ (read-only source access):

```sh
python3 scripts/export-replays.py \
  --archive /path/to/release/main \
  --gateway /path/to/aligned/gateway/output \
  --scenarios data/scenarios \
  --out /path/to/exported-data \
  --hub http://127.0.0.1:19777
```

Copy the generated `replays/` and `market/` directories under `data/`, then run:

```sh
node scripts/check-i18n.mjs
node scripts/check-replays.mjs
node --check js/replay.js
```

The exporter rejects missing cases/prices and potential credentials, rather
than inventing replacement records. Missing or unverified completion is labeled
explicitly in the interface. Invisible Statcounter integration is unchanged.
