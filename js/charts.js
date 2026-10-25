/* Inline SVG charts, drawn from the paper's own numbers.
   No chart library: the page draws two shapes and both want behaviour a
   general library makes awkward — a strip of every episode behind a box, and
   a one-question comparison strip. Hand-drawn SVG is also what keeps the
   series colours identical to the manuscript figures. */

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}, text) {
  const n = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}

function quantile(sorted, q) {
  if (!sorted.length) return NaN;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/* A deterministic jitter, so the strip looks the same on every reload and a
   screenshot of it can be compared with another. */
function jitter(i, seed) {
  const x = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  return (x - Math.floor(x)) - 0.5;
}

/**
 * One row per model: every episode as a dot, with the interquartile box and
 * the median over it. Clipped at the whisker range so a single -170% episode
 * does not flatten the rest; the count of clipped points is annotated.
 */
function distributionChart(host, models, series, task, selectedModel) {
  host.innerHTML = '';
  const rows = models.filter(m => (series[m.id] || {})[task]?.length);
  if (!rows.length) return;

  const W = Math.min(host.clientWidth || 1100, 1100);
  const rowH = 38, padT = 28, padB = 46, padL = 150, padR = 24;
  const H = padT + rows.length * rowH + padB;

  const all = rows.flatMap(m => series[m.id][task]).sort((a, b) => a - b);
  const lo = Math.min(quantile(all, 0.01), -1);
  const hi = Math.max(quantile(all, 0.99), 1);
  const span = hi - lo || 1;
  const x = v => padL + ((Math.max(lo, Math.min(hi, v)) - lo) / span) * (W - padL - padR);

  const svg = el('svg', {
    class: 'chart', viewBox: `0 0 ${W} ${H}`, width: '100%', height: H,
    role: 'img', 'aria-label': window.LOI18n.t('chart.label', {task: window.LOI18n.t(task === 'Earnings' ? 'results.task.earnings' : 'results.task.0dte')}),
  });

  // axis
  const ticks = 7;
  for (let i = 0; i < ticks; i++) {
    const v = lo + (span * i) / (ticks - 1);
    svg.appendChild(el('line', {
      x1: x(v), x2: x(v), y1: padT - 6, y2: H - padB,
      stroke: 'rgba(0,0,0,.06)', 'stroke-width': 1,
    }));
    svg.appendChild(el('text', {
      x: x(v), y: H - padB + 18, 'text-anchor': 'middle',
      'font-size': 11, fill: '#8994A8',
    }, `${v > 0 ? '+' : ''}${v.toFixed(0)}%`));
  }
  svg.appendChild(el('line', {
    x1: x(0), x2: x(0), y1: padT - 6, y2: H - padB,
    stroke: 'rgba(0,0,0,.35)', 'stroke-width': 1.2, 'stroke-dasharray': '3 3',
  }));

  rows.forEach((m, r) => {
    const v = [...series[m.id][task]].sort((a, b) => a - b);
    const y = padT + r * rowH + rowH / 2;
    if (m.id === selectedModel) svg.appendChild(el('rect', {x:0,y:y-17,width:W,height:34,rx:6,fill:'#eaf5f2'}));
    const q1 = quantile(v, 0.25), med = quantile(v, 0.5), q3 = quantile(v, 0.75);
    const clipped = v.filter(d => d < lo || d > hi).length;

    svg.appendChild(el('text', {
      x: padL - 12, y: y + 4, 'text-anchor': 'end',
      'font-size': 12, 'font-weight': 600, fill: '#1A1D2E',
    }, m.short));

    v.forEach((d, i) => {
      svg.appendChild(el('circle', {
        cx: x(d), cy: y + jitter(i, r) * 13, r: 2.1,
        fill: m.color, 'fill-opacity': 0.3,
      }));
    });

    svg.appendChild(el('rect', {
      x: x(q1), y: y - 8, width: Math.max(x(q3) - x(q1), 1), height: 16,
      fill: m.color, 'fill-opacity': 0.16,
      stroke: m.color, 'stroke-opacity': 0.55, rx: 3,
    }));
    svg.appendChild(el('line', {
      x1: x(med), x2: x(med), y1: y - 10, y2: y + 10,
      stroke: m.color, 'stroke-width': 2.4, 'stroke-linecap': 'round',
    }));

    if (clipped) {
      svg.appendChild(el('text', {
        x: W - padR, y: y + 4, 'text-anchor': 'end',
        'font-size': 10, fill: '#8994A8',
      }, window.LOI18n.t('chart.beyond', {count: clipped})));
    }
  });

  svg.appendChild(el('text', {
    x: padL + (W - padL - padR) / 2, y: H - 8, 'text-anchor': 'middle',
    'font-size': 11, fill: '#8994A8',
  }, window.LOI18n.t('chart.axis')));

  host.appendChild(svg);
}

window.LOCharts = { distributionChart };
