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
