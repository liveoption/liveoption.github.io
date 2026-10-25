/* Accessible scenario guides with original, localized SVG illustrations. */
(function () {
  'use strict';
  const { t } = window.LOI18n;
  const dialog = document.getElementById('scenario-guide');
  const cases = {
    earnings: ['earnings-meta-q1', 'earnings-nvda-q4'],
    '0dte': ['odte-2025-01-15', 'odte-2025-04-09'],
    overlay: ['overlay-qqq-hedge'],
  };
  const escapeHTML = value => String(value).replace(/[&<>"']/g,
    character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const text = key => escapeHTML(t(key));
  let selected = null;
  let opener = null;
  let previousOverflow = '';
  let view = 'guide';

  function svg(task, viewBox, content) {
    return `<svg class="scene-drawing" viewBox="${viewBox}" role="img" aria-label="${text(`scenes.${task}.figure`)}" xmlns="http://www.w3.org/2000/svg">
      <defs><marker id="scene-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="currentColor"/></marker></defs>
      ${content}</svg>`;
  }

  function illustration(task) {
    let drawing;
    let labels;
    if (task === 'earnings') {
      drawing = svg(task, '0 0 480 180', `
        <path d="M30 150H449" class="scene-axis" marker-end="url(#scene-arrow)"/>
        <path d="M40 123C105 122 142 48 205 28C220 23 232 39 239 65C255 118 317 128 436 129" class="scene-volatility"/>
        <path d="M240 18V151" class="scene-event"/>
        <path d="M231 18L240 9L249 18L240 27Z" fill="var(--secondary)"/>
        <circle cx="45" cy="150" r="6" fill="var(--primary-dark)"/>
        <circle cx="240" cy="150" r="6" fill="var(--secondary)"/>
        <circle cx="435" cy="150" r="6" fill="var(--primary-dark)"/>
        <path d="M70 147V100M64 106L70 100L76 106" class="scene-hint"/>
        <path d="M393 76V116M387 110L393 116L399 110" class="scene-hint"/>
      `);
      labels = `<div class="scene-phase-labels">${[1, 2, 3].map(n => `<span>${text(`scenes.earnings.phase${n}`)}</span>`).join('')}</div>
        <div class="scene-legend"><span class="legend-line"></span>${text('scenes.earnings.curve')}</div>`;
    } else if (task === '0dte') {
      drawing = svg(task, '0 0 600 175', `
        <rect x="20" y="28" width="150" height="72" rx="16" class="scene-node"/>
        <rect x="225" y="28" width="150" height="72" rx="16" class="scene-node"/>
        <rect x="430" y="28" width="150" height="72" rx="16" class="scene-node"/>
        <path d="M176 64H216M381 64H421" class="scene-axis" marker-end="url(#scene-arrow)"/>
        <path d="M505 108V142H95V109" class="scene-loop" marker-end="url(#scene-arrow)"/>
        <path d="M60 64Q95 24 130 64Q95 104 60 64Z" class="scene-icon"/><circle cx="95" cy="64" r="12" class="scene-icon"/>
        <path d="M300 38L327 64L300 90L273 64Z" class="scene-icon"/><path d="M290 64L297 71L311 56" class="scene-icon"/>
        <path d="M481 43V86M476 53H486V72H476ZM506 38V81M501 47H511V66H501ZM531 46V87M526 57H536V76H526Z" class="scene-icon"/>
        <circle cx="300" cy="142" r="6" fill="var(--secondary)"/>
      `);
      labels = `<div class="scene-phase-labels">${[1, 2, 3].map(n => `<span>${text(`scenes.0dte.phase${n}`)}</span>`).join('')}</div>
        <div class="scene-session"><span>${text('scenes.0dte.start')}</span><span class="scene-session-line" aria-hidden="true"></span><span>${text('scenes.0dte.end')}</span></div>`;
    } else {
      drawing = svg(task, '0 0 520 240', `
        <path d="M45 210V25M45 210H487" class="scene-axis" marker-end="url(#scene-arrow)"/>
        <path d="M45 145H480" class="scene-zero"/>
        <path d="M65 205L465 45" class="scene-stock-line"/>
        <path d="M65 170H210L465 68" class="scene-protected-line"/>
        <circle cx="210" cy="170" r="5" fill="var(--primary-dark)"/>
        <path d="M90 172V193M85 187L90 194L95 187" class="scene-hint"/>
      `);
      labels = `<div class="scene-payoff-axis"><span>${text('scenes.overlay.axisY')}</span><span>${text('scenes.overlay.axisX')} →</span></div>
        <div class="scene-legend scene-payoff-legend"><span><i class="legend-line stock"></i>${text('scenes.overlay.stock')}</span><span><i class="legend-line"></i>${text('scenes.overlay.protected')}</span></div>`;
    }
    return `<figure class="scene-figure">${drawing}${labels}
      <figcaption>${text(`scenes.${task}.caption`)}</figcaption>
      <p class="scene-schematic">${text('scenes.schematic')}</p></figure>`;
  }

  function render() {
    if (!selected) return;
    const focusedView=dialog.contains(document.activeElement)?document.activeElement.dataset.sceneView:null;
    document.getElementById('scene-tag').textContent = t(`task.${selected}.name`);
    document.getElementById('scene-title').textContent = t(`task.${selected}.title`);
    document.getElementById('scene-content').innerHTML = `
      <div class="seg scene-view-tabs" role="group" aria-label="${text('case.views')}">${['example','guide'].map(id=>`<button type="button" data-scene-view="${id}" class="${view===id?'on':''}" aria-pressed="${view===id}">${text(`case.${id}`)}</button>`).join('')}</div>
      ${view === 'example' ? '<div id="scene-example"></div>' : `
      <div class="scene-goal"><h3>${text('scenes.goal')}</h3><p>${text(`scenes.${selected}.goal`)}</p></div>
      ${illustration(selected)}
      <div class="scene-explanation-grid">
        ${['observe', 'decide', 'challenge'].map(part => `<section class="scene-explanation ${part}"><h3>${text(`scenes.${part}`)}</h3><p>${text(`scenes.${selected}.${part}`)}</p></section>`).join('')}
      </div>
      <section class="scene-case-section"><h3>${text('scenes.cases')}</h3>
        <div class="scene-cases">${cases[selected].map(id => `<article class="scene-case">
          <h4>${text(`scenario.${id}.title`)}</h4><p>${text(`scenario.${id}.blurb`)}</p>
          <p class="scene-case-focus"><strong>${text('scenes.focus')}</strong><br>${text(`scenes.case.${id}`)}</p>
        </article>`).join('')}</div>
        <p class="note">${text('scenes.recordScope')}</p>
      </section>`}`;
    dialog.querySelectorAll('[data-scene-view]').forEach(button=>{button.onclick=()=>{view=button.dataset.sceneView;render();};});
    window.dispatchEvent(new CustomEvent('lo:scene-render',{detail:{task:selected,cases:cases[selected],view}}));
    if(focusedView)dialog.querySelector(`[data-scene-view="${focusedView}"]`)?.focus({preventScroll:true});
  }

  document.querySelectorAll('[data-scene]').forEach(button => {
    button.addEventListener('click', () => {
      selected = button.dataset.scene;
      if (!cases[selected]) return;
      view = button.dataset.sceneView || 'guide';
      opener = button;
      render();
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      dialog.showModal();
      dialog.scrollTop = 0;
    });
  });
  dialog.querySelector('[data-close-scene]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    opener?.focus({ preventScroll: true });
  });
  window.addEventListener('lo:languagechange',()=>{if(dialog.open)render();});
})();
