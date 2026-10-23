# LiveOption website

Static project website with benchmark results, figures, and recorded model demos.
No API key or backend is needed.

- `index.html`: project overview with task demo links and collapsible results.
- `demos.html`: recorded demos, selected by task, scenario and build.
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
