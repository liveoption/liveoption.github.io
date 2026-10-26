# Website development

- Support English (`en`), Simplified Chinese (`cn`), and Japanese (`jp`) for every new user-facing feature. HTML language tags are `en`, `zh-CN`, and `ja`.
- Add all UI copy to `js/locales.js` using stable semantic keys in all three locale dictionaries. Keep interpolation tokens identical. Do not hard-code new interface strings in JavaScript.
- Static copy uses `data-i18n`; translated attributes use `data-i18n-title`, `data-i18n-aria-label`, `data-i18n-alt`, or `data-i18n-content`. Keep English fallback text in HTML.
- Dynamic features use `window.LOI18n.t(key, parameters)` and update on `lo:languagechange`. Preserve the current task, scenario, model, sort order and expanded observation when switching languages. Present all models together; source builds are internal provenance, not a UI filter.
- Use `LOI18n.number` and `LOI18n.date` for formatted UI values. Keep source data identifiers and numerical results unchanged.
- Keep language selection in the shared navigation of every page. Retain `lang` in internal links and preserve existing task/scenario parameters.
- Benchmark prompts, model reasoning, order identifiers, model names, citations and embedded paper figures remain original research artifacts. Label original-language content explicitly; never silently rewrite recorded evidence.
- Run `node scripts/check-i18n.mjs` plus syntax checks for edited JavaScript. Verify both pages in all three languages, language persistence, dynamic labels, cross-page links and narrow-screen layout.
- Retain the invisible Statcounter integration on every public page.

## Editorial style

- Write short, factual research copy. Headings should name the subject or function; avoid slogans, rhetorical questions and repeated invitations to explore.
- Use natural Chinese, English and Japanese rather than literal translations. Prefer concrete descriptions over phrases such as “从 X 到 Y”, “统一环境” or “真实完整”.
- Keep metric definitions and data limitations precise. Do not rewrite model outputs, prompts, paper titles, citations or recorded results when editing interface copy.
