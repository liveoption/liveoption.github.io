/* Recorded benchmark scenarios and model decisions. All data loads locally. */

(function () {
  const $ = id => document.getElementById(id);
  const MODEL_META = {};   // filled from results.json so colours match

  let index = [], scenario = null, build = null;

  const esc = s => String(s ?? '').replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* The opening call returns a view plus the legs the agent wants. Earnings
     phrases the view as a "prediction" object; 0DTE and overlay use an
     "intent" with a confidence and reasoning. Read whichever is present. */
  function viewOf(s1) {
    const p = s1.prediction || {};
    const dir = p.direction || s1.intent || '';
    const conf = p.confidence ?? s1.confidence;
    const text = p.thesis || s1.reasoning || '';
    const move = p.expected_move_pct;
    return { dir, conf, text, move };
  }

  const DIR_CLASS = d => /bull|long|up/i.test(d) ? 'buy'
    : /bear|short|down/i.test(d) ? 'sell' : '';

  function legRow(leg) {
    /* target_instruments are free-text order lines such as
       "BUY PUT K=545-550 DTE=4 QTY=10 SPREAD=A". Colour the side and show
       the rest as written, because normalising it would hide how loosely
       some models specify a leg. */
    if (typeof leg === 'string') {
      const m = leg.match(/^\s*(BUY|SELL)\b\s*(.*)$/i);
      const side = m ? m[1].toUpperCase() : '';
      const rest = m ? m[2] : leg;
      return `<div class="leg">
        <span class="side ${side === 'BUY' ? 'buy' : side === 'SELL' ? 'sell' : ''}">${esc(side || '—')}</span>
        <span>${esc(rest)}</span></div>`;
    }
    const side = String(leg.action || leg.side || '').toUpperCase();
    const qty = leg.qty ?? leg.quantity ?? '';
    return `<div class="leg">
      <span class="side ${side.startsWith('B') ? 'buy' : 'sell'}">${esc(side || '—')}</span>
      <span>${esc(leg.contract || leg.symbol || '')}</span>
      ${qty !== '' ? `<span style="color:#8994A8">× ${esc(qty)}</span>` : ''}
    </div>`;
  }

  function answerCard(a, opts = {}) {
    const meta = MODEL_META[a.model] || {};
    const colour = opts.mine ? 'var(--secondary)' : (meta.color || '#8994A8');
    const name = opts.mine ? a.model : (meta.name || a.model);
    const s1 = a.stage1 || {};
    const v = viewOf(s1);
    const legs = s1.target_instruments || [];
    const resolved = a.resolved || [];

    const confText = v.conf === undefined || v.conf === null ? ''
      : (typeof v.conf === 'number' ? v.conf.toFixed(2) : String(v.conf));

    return `<div class="answer ${opts.mine ? 'mine' : ''}">
      <div class="who">
        <span class="swatch" style="background:${colour}"></span>
        ${esc(name)}
        ${opts.mine ? '<span class="badge" style="background:rgba(252,82,0,.12);color:#c24000">your model</span>' : ''}
        ${a.build ? `<span class="badge">${esc(a.build)}</span>` : ''}
        ${a.samePrompt === false ? '<span class="badge" title="This model saw a slightly different observation">different prompt</span>' : ''}
      </div>
      <div style="display:flex;gap:.6rem;align-items:baseline;flex-wrap:wrap;margin-bottom:.3rem">
        ${v.dir ? `<span class="side ${DIR_CLASS(v.dir)}" style="font-family:var(--font-mono);font-weight:700;font-size:.82rem">${esc(String(v.dir).toUpperCase())}</span>` : ''}
        ${confText ? `<span class="note" style="margin:0">confidence ${esc(confText)}</span>` : ''}
        ${v.move !== undefined && v.move !== null ? `<span class="note" style="margin:0">expected move ${esc(v.move)}%</span>` : ''}
      </div>
      ${v.text ? `<div class="note" style="margin:.1rem 0 .4rem">${esc(String(v.text).slice(0, 300))}</div>` : ''}
      ${legs.length
        ? `<div class="legs">${legs.map(legRow).join('')}</div>`
        : '<div class="no-trade">No legs proposed at this decision.</div>'}
      ${resolved.length
        ? `<details style="margin-top:.5rem"><summary class="note" style="cursor:pointer">Resolved to ${resolved.length} order${resolved.length > 1 ? 's' : ''} by the engine</summary>
           <div class="legs" style="margin-top:.35rem">${resolved.map(legRow).join('')}</div></details>`
        : ''}
      ${a.raw ? `<details style="margin-top:.5rem"><summary class="note" style="cursor:pointer">Unparsed reply</summary><div class="prompt-box" style="max-height:200px;margin-top:.35rem">${esc(a.raw)}</div></details>` : ''}
    </div>`;
  }

  function renderAnswers(mine) {
    const host = $('answers');
    if (!scenario || !build) { host.innerHTML = ''; return; }
    const parts = [];
    if (mine) parts.push(answerCard(mine, { mine: true }));
    parts.push(...build.answers.map(a => answerCard({ ...a, build: build.build })));
    host.innerHTML = parts.join('');
  }

  function renderBuildSeg() {
    const seg = $('build-seg');
    seg.innerHTML = '';
    scenario.groups.forEach(g => {
      const b = document.createElement('button');
      const news = g.newsHeadlines
        ? `${g.newsHeadlines} headlines` : 'no news feed';
      b.textContent = `${g.build} · ${g.answers.length} models · ${news}`;
      b.className = g === build ? 'on' : '';
      b.onclick = () => {
        build = g;
        [...seg.children].forEach(c => c.classList.toggle('on', c === b));
        $('prompt-box').textContent = g.user;
        renderAnswers(null);
        renderMeta();
      };
      seg.appendChild(b);
    });
  }

  function renderMeta() {
    const g = build;
    const bits = [];
    if (g.day) bits.push(g.day);
    bits.push(`${g.answers.length} recorded answers`);
    if (g.promptAgreement && g.promptAgreement !== `${g.answers.length}/${g.answers.length}`) {
      bits.push(`prompt agreement ${g.promptAgreement}`);
    }
    bits.push(g.newsHeadlines ? `${g.newsHeadlines} news headlines` : 'no news in the packet');
    $('sc-meta').textContent = bits.join(' · ');
  }

  async function selectScenario(entry, btn) {
    [...$('scenario-list').children].forEach(c => c.classList.toggle('on', c === btn));
    $('sc-title').textContent = 'Loading…';
    scenario = await fetch(`data/scenarios/${entry.id}.json`).then(r => r.json());
    build = scenario.groups[0];
    $('sc-title').textContent = `${scenario.task} · ${scenario.title}`;
    $('sc-blurb').textContent = scenario.blurb;
    $('prompt-box').textContent = build.user;
    renderBuildSeg();
    renderMeta();
    renderAnswers(null);
  }

  function buildList() {
    const host = $('scenario-list');
    host.innerHTML = '';
    index.forEach(e => {
      const b = document.createElement('button');
      b.className = 'scenario';
      b.innerHTML = `<div class="t">${esc(e.title)}</div>
                     <div class="s">${esc(e.task)} · ${esc(e.ticker)}</div>`;
      b.onclick = () => selectScenario(e, b);
      host.appendChild(b);
    });
    if (index.length) host.firstChild.click();
  }

  async function init() {
    const results = await fetch('data/results.json').then(r => r.json());
    results.models.forEach(m => { MODEL_META[m.id] = m; });
    index = await fetch('data/scenarios/index.json').then(r => r.json());
    buildList();

    $('toggle-prompt').onclick = () => {
      const box = $('prompt-box');
      box.hidden = !box.hidden;
      $('toggle-prompt').textContent = box.hidden ? 'Show full prompt' : 'Hide prompt';
    };
  }

  init().catch(e => {
    $('sc-title').textContent = 'Playground unavailable';
    $('sc-blurb').textContent = `Could not load the scenarios: ${e.message}`;
  });
})();
