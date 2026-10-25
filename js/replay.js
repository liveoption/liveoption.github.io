/* Public, static replay of archived records. No inference or trading endpoints. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const { t, number, date } = window.LOI18n;
  const host = $('replay-host'), tabs = $('replay-tabs'), opening = $('opening-panel');
  if (!host || !tabs || !opening) return;
  const views = ['opening', 'market', 'journal', 'stats'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (value, digits = 2, signed = false) => typeof value === 'number' && Number.isFinite(value) ? number(value, digits, signed) : '—';
  const percent = value => typeof value === 'number' ? `${fmt(value * 100, 2, true)}%` : '—';
  const params = new URLSearchParams(location.search);
  let view = views.includes(params.get('view')) ? params.get('view') : 'market';
  let chartView = 'price', model = params.get('model'), recording, run, prices, selected = 0, page = 0, ledgerPage = 0;
  let dayFilter = '', filter = 'all', rawOpen = false, loading = false, failed = false, generation = 0;
  const clock = time => {
    const parsed = Date.parse(time);
    return Number.isFinite(parsed) ? new Intl.DateTimeFormat(window.LOI18n.locale, {timeZone:'America/New_York', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).format(parsed) : '—';
  };
  const stamp = row => `${date(row.day)} · ${clock(row.time)} ET`;
  function urlState() {
    const url = new URL(location.href);
    url.searchParams.set('view', view);
    if (model) url.searchParams.set('model', model);
    if (recording) url.searchParams.set('build', recording.build.build);
    history.replaceState(null, '', url);
  }
  async function read(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(t('replay.dataError', {status:response.status}));
    return response.json();
  }
  const pager = (current, total, count, kind) => `<div class="replay-pager"><span>${esc(t('replay.page', {count:number(count), page:number(current + 1), pages:number(total)}))}</span><div><button type="button" class="btn btn-sm" data-page="${kind}" data-offset="-1" ${current === 0 ? 'disabled' : ''}>${esc(t('replay.previous'))}</button><button type="button" class="btn btn-sm" data-page="${kind}" data-offset="1" ${current + 1 >= total ? 'disabled' : ''}>${esc(t('replay.next'))}</button></div></div>`;
  const scrolling = content => `<div class="replay-scroll" tabindex="0" role="region" aria-label="${esc(t('replay.scroll'))}">${content}</div>`;
  const card = (key, value) => `<div class="replay-kpi"><span>${esc(t(key))}</span><strong>${esc(value)}</strong></div>`;

  async function load() {
    const current = ++generation;
    loading = true; failed = false; run = null; prices = null;
    selected = page = ledgerPage = 0; dayFilter = ''; filter = 'all'; rawOpen = false;
    render(); urlState();
    try {
      const scenario = recording.scenario.id, build = recording.build.build;
      const data = await Promise.all([
        read(`data/replays/${encodeURIComponent(scenario)}/${encodeURIComponent(build)}/${encodeURIComponent(model)}.json`),
        read(`data/market/${encodeURIComponent(scenario)}.json`),
      ]);
      if (generation !== current) return;
      if (!data[0].equity?.length || !data[0].daily?.length || !data[0].decisions?.length) throw new Error('Invalid archived run');
      [run, prices] = data;
      const firstDay = run.daily[0].day, lastDay = run.daily.at(-1).day;
      prices = {...prices, bars:prices.bars.filter(bar => {
        const day = bar.time.slice(0, 10);
        return day >= firstDay && day <= lastDay;
      })};
      selected = run.decisions[0]?.seq ?? 0;
    } catch (_) {
      if (generation === current) failed = true;
    } finally {
      if (generation === current) { loading = false; render(); }
    }
  }

  function renderTabs() {
    tabs.hidden = !recording;
    tabs.innerHTML = views.map(id => `<button type="button" data-view="${id}" class="${id === view ? 'on' : ''}" aria-pressed="${id === view}">${esc(t(`replay.${id}`))}</button>`).join('');
    opening.hidden = view !== 'opening';
    host.hidden = view === 'opening';
  }

  function render() {
    if (!recording) return;
    renderTabs();
    const models = recording.build.answers.map(answer => answer.model);
    const toolbar = `<div class="replay-toolbar"><label>${esc(t('replay.model'))}<select id="replay-model">${models.map(id => `<option value="${esc(id)}" ${id === model ? 'selected' : ''}>${esc(recording.models[id]?.name || id)}</option>`).join('')}</select></label><button class="btn btn-sm" type="button" id="replay-download" ${!run ? 'disabled' : ''}>${esc(t('replay.download'))}</button></div>`;
    if (loading || failed || !run) {
      host.innerHTML = `<section class="panel">${toolbar}<p class="note" role="status">${esc(t(failed ? 'replay.unavailable' : 'replay.loading'))}</p>${failed ? `<button class="btn btn-sm" type="button" id="replay-retry">${esc(t('replay.retry'))}</button>` : ''}</section>`;
      bind(); return;
    }
    const summary = run.summary;
    const completed = run.completion?.recorded_finish && run.completion.exit_code === 0;
    const intro = `<section class="panel">${toolbar}
      <p class="replay-source">${esc(t('replay.source'))}</p>
      <p class="note">${esc(t('replay.period', {start:date(run.daily[0].day), end:date(run.daily.at(-1).day), days:number(run.daily.length), build:run.build}))}</p>
      <p class="note ${completed ? '' : 'replay-status-partial'}">${esc(t(completed ? 'replay.complete' : run.completion?.exit_code != null ? 'replay.failed' : 'replay.partial', {code:run.completion?.exit_code}))}</p>
      <p class="note">${esc(t('replay.scope'))}</p>
      ${run.opening_prompt_matches_group ? '' : `<p class="note original-note">${esc(t('answer.differentHint'))}</p>`}
    </section>`;
    const kpis = `<div class="replay-kpis">${card('replay.return', percent(summary.return))}${card('replay.drawdown', percent(-summary.max_daily_drawdown))}${card('replay.decisions', number(summary.decision_count))}${card('replay.fills', number(summary.fill_count))}</div>`;
    let content = '';
    if (view === 'market') content = marketView();
    if (view === 'journal') content = journalView();
    if (view === 'stats') content = statsView();
    host.innerHTML = `${intro}${kpis}${content}`;
    bind();
  }

  function renderLines(series, label) {
    const all = series.flatMap(item => item.points.map(point => point.value));
    if (!all.length) return '';
    const lo = Math.min(0, ...all), hi = Math.max(0, ...all), span = hi - lo || 1;
    const xlo = Math.min(...series.flatMap(item => item.points.map(point => point.x)));
    const xhi = Math.max(...series.flatMap(item => item.points.map(point => point.x)));
    const x = value => 70 + (value - xlo) / (xhi - xlo || 1) * 640;
    const y = value => 25 + (hi - value) / span * 220;
    let svg = `<svg viewBox="0 0 760 290" class="replay-chart" role="img" aria-label="${esc(t(label))}">`;
    for (let i = 0; i < 5; i++) {
      const value = lo + span * i / 4;
      svg += `<line x1="65" x2="725" y1="${y(value)}" y2="${y(value)}" stroke="#dde3e9"/><text x="3" y="${y(value) + 4}">${esc(fmt(value, 1))}%</text>`;
    }
    for (const item of series) {
      svg += `<polyline fill="none" stroke="${item.color}" stroke-width="2.5" points="${item.points.map(point => `${x(point.x)},${y(point.value)}`).join(' ')}"/>`;
      for (const point of item.points) svg += `<circle cx="${x(point.x)}" cy="${y(point.value)}" r="2.5" fill="${item.color}"><title>${esc(item.name)} · ${esc(point.label)} · ${esc(fmt(point.value, 2))}%</title></circle>`;
    }
    const first = series[0].points[0], last = series[0].points.at(-1);
    svg += `<text x="70" y="279">${esc(first?.label || '')}</text><text x="710" y="279" text-anchor="end">${esc(last?.label || '')}</text></svg>`;
    return scrolling(svg) + `<div class="replay-legend">${series.map(item => `<span><i style="background:${item.color}"></i>${esc(item.name)} · ${esc(percent(item.points.at(-1).value / 100))}</span>`).join('')}</div>`;
  }

  function returnsView() {
    const minute = prices.resolution === '1m';
    const account = {name:t('replay.return'), color:'#176c60', points:run.equity.map(row => ({x:minute ? Date.parse(row.time) : Date.parse(row.day), value:(row.equity / run.baseline.equity - 1) * 100, label:minute ? clock(row.time) : date(row.day)}))};
    const bars = prices.bars.filter(bar => minute ? Date.parse(bar.time) >= Date.parse(run.baseline.time) : bar.time >= run.baseline.day);
    const series = [account];
    if (bars.length && bars[0].close > 0) series.push({name:t('replay.asset',{ticker:prices.ticker}), color:'#be701d', points:bars.map(bar => ({x:Date.parse(bar.time), value:(bar.close / bars[0].close - 1) * 100, label:minute ? clock(bar.time) : date(bar.time)}))});
    return renderLines(series, 'replay.returns') + `<p class="note">${esc(t('replay.returnNote'))}</p>`;
  }

  function candles() {
    const bars = prices.bars;
    if (!bars.length) return `<p class="note">${esc(t('replay.noPrices'))}</p>`;
    const minute = prices.resolution === '1m';
    const lo = Math.min(...bars.map(row => row.low)), hi = Math.max(...bars.map(row => row.high)), span = hi - lo || 1;
    const width = Math.max(780, 100 + bars.length * 6);
    const x = index => 65 + index * (width - 100) / Math.max(1, bars.length - 1);
    const y = value => 24 + (hi - value) / span * 225;
    const maxVolume = Math.max(1, ...bars.map(bar => bar.volume));
    let svg = `<svg viewBox="0 0 ${width} 365" class="replay-chart" style="min-width:${width}px" aria-label="${esc(t('replay.candles', {ticker:prices.ticker}))}">`;
    for (let i = 0; i < 5; i++) svg += `<line x1="60" x2="${width - 20}" y1="${24 + i * 225 / 4}" y2="${24 + i * 225 / 4}" stroke="#dde3e9"/><text x="2" y="${29 + i * 225 / 4}">${esc(fmt(hi - i * span / 4))}</text>`;
    bars.forEach((bar, index) => {
      const color = bar.close >= bar.open ? '#20856c' : '#cc5656';
      svg += `<g><title>${esc(minute ? clock(bar.time) : date(bar.time))} · O ${esc(fmt(bar.open))} H ${esc(fmt(bar.high))} L ${esc(fmt(bar.low))} C ${esc(fmt(bar.close))} V ${esc(number(bar.volume))}</title><line x1="${x(index)}" x2="${x(index)}" y1="${y(bar.high)}" y2="${y(bar.low)}" stroke="${color}"/><rect x="${x(index) - 2}" y="${Math.min(y(bar.open), y(bar.close))}" width="4" height="${Math.max(1, Math.abs(y(bar.open) - y(bar.close)))}" fill="${color}"/><rect x="${x(index) - 2}" y="${295 - bar.volume / maxVolume * 28}" width="4" height="${bar.volume / maxVolume * 28}" fill="${color}" opacity=".35"/></g>`;
      if (index === 0 || index === bars.length - 1 || index % Math.max(1, Math.ceil(bars.length / 9)) === 0) svg += `<text x="${x(index)}" y="355" text-anchor="middle">${esc(minute ? clock(bar.time) : date(bar.time))}</text>`;
    });
    const markers = new Map();
    for (const decision of run.decisions) {
      let index = -1;
      if (minute) {
        let distance = Infinity;
        bars.forEach((bar, candidate) => { const delta = Math.abs(Date.parse(bar.time) - Date.parse(decision.time)); if (delta < distance) { distance = delta; index = candidate; } });
        if (distance > 60000) index = -1;
      } else index = bars.findIndex(bar => bar.time === decision.day);
      if (index >= 0) markers.set(index, [...(markers.get(index) || []), decision]);
    }
    for (const [index, decisions] of markers) {
      const active = decisions.some(item => item.seq === selected), decision = decisions.find(item => item.seq === selected) || decisions[0];
      const color = decisions.some(item => item.orders.length) ? '#2864aa' : '#697687';
      svg += `<g role="button" tabindex="0" data-checkpoint="${decision.seq}" aria-label="${esc(t('replay.checkpoint',{seq:number(decision.seq + 1), time:stamp(decision)}))}"><title>${esc(stamp(decision))} · ${esc(number(decisions.length))}</title><rect x="${x(index) - 10}" y="300" width="20" height="35" fill="transparent"/><line x1="${x(index)}" x2="${x(index)}" y1="300" y2="321" stroke="${color}"/><circle cx="${x(index)}" cy="321" r="${active ? 8 : 5}" fill="${color}" stroke="${active ? '#1a1d2e' : '#fff'}" stroke-width="2"/></g>`;
    }
    return scrolling(svg + '</svg>') + `<p class="note">${esc(t('replay.legend'))}</p>`;
  }

  function marketView() {
    return `<section class="panel"><div class="replay-toolbar"><h3>${esc(t('replay.market'))}</h3><label>${esc(t('replay.view'))}<select id="replay-chart-view"><option value="price" ${chartView === 'price' ? 'selected' : ''}>${esc(t('replay.price'))}</option><option value="returns" ${chartView === 'returns' ? 'selected' : ''}>${esc(t('replay.returns'))}</option></select></label></div><p class="note">${esc(t('replay.priceNote'))}</p>${chartView === 'price' ? candles() : returnsView()}<p class="note">${esc(t('replay.priceSource',{source:prices.source, resolution:prices.resolution, count:number(prices.bars.length)}))}</p><label class="replay-jump">${esc(t('replay.selectDecision'))}<select id="replay-jump">${run.decisions.map(item => `<option value="${item.seq}" ${item.seq === selected ? 'selected' : ''}>#${number(item.seq + 1)} · ${esc(stamp(item))}</option>`).join('')}</select></label></section>${inspector()}`;
  }

  function journalView() {
    const rows = run.decisions.filter(item => (!dayFilter || item.day === dayFilter) && (filter === 'all' || (filter === 'proposed' ? item.orders.length : !item.orders.length)));
    const pages = Math.max(1, Math.ceil(rows.length / 5)); page = Math.min(page, pages - 1);
    const selection = `<div class="replay-toolbar"><label>${esc(t('replay.day'))}<select id="replay-day"><option value="">${esc(t('replay.allDays'))}</option>${run.daily.map(item => `<option value="${item.day}" ${item.day === dayFilter ? 'selected' : ''}>${esc(date(item.day))}</option>`).join('')}</select></label><label>${esc(t('replay.filter'))}<select id="replay-filter">${['all','proposed','noOrder'].map(id => `<option value="${id}" ${filter === id ? 'selected' : ''}>${esc(t(`replay.${id}`))}</option>`).join('')}</select></label></div>`;
    return `<section class="panel"><h3>${esc(t('replay.journal'))}</h3>${selection}<div class="replay-records">${rows.slice(page * 5, page * 5 + 5).map(item => `<button type="button" class="replay-record ${item.seq === selected ? 'on' : ''}" data-select="${item.seq}" aria-pressed="${item.seq === selected}"><span>#${number(item.seq + 1)}</span><span>${esc(stamp(item))}<small>${esc(item.intent || '—')}</small></span><span class="badge">${esc(t(item.orders.length ? 'replay.proposed' : 'replay.noOrder'))}</span></button>`).join('') || `<p class="note">${esc(t('replay.noDecisions'))}</p>`}</div>${pager(page, pages, rows.length, 'journal')}</section>${inspector()}`;
  }

  function ordersTable(rows, fills = false) {
    if (!rows.length) return `<p class="note">${esc(t(fills ? 'replay.noFills' : 'replay.noOrder'))}</p>`;
    const keys = fills ? ['time','contract','side','quantity','fillPrice','fees'] : ['contract','side','quantity'];
    return scrolling(`<table class="replay-table"><thead><tr>${keys.map(key => `<th scope="col">${esc(t(`replay.${key}`))}</th>`).join('')}</tr></thead><tbody>${rows.map(item => `<tr>${keys.map(key => `<td>${key === 'time' ? esc(clock(item.time)) : key === 'quantity' ? esc(fmt(item.qty ?? item.quantity, 0)) : key === 'fillPrice' ? esc(fmt(item.price)) : key === 'fees' ? esc(fmt(item.fees)) : esc(item[key] || (key === 'contract' ? item.symbol : item.action) || '—')}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
  }

  function inspector() {
    const item = run.decisions.find(row => row.seq === selected);
    if (!item) return `<section class="panel"><p class="note">${esc(t('replay.noDecisions'))}</p></section>`;
    const fills = run.fills.filter(fill => fill.day === item.day);
    return `<section class="panel replay-inspector" id="replay-inspector"><div class="replay-toolbar"><h3>${esc(t('replay.record',{seq:number(item.seq + 1)}))}</h3><span>${esc(stamp(item))}</span></div><p class="note original-note">${esc(t('replay.original'))}</p><div class="answer-reasoning" lang="en">${esc(item.reasoning || t('replay.noReason'))}</div><h4>${esc(t('replay.orders'))}</h4>${ordersTable(item.orders)}<details><summary>${esc(t('replay.risk'))}</summary>${item.checks.length ? `<ul lang="en">${item.checks.map(check => `<li><strong>${esc(check.action)}</strong> · ${esc(check.reason)}</li>`).join('')}</ul>` : `<p class="note">${esc(t('replay.noChecks'))}</p>`}</details><details id="replay-raw" ${rawOpen ? 'open' : ''}><summary>${esc(t('replay.raw'))}</summary><p class="note">${esc(t('replay.callsNote'))}</p>${item.calls.map(call => `<h4>${esc(t('replay.call',{index:number(call.ordinal)}))}</h4><code class="replay-hash">${esc(call.prompt_sha256)}</code><pre tabindex="0" lang="en">${esc(typeof call.raw === 'string' ? call.raw : JSON.stringify(call.raw ?? t('replay.empty'), null, 2))}</pre>`).join('')}</details><h4>${esc(t('replay.dayFills'))}</h4><p class="note">${esc(t('replay.fillNote'))}</p>${ordersTable(fills, true)}</section>`;
  }

  function statsView() {
    const days = run.daily;
    const dd = {name:t('replay.drawdown'), color:'#b14d50', points:days.map(row => ({x:Date.parse(row.day), value:row.drawdown * 100, label:date(row.day)}))};
    const proposed = run.decisions.filter(item => item.orders.length).length;
    const count = run.decisions.length;
    const maxPnl = Math.max(1, ...days.map(row => Math.abs(row.pnl)));
    const width = Math.max(760, days.length * 7 + 80);
    const bars = `<svg viewBox="0 0 ${width} 240" class="replay-chart" style="min-width:${width}px" role="img" aria-label="${esc(t('replay.distribution'))}"><line x1="40" x2="${width - 30}" y1="110" y2="110" stroke="#aeb8c4"/>${days.map((row, i) => {const height = Math.abs(row.pnl) / maxPnl * 85, x = 50 + i * (width - 100) / Math.max(1, days.length - 1); return `<rect x="${x}" y="${row.pnl >= 0 ? 110 - height : 110}" width="5" height="${Math.max(1, height)}" fill="${row.pnl >= 0 ? '#20856c' : '#c65b5b'}"><title>${esc(date(row.day))} · ${esc(fmt(row.pnl,2,true))} USD</title></rect>`;}).join('')}<text x="40" y="225">${esc(date(days[0].day))}</text><text x="${width - 25}" y="225" text-anchor="end">${esc(date(days.at(-1).day))}</text></svg>`;
    return `<section class="panel"><h3>${esc(t('replay.returns'))}</h3>${returnsView()}<p class="note">${esc(t('replay.baseline',{date:date(run.baseline.day), equity:fmt(run.baseline.equity)}))}</p></section><div class="replay-result-grid"><section class="panel"><h3>${esc(t('replay.drawdown'))}</h3>${renderLines([dd], 'replay.drawdown')}</section><section class="panel"><h3>${esc(t('replay.activity'))}</h3><div class="replay-activity"><span style="width:${proposed / count * 100}%"></span></div><dl><div><dt>${esc(t('replay.proposed'))}</dt><dd>${esc(number(proposed))}</dd></div><div><dt>${esc(t('replay.noOrder'))}</dt><dd>${esc(number(count - proposed))}</dd></div><div><dt>${esc(t('replay.fees'))}</dt><dd>${esc(fmt(run.summary.fees))} USD</dd></div><div><dt>${esc(t('replay.pnl'))}</dt><dd>${esc(fmt(run.summary.net_pnl,2,true))} USD</dd></div></dl><p class="note">${esc(t('replay.activityNote'))}</p></section></div><section class="panel"><h3>${esc(t('replay.distribution'))}</h3><p class="note">${esc(t('replay.distributionNote'))}</p>${scrolling(bars)}</section>${ledger()}<a class="back-link" href="index.html#results">${esc(t('replay.fullStats'))}</a>`;
  }

  function ledger() {
    const days = run.daily, pages = Math.max(1, Math.ceil(days.length / 10)); ledgerPage = Math.min(ledgerPage, pages - 1);
    return `<section class="panel"><h3>${esc(t('replay.dailyLedger'))}</h3>${scrolling(`<table class="replay-table"><thead><tr>${['day','equity','dailyPnl','return','drawdown','decisions','fills'].map(key => `<th scope="col">${esc(t(`replay.${key}`))}</th>`).join('')}</tr></thead><tbody>${days.slice(ledgerPage * 10, ledgerPage * 10 + 10).map(row => `<tr><th scope="row">${esc(date(row.day))}</th><td>${esc(fmt(row.equity))}</td><td>${esc(fmt(row.pnl,2,true))}</td><td>${esc(percent(row.return))}</td><td>${esc(percent(row.drawdown))}</td><td>${esc(number(row.decisions))}</td><td>${esc(number(row.fills))}</td></tr>`).join('')}</tbody></table>`)}${pager(ledgerPage, pages, days.length, 'ledger')}</section>`;
  }

  function choose(seq, scroll = false) {
    selected = seq; rawOpen = false; render();
    host.querySelector(`[data-checkpoint="${seq}"]`)?.scrollIntoView({block:'nearest', inline:'center'});
    if (scroll) $('replay-inspector')?.scrollIntoView({behavior:'smooth', block:'start'});
  }
  function bind() {
    tabs.querySelectorAll('[data-view]').forEach(button => { button.onclick = () => {view = button.dataset.view; urlState(); render();}; });
    $('replay-model')?.addEventListener('change', event => {model = event.target.value; load();});
    $('replay-retry')?.addEventListener('click', load);
    $('replay-chart-view')?.addEventListener('change', event => {chartView = event.target.value; render();});
    $('replay-jump')?.addEventListener('change', event => choose(Number(event.target.value), true));
    $('replay-day')?.addEventListener('change', event => {dayFilter = event.target.value; page = 0; render();});
    $('replay-filter')?.addEventListener('change', event => {filter = event.target.value; page = 0; render();});
    host.querySelectorAll('[data-select]').forEach(button => {button.onclick = () => choose(Number(button.dataset.select), true);});
    host.querySelectorAll('[data-checkpoint]').forEach(button => {
      button.onclick = () => choose(Number(button.dataset.checkpoint), true);
      button.onkeydown = event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); button.onclick();}};
    });
    host.querySelectorAll('[data-page]').forEach(button => {button.onclick = () => {if (button.dataset.page === 'ledger') ledgerPage += Number(button.dataset.offset); else page += Number(button.dataset.offset); render();};});
    $('replay-raw')?.addEventListener('toggle', event => {rawOpen = event.target.open;});
    $('replay-download')?.addEventListener('click', () => {
      if (!run) return;
      const report = {background:{scenario:run.scenario, model:run.model, build:run.build, source:run.source}, settings:{baseline:run.baseline, time_zone:run.time_zone, currency:run.currency, scope:t('replay.scope')}, results:run};
      const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
      const link = document.createElement('a'); link.href = url; link.download = `${run.scenario}-${run.build}-${run.model}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
    });
    window.LOI18n.apply(host);
  }

  function recordingChange(detail) {
    recording = detail;
    if (!recording.build.answers.some(answer => answer.model === model)) model = recording.build.answers[0]?.model;
    if (model) load();
  }
  window.addEventListener('lo:recordingchange', event => recordingChange(event.detail));
  window.addEventListener('lo:recordingloading', () => {generation++; recording = null; host.hidden = tabs.hidden = true; opening.hidden = false;});
  window.addEventListener('lo:languagechange', render);
  if (window.LORecording) recordingChange(window.LORecording);
})();
