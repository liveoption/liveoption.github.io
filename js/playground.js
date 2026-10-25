/* Recorded benchmark scenarios and model decisions. All data loads locally. */

(function () {
  const $ = id => document.getElementById(id);
  const { t, number, date } = window.LOI18n;
  const scenarioText = (entry, field) => {
    const key = `scenario.${entry.id}.${field}`;
    const translated = t(key);
    return translated === key ? entry[field] : translated;
  };
  const valueLabel = (prefix, value) => {
    const key = `${prefix}.${String(value).toLowerCase()}`;
    const translated = t(key);
    return translated === key ? String(value) : translated;
  };
  const MODEL_META = {};   // filled from results.json so colours match

  const TASKS = [
    { id: 'earnings', key: 'Earnings', tag: 'orange' },
    { id: '0dte', key: '0DTE', tag: 'gold' },
    { id: 'overlay', key: 'Overlay', tag: '' },
  ];
  let index = [], scenario = null, task = null, selectedModel = null, requestId = 0;
  const answers = () => scenario ? scenario.groups.flatMap(group => group.answers.map(answer => ({...answer, group}))) : [];
  const observationGroup = () => answers().find(answer => answer.model === selectedModel)?.group || scenario?.groups[0];
  function publishRecording() {
    window.LORecording = {scenario, answers:answers(), models:MODEL_META};
    window.dispatchEvent(new CustomEvent('lo:recordingchange', {detail:window.LORecording}));
  }

  async function readJSON(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(t('error.resource', {path, status: response.status}));
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
      : (typeof v.conf === 'number' ? number(v.conf, 2) : valueLabel('answer.confidence', v.conf));

    return `<div class="answer">
      <div class="who">
        <span class="swatch" style="background:${colour}"></span>
        ${esc(name)}
        ${a.samePrompt === false ? `<span class="badge" title="${esc(t('answer.differentHint'))}">${esc(t('answer.different'))}</span>` : ''}
      </div>
      <div style="display:flex;gap:.6rem;align-items:baseline;flex-wrap:wrap;margin-bottom:.3rem">
        ${v.dir ? `<span class="side ${DIR_CLASS(v.dir)}" style="font-family:var(--font-mono);font-weight:700;font-size:.82rem">${esc(valueLabel('answer.direction', v.dir))}</span>` : ''}
        ${confText ? `<span class="note" style="margin:0">${esc(t('answer.confidence', {value: confText}))}</span>` : ''}
        ${v.move !== undefined && v.move !== null ? `<span class="note" style="margin:0">${esc(t('answer.move', {value: v.move}))}</span>` : ''}
      </div>
      ${v.text ? `<div class="answer-reasoning" lang="en">${esc(String(v.text))}</div>` : ''}
      ${legs.length
        ? `<div class="legs" lang="en">${legs.map(legRow).join('')}</div>`
        : `<div class="no-trade">${esc(t('answer.noLegs'))}</div>`}
      ${resolved.length
        ? `<details style="margin-top:.5rem"><summary class="note" style="cursor:pointer">${esc(t('answer.resolved', {count: resolved.length}))}</summary>
           <div class="legs" lang="en" style="margin-top:.35rem">${resolved.map(legRow).join('')}</div></details>`
        : ''}
      ${a.raw ? `<details style="margin-top:.5rem"><summary class="note" style="cursor:pointer">${esc(t('answer.raw'))}</summary><div class="prompt-box" lang="en" style="max-height:200px;margin-top:.35rem">${esc(a.raw)}</div></details>` : ''}
    </div>`;
  }

  function renderAnswers() {
    const reference = scenario?.groups[0]?.promptSha;
    $('answers').innerHTML = answers().map(answer => answerCard({...answer, samePrompt:answer.samePrompt && answer.group.promptSha === reference})).join('');
  }

  function renderObservation() {
    const group = observationGroup();
    if (!group) return;
    $('prompt-box').innerHTML = `<label>${esc(t('replay.model'))} <select id="observation-model">${answers().map(answer => `<option value="${esc(answer.model)}" ${answer.model === selectedModel ? 'selected' : ''}>${esc(MODEL_META[answer.model]?.name || answer.model)}</option>`).join('')}</select></label><p class="note">${esc(t('demo.referenceNote'))}</p><pre lang="en"></pre>`;
    $('prompt-box').querySelector('pre').textContent = group.user;
    $('observation-model').onchange = event => {
      selectedModel = event.target.value;
      renderObservation();
      window.dispatchEvent(new CustomEvent('lo:selectmodel', {detail:{model:selectedModel}}));
    };
  }

  function renderMeta() {
    const g = scenario.groups[0];
    const bits = [];
    if (g.day) bits.push(date(g.day));
    bits.push(t('demo.count', {count: answers().length}));
    bits.push(t('demo.inputNote'));
    $('sc-meta').textContent = bits.join(' · ');
  }

  async function selectScenario(entry, btn) {
    const currentRequest = ++requestId;
    [...$('scenario-list').children].forEach(c => {
      c.classList.toggle('on', c === btn);
      c.setAttribute('aria-pressed', String(c === btn));
    });
    scenario = null;
    $('sc-title').textContent = t('demo.loadingScenario');
    $('sc-blurb').textContent = '';
    $('sc-task').textContent = t(`task.${task.id}.name`);
    $('sc-meta').textContent = '';
    $('answers').innerHTML = '';
    $('prompt-box').textContent = '';
    $('prompt-box').hidden = true;
    $('toggle-prompt').textContent = t('demo.showObservation');
    $('toggle-prompt').setAttribute('aria-expanded', 'false');
    $('toggle-prompt').disabled = true;
    $('demo-main').setAttribute('aria-busy', 'true');
    window.dispatchEvent(new CustomEvent('lo:recordingloading'));
    window.LORecording = null;
    try {
      const loaded = await readJSON(`data/scenarios/${entry.id}.json`);
      if (currentRequest !== requestId) return;
      if (!loaded.groups?.length) throw new Error(t('demo.noDecisions'));
      scenario = loaded;
      const requestedModel = new URLSearchParams(location.search).get('model') || selectedModel;
      selectedModel = answers().some(answer => answer.model === requestedModel) ? requestedModel : answers()[0].model;
      $('sc-title').textContent = scenarioText(scenario, 'title');
      $('sc-blurb').textContent = scenarioText(scenario, 'blurb');
      renderObservation();
      renderMeta();
      renderAnswers();
      $('toggle-prompt').disabled = false;
      publishRecording();
      const url = new URL(window.location.href);
      url.searchParams.set('task', task.id);
      url.searchParams.set('scenario', entry.id);
      window.history.replaceState(null, '', url);
    } catch (error) {
      if (currentRequest !== requestId) return;
      $('sc-title').textContent = t('demo.unavailable');
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
    $('demo-status').hidden = true;
    $('demo-workspace').hidden = false;
    renderScenarioList(preferredScenario, true);
  }

  function renderScenarioList(preferredScenario, load) {
    const entries = index.filter(e => e.task === task.key);
    const host = $('scenario-list');
    host.innerHTML = '';
    entries.forEach(e => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'scenario';
      b.classList.toggle('on', e.id === preferredScenario);
      b.setAttribute('aria-pressed', String(e.id === preferredScenario));
      b.innerHTML = `<div class="t">${esc(scenarioText(e, 'title'))}</div><div class="s">${esc(e.ticker)}</div>`;
      b.onclick = () => selectScenario(e, b);
      b.dataset.scenario = e.id;
      host.appendChild(b);
    });
    if (load) {
      const first = [...host.children].find(b => b.dataset.scenario === preferredScenario) || host.firstChild;
      if (first) first.click();
    }
  }

  function renderTaskButtons() {
    const host = $('demo-tasks');
    host.innerHTML = '';
    TASKS.filter(candidate => index.some(e => e.task === candidate.key)).forEach(candidate => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'card demo-task';
      b.dataset.task = candidate.id;
      b.classList.toggle('on', task?.id === candidate.id);
      b.setAttribute('aria-pressed', String(task?.id === candidate.id));
      b.innerHTML = `<span class="tag ${candidate.tag}">${esc(t(`task.${candidate.id}.name`))}</span><h3>${esc(t(`task.${candidate.id}.title`))}</h3><p>${esc(t(`task.${candidate.id}.description`))}</p><span class="demo-link">${esc(t('demo.browse'))} <span aria-hidden="true">→</span></span>`;
      b.onclick = () => selectTask(candidate);
      host.appendChild(b);
    });
  }

  function buildTaskList() {
    renderTaskButtons();
    $('demo-status').textContent = t('demo.selectFirst');
    const params = new URLSearchParams(window.location.search);
    const requestedTask = TASKS.find(candidate => candidate.id === params.get('task'));
    if (requestedTask) selectTask(requestedTask, params.get('scenario'));
  }

  window.addEventListener('lo:languagechange', () => {
    if (!index.length) return;
    renderTaskButtons();
    if (!task) { $('demo-status').textContent = t('demo.selectFirst'); return; }
    renderScenarioList(scenario?.id, false);
    $('sc-task').textContent = t(`task.${task.id}.name`);
    const expanded = !$('prompt-box').hidden;
    $('toggle-prompt').textContent = t(expanded ? 'demo.hideObservation' : 'demo.showObservation');
    if (scenario) {
      $('sc-title').textContent = scenarioText(scenario, 'title');
      $('sc-blurb').textContent = scenarioText(scenario, 'blurb');
      renderObservation();
      renderMeta();
      renderAnswers();
    }
  });
  window.addEventListener('lo:modelselected', event => {
    selectedModel = event.detail.model;
    renderObservation();
  });

  async function init() {
    const [results, scenarios] = await Promise.all([readJSON('data/results.json'), readJSON('data/scenarios/index.json')]);
    results.models.forEach(m => { MODEL_META[m.id] = m; });
    index = scenarios;
    buildTaskList();

    $('toggle-prompt').onclick = () => {
      const box = $('prompt-box');
      box.hidden = !box.hidden;
      $('toggle-prompt').textContent = t(box.hidden ? 'demo.showObservation' : 'demo.hideObservation');
      $('toggle-prompt').setAttribute('aria-expanded', String(!box.hidden));
    };
  }

  init().catch(e => {
    $('demo-status').textContent = t('demo.loadError', {message: e.message});
  });
})();
