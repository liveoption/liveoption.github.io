import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = filename => fs.readFileSync(path.join(root, filename), 'utf8');
const context = { window: {} };
vm.runInNewContext(read('js/locales.js'), context);
const locales = context.window.LO_LOCALES;
const keys = Object.keys(locales.en).sort();
const tokens = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
for (const language of ['en', 'cn', 'jp']) {
  assert.deepEqual(Object.keys(locales[language]).sort(), keys, `${language}: missing or extra keys`);
  for (const key of keys) {
    assert.equal(typeof locales[language][key], 'string', `${language}.${key}`);
    assert.ok(locales[language][key].trim(), `Empty ${language}.${key}`);
    assert.deepEqual(tokens(locales[language][key]), tokens(locales.en[key]), `Placeholder mismatch: ${language}.${key}`);
  }
}
for (const filename of ['index.html', 'demos.html']) {
  const html = read(filename);
  for (const [, key] of html.matchAll(/data-i18n(?:-[\w-]+)?="([\w.-]+)"/g)) {
    assert.ok(locales.en[key], `${filename}: unknown translation ${key}`);
  }
  assert.ok(html.includes('data-language-select'), `${filename}: missing language selector`);
  assert.equal(html.split('sc_project=13361926').length, 2, `${filename}: analytics count`);
}
for (const filename of ['js/playground.js', 'js/results.js', 'js/charts.js']) {
  const code = read(filename);
  for (const [, key] of code.matchAll(/(?:\bt|labelKey):?\(?\s*'([\w.-]+)'/g)) {
    assert.ok(locales.en[key], `${filename}: unknown translation ${key}`);
  }
}
const scenarios = JSON.parse(read('data/scenarios/index.json'));
for (const scenario of scenarios) {
  for (const field of ['title', 'blurb']) assert.ok(locales.en[`scenario.${scenario.id}.${field}`]);
}
console.log(`PASS: ${keys.length} keys × 3 languages, matching placeholders, HTML references, scenario copy and analytics.`);
