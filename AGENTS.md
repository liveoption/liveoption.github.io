# Website development

- Support English (`en`), Simplified Chinese (`cn`), and Japanese (`jp`) for every new user-facing feature. HTML language tags are `en`, `zh-CN`, and `ja`.
- Add all UI copy to `js/locales.js` using stable semantic keys in all three locale dictionaries. Keep interpolation tokens identical. Do not hard-code new interface strings in JavaScript.
- Static copy uses `data-i18n`; translated attributes use `data-i18n-title`, `data-i18n-aria-label`, `data-i18n-alt`, or `data-i18n-content`. Keep English fallback text in HTML.
- Dynamic features use `window.LOI18n.t(key, parameters)` and update on `lo:languagechange`. Preserve the current task, scenario, build, sort order and expanded observation when switching languages.
- Use `LOI18n.number` and `LOI18n.date` for formatted UI values. Keep source data identifiers and numerical results unchanged.
- Keep language selection in the shared navigation of every page. Retain `lang` in internal links and preserve existing task/scenario parameters.
- Benchmark prompts, model reasoning, order identifiers, model names, citations and embedded paper figures remain original research artifacts. Label original-language content explicitly; never silently rewrite recorded evidence.
- Run `node scripts/check-i18n.mjs` plus syntax checks for edited JavaScript. Verify both pages in all three languages, language persistence, dynamic labels, cross-page links and narrow-screen layout.
- Retain the invisible Statcounter integration on every public page.
