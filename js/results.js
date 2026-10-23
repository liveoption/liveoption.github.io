/* The results table and the distribution strip.
   Every number is read from the exported JSON and formatted here, so the
   page and the manuscript round once, in the same place. */

(function () {
  const TASKS = [
    { key: 'Earnings', label: 'Earnings Bet', kind: 'episode' },
    { key: '0DTE', label: '0DTE Intraday', kind: 'episode' },
    { key: 'Hedging', label: 'Overlay · Hedging', kind: 'overlay' },
    { key: 'Covered Call', label: 'Overlay · Covered Call', kind: 'overlay' },
    { key: 'Greeks', label: 'Greek attribution', kind: 'greeks' },
  ];

  const EPISODE_COLS = [
    { k: 'model', t: 'Model', type: 'model' },
    { k: 'n', t: 'n', d: 0 },
    { k: 'mean', t: 'Mean %', d: 2, sign: true, ci: true },
    { k: 'median', t: 'Median %', d: 2, sign: true },
    { k: 'win', t: 'Win %', d: 1 },
    { k: 'noTrade', t: 'No-trade %', d: 1 },
    { k: 'pf', t: 'PF', d: 2 },
  ];
  const OVERLAY_COLS = [
    { k: 'model', t: 'Model', type: 'model' },
    { k: 'active', t: 'Active return (pp)', d: 2, sign: true },
    { k: 'ir', t: 'Information ratio', d: 2, sign: true },
    { k: 'ddReduction', t: 'Drawdown reduction (pp)', d: 2, sign: true },
    { k: 'assetsPositive', t: 'Assets positive', type: 'frac' },
  ];
  const GREEK_COLS = [
    { k: 'model', t: 'Model', type: 'model' },
    { k: 'task', t: 'Task', type: 'text' },
    { k: 'cases', t: 'Episodes', d: 0 },
    { k: 'delta', t: 'δ', d: 0, sign: true },
    { k: 'gamma', t: 'γ', d: 0, sign: true },
    { k: 'theta', t: 'θ', d: 0, sign: true },
    { k: 'vega', t: 'ν', d: 0, sign: true },
    { k: 'residual', t: 'Residual', d: 0, sign: true },
  ];

  const NOTES = {
    Earnings: 'Entered two sessions before a scheduled announcement and carried through it. n varies because individual cases were excluded per model.',
    '0DTE': 'SPY options expiring at the close, 102 sessions per model, identical set across the panel.',
    Hedging: 'Protective overlay on an existing equity position, five assets. Active return is against the matched buy-and-hold portfolio.',
    'Covered Call': 'Yield overlay on the same five assets. Descriptive only at five assets per cell.',
    Greeks: 'Mean PnL per episode attributed to each first-order Greek, in dollars, plus the residual a first-order expansion cannot explain.',
  };

  let data, dist, current = 'Earnings', sortKey = null, sortDir = -1;

  const fmt = (v, d, sign) => {
    if (v === null || v === undefined || Number.isNaN(v)) return '—';
    const s = Number(v).toFixed(d);
    return sign && v > 0 ? `+${s}` : s;
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
      th.textContent = c.t;
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
        if (typeof av === 'string') return av.localeCompare(bv) * sortDir;
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
          td.textContent = r[c.k];
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

    document.getElementById('results-note').textContent = NOTES[current] || '';

    const chartHost = document.getElementById('dist-chart');
    const t = TASKS.find(x => x.key === current);
    if (t.kind === 'episode') {
      chartHost.closest('div').style.display = '';
      window.LOCharts.distributionChart(chartHost, data.models, dist, current);
    } else {
      chartHost.closest('div').style.display = 'none';
    }
  }

  function buildSeg() {
    const seg = document.getElementById('task-seg');
    TASKS.forEach(t => {
      const b = document.createElement('button');
      b.textContent = t.label;
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

  init().catch(e => {
    document.getElementById('results-note').textContent =
      `Could not load the results data: ${e.message}`;
  });
})();
