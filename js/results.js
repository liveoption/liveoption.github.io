/* The results table and the distribution strip.
   Every number is read from the exported JSON and formatted here, so the
   page and the manuscript round once, in the same place. */

(function () {
  const { t, number } = window.LOI18n;
  const TASKS = [
    { key: 'Earnings', labelKey: 'results.task.earnings', kind: 'episode' },
    { key: '0DTE', labelKey: 'results.task.0dte', kind: 'episode' },
    { key: 'Hedging', labelKey: 'results.task.hedging', kind: 'overlay' },
    { key: 'Covered Call', labelKey: 'results.task.covered', kind: 'overlay' },
    { key: 'Greeks', labelKey: 'results.task.greeks', kind: 'greeks' },
  ];

  const EPISODE_COLS = [
    { k: 'model', labelKey: 'column.model', type: 'model' },
    { k: 'n', labelKey: 'column.n', d: 0 },
    { k: 'mean', labelKey: 'column.mean', d: 2, sign: true, ci: true },
    { k: 'median', labelKey: 'column.median', d: 2, sign: true },
    { k: 'win', labelKey: 'column.win', d: 1 },
    { k: 'noTrade', labelKey: 'column.noTrade', d: 1 },
    { k: 'pf', labelKey: 'column.pf', d: 2 },
  ];
  const OVERLAY_COLS = [
    { k: 'model', labelKey: 'column.model', type: 'model' },
    { k: 'active', labelKey: 'column.active', d: 2, sign: true },
    { k: 'ir', labelKey: 'column.ir', d: 2, sign: true },
    { k: 'ddReduction', labelKey: 'column.ddReduction', d: 2, sign: true },
    { k: 'assetsPositive', labelKey: 'column.assetsPositive', type: 'frac' },
  ];
  const GREEK_COLS = [
    { k: 'model', labelKey: 'column.model', type: 'model' },
    { k: 'task', labelKey: 'column.task', type: 'text' },
    { k: 'cases', labelKey: 'column.cases', d: 0 },
    { k: 'delta', t: 'δ', d: 0, sign: true },
    { k: 'gamma', t: 'γ', d: 0, sign: true },
    { k: 'theta', t: 'θ', d: 0, sign: true },
    { k: 'vega', t: 'ν', d: 0, sign: true },
    { k: 'residual', labelKey: 'column.residual', d: 0, sign: true },
  ];

  const NOTES = { Earnings: 'results.note.earnings', '0DTE': 'results.note.0dte', Hedging: 'results.note.hedging', 'Covered Call': 'results.note.covered', Greeks: 'results.note.greeks' };

  let data, dist, current = 'Earnings', sortKey = null, sortDir = -1;
  document.querySelector('.results-details')?.addEventListener('toggle', event => {
    if (event.target.open && data && dist) render();
  });

  const fmt = (v, d, sign) => {
    if (v === null || v === undefined || Number.isNaN(v)) return '—';
    return number(Number(v), d, sign);
  };
  const cls = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');

  function colsFor(task) {
    const t = TASKS.find(x => x.key === task);
    return t.kind === 'episode' ? EPISODE_COLS
      : t.kind === 'overlay' ? OVERLAY_COLS : GREEK_COLS;
  }

  function rowsFor(task) {
    const byId = Object.fromEntries(data.models.map(m => [m.id, m]));
    const kind = TASKS.find(x => x.key === task).kind;
    if (kind === 'episode') {
      return data.episodes.map(r => ({ _m: byId[r.model], ...r[task] }));
    }
    if (kind === 'overlay') {
      return data.overlay.map(r => ({ _m: byId[r.model], ...r[task] }));
    }
    return data.greeks.map(r => ({ _m: byId[r.model], ...r }));
  }

  function render() {
    const cols = colsFor(current);
    const head = document.getElementById('results-head');
    head.innerHTML = '';
    cols.forEach(c => {
      const th = document.createElement('th');
      th.textContent = c.labelKey ? t(c.labelKey) : c.t;
      if (sortKey === c.k) th.classList.add('sorted');
      const a = document.createElement('span');
      a.className = 'arrow';
      a.textContent = sortKey === c.k ? (sortDir === 1 ? '▲' : '▼') : '▲';
      th.appendChild(a);
      th.onclick = () => {
        if (sortKey === c.k) sortDir = -sortDir;
        else { sortKey = c.k; sortDir = c.k === 'model' ? 1 : -1; }
        render();
      };
      head.appendChild(th);
    });

    let rows = rowsFor(current);
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = sortKey === 'model' ? a._m.name : a[sortKey];
        const bv = sortKey === 'model' ? b._m.name : b[sortKey];
        if (typeof av === 'string') return av.localeCompare(bv, window.LOI18n.locale) * sortDir;
        return ((av ?? -Infinity) - (bv ?? -Infinity)) * sortDir;
      });
    }

    const body = document.getElementById('results-body');
    body.innerHTML = '';
    rows.forEach(r => {
      const tr = document.createElement('tr');
      cols.forEach(c => {
        const td = document.createElement('td');
        if (c.type === 'model') {
          td.innerHTML = `<span class="model-cell"><span class="swatch" style="background:${r._m.color}"></span>${r._m.name}</span>`;
        } else if (c.type === 'text') {
          td.textContent = t(r[c.k] === 'Earnings' ? 'results.task.earnings' : 'results.task.0dte');
        } else if (c.type === 'frac') {
          td.className = 'num';
          td.textContent = `${r.assetsPositive}/${r.assets}`;
        } else {
          const v = r[c.k];
          td.className = `num ${c.sign ? cls(v) : ''}`;
          td.textContent = fmt(v, c.d, c.sign);
          if (c.ci && r.lo !== undefined) {
            const ci = document.createElement('span');
            ci.style.cssText = 'color:#8994A8;font-size:.82em;margin-left:.35rem';
            ci.textContent = `[${fmt(r.lo, 2, true)}, ${fmt(r.hi, 2, true)}]`;
            td.appendChild(ci);
          }
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });

    document.getElementById('results-note').textContent = t(NOTES[current]);

    const chartHost = document.getElementById('dist-chart');
    const selectedTask = TASKS.find(x => x.key === current);
    if (selectedTask.kind === 'episode') {
      chartHost.closest('div').style.display = '';
      window.LOCharts.distributionChart(chartHost, data.models, dist, current);
    } else {
      chartHost.closest('div').style.display = 'none';
    }
  }

  function buildSeg() {
    const seg = document.getElementById('task-seg');
    seg.innerHTML = '';
    TASKS.forEach(t => {
      const b = document.createElement('button');
      b.textContent = window.LOI18n.t(t.labelKey);
      b.className = t.key === current ? 'on' : '';
      b.onclick = () => {
        current = t.key; sortKey = null; sortDir = -1;
        [...seg.children].forEach(c => c.classList.toggle('on', c === b));
        render();
      };
      seg.appendChild(b);
    });
  }

  async function init() {
    const [a, b] = await Promise.all([
      fetch('data/results.json').then(r => r.json()),
      fetch('data/distributions.json').then(r => r.json()),
    ]);
    data = a; dist = b;
    buildSeg();
    render();
    let t;
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(render, 150); });
  }

  window.addEventListener('lo:languagechange', () => {
    if (data && dist) { buildSeg(); render(); }
  });

  init().catch(e => {
    document.getElementById('results-note').textContent =
      t('results.error', {message: e.message});
  });
})();
