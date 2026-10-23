/* Shared localization API for every page and future feature. */
(function () {
  'use strict';
  const locales = window.LO_LOCALES;
  const languages = { en: 'en', cn: 'zh-CN', jp: 'ja' };
  const aliases = { en: 'en', cn: 'cn', zh: 'cn', 'zh-cn': 'cn', jp: 'jp', ja: 'jp' };
  const storageKey = 'liveoption.language';
  const normalize = value => aliases[String(value || '').toLowerCase()]
    || aliases[String(value || '').toLowerCase().split('-')[0]];
  let stored;
  try { stored = localStorage.getItem(storageKey); } catch (_) { /* Storage may be blocked. */ }
  let language = normalize(new URL(location.href).searchParams.get('lang'))
    || normalize(stored) || normalize(navigator.language) || 'en';

  function t(key, parameters = {}) {
    const template = locales[language]?.[key] ?? locales.en[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (match, name) => String(parameters[name] ?? match));
  }

  function number(value, digits = 0, signed = false) {
    return new Intl.NumberFormat(languages[language], {
      minimumFractionDigits: digits, maximumFractionDigits: digits,
      useGrouping: false, signDisplay: signed ? 'exceptZero' : 'auto',
    }).format(value);
  }

  function date(value) {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime())) return value;
    return new Intl.DateTimeFormat(languages[language], {
      year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
    }).format(parsed);
  }

  function localizeLinks() {
    document.querySelectorAll('a[href]').forEach(link => {
      const original = link.dataset.localeHref || link.getAttribute('href');
      if (!original || original.startsWith('#')) return;
      const url = new URL(original, location.href);
      if (url.origin !== location.origin || !/(?:\.html|\/)$/i.test(url.pathname)) return;
      link.dataset.localeHref = original;
      url.searchParams.set('lang', language);
      link.href = url.href;
    });
  }

  function apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(element => {
      element.textContent = t(element.dataset.i18n);
    });
    ['title', 'aria-label', 'alt', 'content'].forEach(attribute => {
      root.querySelectorAll(`[data-i18n-${attribute}]`).forEach(element => {
        element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
      });
    });
    document.querySelectorAll('[data-language-select]').forEach(select => { select.value = language; });
    localizeLinks();
  }

  function setLanguage(value, updateURL = true) {
    const next = normalize(value);
    if (!next) return;
    language = next;
    document.documentElement.lang = languages[language];
    try { localStorage.setItem(storageKey, language); } catch (_) { /* Optional preference storage. */ }
    if (updateURL) {
      const url = new URL(location.href);
      url.searchParams.set('lang', language);
      history.replaceState(null, '', url);
    }
    apply();
    window.dispatchEvent(new CustomEvent('lo:languagechange', { detail: { language } }));
  }

  document.documentElement.lang = languages[language];
  window.LOI18n = Object.freeze({
    t, number, date, apply, setLanguage,
    get language() { return language; },
    get locale() { return languages[language]; },
  });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-language-select]')) setLanguage(event.target.value);
  });
  // A shared URL wins on navigation; storage events synchronize already-open tabs.
  window.addEventListener('storage', event => {
    if (event.key === storageKey && normalize(event.newValue)) setLanguage(event.newValue);
  });
  window.addEventListener('popstate', () => {
    const requested = normalize(new URL(location.href).searchParams.get('lang'));
    if (requested && requested !== language) setLanguage(requested, false);
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setLanguage(language, false), { once: true });
  } else setLanguage(language, false);
})();
