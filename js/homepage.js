/* Homepage figures use the same exported numbers as the detailed results. */
(function () {
  'use strict';
  const host = document.getElementById('visual-explorer');
  if (!host) return;
  const {t, number} = window.LOI18n;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let data, task = 'Earnings', mode = 'Hedging', selected = 'deepseek-v4-flash';
  const colors = ['#187e75','#ce692e','#6c64ac','#718095'];
  const structures = ['Single-leg','Vertical / two-leg','Straddle / strangle / condor','Other multi-leg'];
  const format = (value, digits = 2, sign = false) => number(value, digits, sign);
  const button = (model, index) => `<button type="button" data-viz-model="${esc(model.id)}" aria-pressed="${model.id === selected}" class="viz-model ${model.id === selected ? 'on' : ''}"><i style="background:${model.color}"></i>${index === undefined ? '' : number(index + 1) + ' · '}${esc(model.short)}</button>`;
  const options = entries => entries.map(([value,key,current]) => `<option value="${value}" ${current ? 'selected' : ''}>${esc(t(key))}</option>`).join('');
  const scroll = (svg,label) => `<div class="viz-scroll" tabindex="0" role="region" aria-label="${esc(t(label))}">${svg}</div>`;
  const svg = (width,height,label,body) => `<svg viewBox="0 0 ${width} ${height}" class="viz-chart" role="group" aria-label="${esc(t(label))}">${body}</svg>`;
  const text = (x,y,value,anchor='start',extra='') => `<text x="${x}" y="${y}" text-anchor="${anchor}" ${extra}>${esc(value)}</text>`;
  const line = (x1,y1,x2,y2,extra='') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${extra}/>`;
  const target = (model, body) => `<g data-viz-model="${esc(model.id)}" tabindex="0" role="button" aria-label="${esc(model.name)}" aria-pressed="${model.id === selected}">${body}</g>`;

  function intervals() {
    const rows = data.episodes.map(row => ({...row[task], model:data.models.find(model => model.id === row.model)}));
    const lo = Math.min(...rows.flatMap(row => [row.lo,row.median]),0) - .25, hi = Math.max(...rows.flatMap(row => [row.hi,row.median]),0) + .25;
    const x = value => 210 + (value - lo) / (hi - lo) * 500;
    let body = '';
    for (let i=0;i<5;i++) {
      const value = lo + (hi-lo)*i/4;
      body += line(x(value),22,x(value),350,'class="viz-gridline"') + text(x(value),379,`${format(value,1,true)}%`,'middle');
    }
    body += line(x(0),20,x(0),350,'class="viz-zero"');
    rows.forEach((row,i) => {
      const y = 40 + i*40, active = row.model.id === selected;
      body += target(row.model, `<title>${esc(row.model.name)} · ${esc(t('viz.intervalValue',{mean:format(row.mean,2,true),lo:format(row.lo,2,true),hi:format(row.hi,2,true),median:format(row.median,2,true),n:number(row.n)}))}</title><rect x="0" y="${y-17}" width="780" height="36" rx="6" fill="${active ? '#eaf5f2' : 'transparent'}"/>${text(12,y+4,row.model.short,'start',active ? 'font-weight="700"' : '')}${line(x(row.lo),y,x(row.hi),y,`stroke="${row.model.color}" stroke-width="3"`)}${line(x(row.lo),y-5,x(row.lo),y+5,`stroke="${row.model.color}"`)}${line(x(row.hi),y-5,x(row.hi),y+5,`stroke="${row.model.color}"`)}<circle cx="${x(row.mean)}" cy="${y}" r="${active ? 7 : 5}" fill="${row.model.color}"/><path d="M${x(row.median)},${y-6} l6,6 l-6,6 l-6,-6z" fill="#fff" stroke="${row.model.color}" stroke-width="2"/>${text(772,y+4,format(row.mean,2,true),'end')}`);
    });
    const row = rows.find(row=>row.model.id===selected);
    return scroll(svg(790,400,'viz.returnTitle',body),'viz.returnTitle') + `<p class="viz-selected" data-viz-summary="returns"><strong>${esc(row.model.name)}</strong> · ${esc(t('viz.intervalValue',{mean:format(row.mean,2,true),lo:format(row.lo,2,true),hi:format(row.hi,2,true),median:format(row.median,2,true),n:number(row.n)}))}</p>`;
  }

  function tradeoff() {
    const rows = data.overlay.map(row=>({...row[mode],model:data.models.find(model=>model.id===row.model)}));
    const lo = Math.min(...rows.map(row=>row.active),0)-1, hi = Math.max(...rows.map(row=>row.active),0)+1;
    const bottom = Math.min(...rows.map(row=>row.ddReduction),0)-1, top = Math.max(...rows.map(row=>row.ddReduction),0)+1;
    const x = value=>70+(value-lo)/(hi-lo)*440, y = value=>280-(value-bottom)/(top-bottom)*235;
    let body='';
    for(let i=0;i<5;i++){
      const xv=lo+(hi-lo)*i/4, yv=bottom+(top-bottom)*i/4;
      body+=line(x(xv),45,x(xv),280,'class="viz-gridline"')+text(x(xv),303,format(xv,1,true),'middle');
      body+=line(70,y(yv),510,y(yv),'class="viz-gridline"')+text(58,y(yv)+4,format(yv,1,true),'end');
    }
    body+=line(x(0),45,x(0),280,'class="viz-zero"')+line(70,y(0),510,y(0),'class="viz-zero"');
    body+=text(70,22,t('viz.drawdownAxis'))+text(290,335,t('viz.activeAxis'),'middle');
    rows.forEach((row,index)=>{
      const active=row.model.id===selected;
      body+=target(row.model,`<title>${esc(row.model.name)} · ${esc(t('viz.tradeoffValue',{active:format(row.active,2,true),dd:format(row.ddReduction,2,true)}))}</title><circle cx="${x(row.active)}" cy="${y(row.ddReduction)}" r="${active?10:7}" fill="${row.model.color}" stroke="${active?'#172c34':'#fff'}" stroke-width="${active?3:2}"/>${text(x(row.active)+12,y(row.ddReduction)-9,number(index+1))}`);
    });
    const row=rows.find(row=>row.model.id===selected);
    return scroll(svg(560,350,'viz.tradeoffTitle',body),'viz.tradeoffTitle')+`<div class="viz-model-key">${data.models.map(button).join('')}</div><p class="viz-selected" data-viz-summary="tradeoff"><strong>${esc(row.model.name)}</strong> · ${esc(t('viz.tradeoffValue',{active:format(row.active,2,true),dd:format(row.ddReduction,2,true)}))}</p>`;
  }

  function composition() {
    let body='';
    data.models.forEach((model,i)=>{
      const row=data.composition.find(row=>row.model===model.id), y=25+i*38;
      let x=184;
      body+=target(model,`<title>${esc(model.name)} · ${structures.map((key,index)=>`${esc(t(`viz.structure${index}`))}: ${format(row.structures[key])}%`).join(' · ')}</title><rect x="0" y="${y-12}" width="560" height="32" rx="5" fill="${model.id===selected?'#eaf5f2':'transparent'}"/>${text(8,y+8,model.short)}${structures.map((key,index)=>{
        const width=row.structures[key]/100*355;
        const rect=`<rect x="${x}" y="${y-4}" width="${width}" height="18" fill="${colors[index]}"/>`;x+=width;return rect;
      }).join('')}`);
    });
    body+=text(184,350,'0%')+text(539,350,'100%','end');
    const row=data.composition.find(row=>row.model===selected);
    return scroll(svg(560,365,'viz.structureTitle',body),'viz.structureTitle')+`<div class="viz-structure-key">${structures.map((_,index)=>`<span><i style="background:${colors[index]}"></i>${esc(t(`viz.structure${index}`))}</span>`).join('')}</div><p class="viz-selected" data-viz-summary="structures">${structures.map((key,index)=>`${esc(t(`viz.structure${index}`))} ${format(row.structures[key])}%`).join(' · ')}</p>`;
  }

  function render() {
    if(!data)return;
    host.innerHTML=`<div class="viz-toolbar"><label>${esc(t('viz.highlight'))}<select id="viz-model">${data.models.map(model=>`<option value="${esc(model.id)}" ${model.id===selected?'selected':''}>${esc(model.name)}</option>`).join('')}</select></label><span class="note">${esc(t('viz.interact'))}</span></div>
      <div class="viz-panels"><article class="panel viz-wide"><div class="viz-toolbar"><h3>${esc(t('viz.returnTitle'))}</h3><label>${esc(t('column.task'))}<select id="viz-task">${options([['Earnings','results.task.earnings',task==='Earnings'],['0DTE','results.task.0dte',task==='0DTE']])}</select></label></div><p class="note">${esc(t('viz.returnNote'))}</p>${intervals()}</article>
      <article class="panel"><div class="viz-toolbar"><h3>${esc(t('viz.tradeoffTitle'))}</h3><label>${esc(t('viz.mandate'))}<select id="viz-mode">${options([['Hedging','results.task.hedging',mode==='Hedging'],['Covered Call','results.task.covered',mode==='Covered Call']])}</select></label></div><p class="note">${esc(t('viz.tradeoffNote'))}</p>${tradeoff()}</article>
      <article class="panel"><h3>${esc(t('viz.structureTitle'))}</h3><p class="note">${esc(t('viz.structureNote'))}</p>${composition()}</article></div>`;
    host.querySelector('#viz-model').onchange=event=>{selected=event.target.value;render();};
    host.querySelector('#viz-task').onchange=event=>{task=event.target.value;render();};
    host.querySelector('#viz-mode').onchange=event=>{mode=event.target.value;render();};
    host.querySelectorAll('[data-viz-model]').forEach(node=>{
      node.onclick=()=>{selected=node.dataset.vizModel;render();};
      if(node.tagName.toLowerCase()==='g')node.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();node.onclick();}};
    });
  }
  window.addEventListener('lo:languagechange',render);
  fetch('data/results.json').then(response=>{if(!response.ok)throw new Error('Unavailable results');return response.json();}).then(result=>{data=result;render();}).catch(()=>{host.textContent=t('viz.error');});
})();
