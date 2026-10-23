/* Recorded benchmark scenarios and model decisions. All data loads locally. */

(function () {
  const $ = id => document.getElementById(id);
  const MODEL_META = {};   // filled from results.json so colours match

  const TASKS = [
    { id: 'earnings', key: 'Earnings', name: 'Earnings bet', tag: 'orange', title: 'Trade an earnings event', description: 'META and NVDA announcement decisions.' },
    { id: '0dte', key: '0DTE', name: '0DTE intraday', tag: 'gold', title: 'Decide at the market open', description: 'SPY options expiring the same day.' },
    { id: 'overlay', key: 'Overlay', name: 'Portfolio overlay', tag: '', title: 'Hedge an equity position', description: 'A protective overlay on a QQQ portfolio.' },
  ];
  let index = [], scenario = null, build = null, task = null, requestId = 0;

  async function readJSON(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Could not load ${path} (HTTP ${response.status})`);
    return response.json();
  }

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

  function answerCard(a) {
    const meta = MODEL_META[a.model] || {};
    const colour = meta.color || '#8994A8';
    const name = meta.name || a.model;
    const s1 = a.stage1 || {};
    const v = viewOf(s1);
    const legs = s1.target_instruments || [];
    const resolved = a.resolved || [];

    const confText = v.conf === undefined || v.conf === null ? ''
      : (typeof v.conf === 'number' ? v.conf.toFixed(2) : String(v.conf));

    return `<div class="answer">
      <div class="who">
        <span class="swatch" style="background:${colour}"></span>
        ${esc(name)}
        ${a.build ? `<span class="badge">${esc(a.build)}</span>` : ''}
        ${a.samePrompt === false ? '<span class="badge" title="This model saw a slightly different observation">different prompt</span>' : ''}
      </div>
      <div style="display:flex;gap:.6rem;align-items:baseline;flex-wrap:wrap;margin-bottom:.3rem">
        ${v.dir ? `<span class="side ${DIR_CLASS(v.dir)}" style="font-family:var(--font-mono);font-weight:700;font-size:.82rem">${esc(String(v.dir).toUpperCase())}</span>` : ''}
        ${confText ? `<span class="note" style="margin:0">confidence ${esc(confText)}</span>` : ''}
        ${v.move !== undefined && v.move !== null ? `<span class="note" style="margin:0">expected move ${esc(v.move)}%</span>` : ''}
      </div>
      ${v.text ? `<div class="answer-reasoning">${esc(String(v.text))}</div>` : ''}
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

  function renderAnswers() {
    $('answers').innerHTML = !scenario || !build ? ''
      : build.answers.map(a => answerCard({ ...a, build: build.build })).join('');
  }

  function renderBuildSeg() {
    const seg = $('build-seg');
    seg.innerHTML = '';
    scenario.groups.forEach(g => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = g.build === 'release' ? 'Release recordings' : `${g.build} recordings`;
      b.setAttribute('aria-pressed', String(g === build));
      b.className = g === build ? 'on' : '';
      b.onclick = () => {
        build = g;
        [...seg.children].forEach(c => {
          c.classList.toggle('on', c === b);
          c.setAttribute('aria-pressed', String(c === b));
        });
        $('prompt-box').textContent = g.user;
        renderAnswers();
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
    const currentRequest = ++requestId;
    [...$('scenario-list').children].forEach(c => {
      c.classList.toggle('on', c === btn);
      c.setAttribute('aria-pressed', String(c === btn));
    });
    scenario = null;
    build = null;
    $('sc-title').textContent = 'Loading…';
    $('sc-blurb').textContent = '';
    $('sc-task').textContent = task.name;
    $('sc-meta').textContent = '';
    $('build-seg').innerHTML = '';
    $('answers').innerHTML = '';
    $('prompt-box').textContent = '';
    $('prompt-box').hidden = true;
    $('toggle-prompt').textContent = 'Show observation';
    $('toggle-prompt').setAttribute('aria-expanded', 'false');
    $('toggle-prompt').disabled = true;
    $('demo-main').setAttribute('aria-busy', 'true');
    try {
      const loaded = await readJSON(`data/scenarios/${entry.id}.json`);
      if (currentRequest !== requestId) return;
      if (!loaded.groups?.length) throw new Error('No recorded decisions are available for this scenario.');
      scenario = loaded;
      build = scenario.groups[0];
      $('sc-title').textContent = scenario.title;
      $('sc-blurb').textContent = scenario.blurb;
      $('prompt-box').textContent = build.user;
      renderBuildSeg();
      renderMeta();
      renderAnswers();
      $('toggle-prompt').disabled = false;
      const url = new URL(window.location.href);
      url.searchParams.set('task', task.id);
      url.searchParams.set('scenario', entry.id);
      window.history.replaceState(null, '', url);
    } catch (error) {
      if (currentRequest !== requestId) return;
      $('sc-title').textContent = 'Demo unavailable';
      $('sc-blurb').textContent = error.message;
    } finally {
      if (currentRequest === requestId) $('demo-main').setAttribute('aria-busy', 'false');
    }
  }

  function selectTask(selected, preferredScenario) {
    task = selected;
    [...$('demo-tasks').children].forEach(b => {
      const active = b.dataset.task === task.id;
      b.classList.toggle('on', active);
      b.setAttribute('aria-pressed', String(active));
    });
    const entries = index.filter(e => e.task === task.key);
    const host = $('scenario-list');
    host.innerHTML = '';
    $('demo-status').hidden = true;
    $('demo-workspace').hidden = false;
    entries.forEach(e => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'scenario';
      b.innerHTML = `<div class="t">${esc(e.title)}</div><div class="s">${esc(e.ticker)}</div>`;
      b.onclick = () => selectScenario(e, b);
      b.dataset.scenario = e.id;
      host.appendChild(b);
    });
    const first = [...host.children].find(b => b.dataset.scenario === preferredScenario) || host.firstChild;
    if (first) first.click();
  }

  function buildTaskList() {
    const host = $('demo-tasks');
    TASKS.filter(t => index.some(e => e.task === t.key)).forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'card demo-task';
      b.dataset.task = t.id;
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = `<span class="tag ${t.tag}">${esc(t.name)}</span><h3>${esc(t.title)}</h3><p>${esc(t.description)}</p><span class="demo-link">Browse scenarios <span aria-hidden="true">→</span></span>`;
      b.onclick = () => selectTask(t);
      host.appendChild(b);
    });
    $('demo-status').textContent = 'Select a task above to browse its recorded scenarios.';
    const params = new URLSearchParams(window.location.search);
    const requestedTask = TASKS.find(t => t.id === params.get('task'));
    if (requestedTask) selectTask(requestedTask, params.get('scenario'));
  }

  async function init() {
    const [results, scenarios] = await Promise.all([readJSON('data/results.json'), readJSON('data/scenarios/index.json')]);
    results.models.forEach(m => { MODEL_META[m.id] = m; });
    index = scenarios;
    buildTaskList();

    $('toggle-prompt').onclick = () => {
      const box = $('prompt-box');
      box.hidden = !box.hidden;
      $('toggle-prompt').textContent = box.hidden ? 'Show observation' : 'Hide observation';
      $('toggle-prompt').setAttribute('aria-expanded', String(!box.hidden));
    };
  }

  init().catch(e => {
    $('demo-status').textContent = `Could not load the demos: ${e.message}`;
  });
})();
