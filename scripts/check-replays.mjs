import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const entries = read('data/replays/index.json');
const scenarios = read('data/scenarios/index.json');
let decisions = 0, fills = 0;
const close = (a,b) => assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(a)), `${a} != ${b}`);
for (const entry of entries) {
  assert.match(entry.path, /^[a-zA-Z0-9_./-]+\.json$/);
  const replay = read('data/replays/' + entry.path);
  assert.equal(replay.source, 'archived_run_logs');
  assert.equal(replay.scenario, entry.scenario);
  assert.equal(replay.model, entry.model);
  assert.equal(replay.build, entry.build);
  const scenario = read(`data/scenarios/${entry.scenario}.json`);
  const group = scenario.groups.find(item => item.build === entry.build);
  const answer = group.answers.find(item => item.model === entry.model);
  assert.equal(replay.decisions[0].time, group.ts);
  assert.equal(replay.opening_prompt_matches_group, answer.samePrompt);
  assert.equal(replay.decisions.length, entry.decisions);
  assert.equal(replay.daily.length, entry.days);
  assert.equal(replay.fills.length, entry.fills);
  assert.equal(replay.equity[0].equity, replay.baseline.equity);
  const final = replay.equity.at(-1).equity;
  close(final - replay.baseline.equity, replay.summary.net_pnl);
  close(final / replay.baseline.equity - 1, replay.summary.return);
  close(replay.daily.reduce((sum, day) => sum + day.pnl, 0), replay.summary.net_pnl);
  close(replay.fills.reduce((sum, fill) => sum + (fill.fees || 0), 0), replay.summary.fees);
  for (const fill of replay.fills) assert.ok(Number.isFinite(fill.fees), 'Missing fill fee: do not present an assumed zero');
  let peak = replay.baseline.equity;
  for (const day of replay.daily) {
    peak = Math.max(peak, day.equity);
    close(day.drawdown, day.equity / peak - 1);
    assert.equal(day.decisions, replay.decisions.filter(record => record.day === day.day).length);
    assert.equal(day.fills, replay.fills.filter(fill => fill.day === day.day).length);
  }
  replay.decisions.forEach((record, index) => {
    assert.equal(record.seq, index);
    assert.ok(Number.isFinite(Date.parse(record.time)));
    assert.ok(record.calls.length);
    record.calls.forEach(call => assert.match(call.prompt_sha256, /^[a-f0-9]{64}$/));
  });
  const text = JSON.stringify(replay);
  assert.ok(!/sk-[a-zA-Z0-9_-]{32,}|BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY|\/data\/haoluo\//.test(text), entry.path);
  decisions += replay.decisions.length; fills += replay.fills.length;
}
for (const scenario of scenarios) {
  const market = read(`data/market/${scenario.id}.json`);
  assert.equal(market.source, 'qfinzero.upq');
  assert.ok(market.bars.length);
  assert.equal(market.ticker, scenario.ticker);
  for (const bar of market.bars) {
    for (const key of ['open','high','low','close','volume']) assert.ok(Number.isFinite(bar[key]), `${scenario.id}.${key}`);
    assert.ok(bar.low <= Math.min(bar.open,bar.close) && bar.high >= Math.max(bar.open,bar.close));
  }
  for (const group of scenario.builds) for (const model of group.models) assert.ok(entries.some(entry => entry.scenario === scenario.id && entry.build === group.build && entry.model === model));
}
console.log(`PASS: ${entries.length} archived runs, ${decisions} decisions, ${fills} fills, 5 price series; source, statistics, fees, dates and credential checks.`);
