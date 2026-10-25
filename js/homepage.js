/* Homepage figures use the same exported numbers as the detailed results. */
(function () {
  'use strict';
  const host = document.getElementById('visual-explorer');
  if (!host) return;
  const {t, number} = window.LOI18n;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let data, dist, task = 'Earnings', mode = 'Hedging', selected = 'deepseek-v4-flash', view = 'returns', ticker = 'QQQ';
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
    return scroll(svg(790,400,'viz.returnTitle',body),'viz.returnTitle');
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
    return scroll(svg(560,350,'viz.tradeoffTitle',body),'viz.tradeoffTitle')+`<div class="viz-model-key">${data.models.map(button).join('')}</div>`;
  }

  const assetRows=()=>data.perAsset.filter(row=>row.mode===(mode==='Hedging'?'Hedge':'Income'));
  const assetList=()=>[...new Set(data.perAsset.map(row=>row.ticker))].sort();
  const syncTables=()=>window.dispatchEvent(new CustomEvent('lo:result-task',{detail:{task:view==='returns'||view==='distribution'?task:mode}}));
  const stat=(key,value)=>`<div><dt>${esc(t(key))}</dt><dd>${esc(value)}</dd></div>`;
  function heatmap(){
    const rows=assetRows(),max=Math.max(1,...rows.map(row=>Math.abs(row.active)));
    return `<div class="dashboard-heatmap" tabindex="0" role="region" aria-label="${esc(t('dash.assets'))}"><table><caption>${esc(t('dash.assetCaption'))}</caption><thead><tr><th>${esc(t('column.model'))}</th>${assetList().map(asset=>`<th>${asset}</th>`).join('')}</tr></thead><tbody>${data.models.map(model=>`<tr><th>${esc(model.short)}</th>${assetList().map(asset=>{const row=rows.find(row=>row.model===model.id&&row.ticker===asset),active=model.id===selected&&asset===ticker,color=row.active>=0?'24,126,117':'181,72,57';return `<td><button type="button" id="asset-${model.id}-${asset}" data-asset-model="${model.id}" data-asset-ticker="${asset}" class="${active?'on':''}" aria-pressed="${active}" aria-label="${esc(model.name)} · ${asset} · ${esc(format(row.active,2,true))} pp" style="background:rgba(${color},${.06+Math.abs(row.active)/max*.18})">${esc(format(row.active,2,true))}</button></td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function summary(){
    const model=data.models.find(model=>model.id===selected);
    let content='';
    if(view==='returns'||view==='distribution'){
      const row=data.episodes.find(row=>row.model===selected)[task];
      content=stat('column.mean',`${format(row.mean,2,true)}%`)+stat('column.median',`${format(row.median,2,true)}%`)+stat('column.win',`${format(row.win,1)}%`)+stat('column.noTrade',`${format(row.noTrade,1)}%`)+stat('column.n',number(row.n))+stat('dash.ci',`[${format(row.lo,2,true)}, ${format(row.hi,2,true)}]%`);
    }else if(view==='overlay'){
      const row=data.overlay.find(row=>row.model===selected)[mode];
      content=stat('dash.active',`${format(row.active,2,true)} pp`)+stat('dash.dd',`${format(row.ddReduction,2,true)} pp`)+stat('column.ir',format(row.ir))+stat('column.assetsPositive',`${number(row.assetsPositive)}/${number(row.assets)}`);
    }else{
      const row=assetRows().find(row=>row.model===selected&&row.ticker===ticker);
      content=stat('dash.ticker',ticker)+stat('replay.return',`${format(row.ret,2,true)}%`)+stat('dash.benchmark',`${format(row.bench,2,true)}%`)+stat('dash.active',`${format(row.active,2,true)} pp`)+stat('dash.mdd',`${format(row.mdd)}%`)+stat('dash.dd',`${format(row.ddReduction,2,true)} pp`);
    }
    return `<aside class="dashboard-inspector"><span class="eyebrow">${esc(t('dash.selected'))}</span><h3><i style="background:${model.color}"></i>${esc(model.name)}</h3><dl data-dashboard-summary>${content}</dl><p class="note">${esc(t(view==='assets'?'dash.assetScope':view==='overlay'?'viz.tradeoffNote':'dash.episodeScope'))}</p></aside>`;
  }
  function render(){
    if(!data||!dist)return;
    const focus=host.contains(document.activeElement)?document.activeElement.id:null;
    const episodic=view==='returns'||view==='distribution';
    const keys={returns:'viz.returnTitle',distribution:'results.distributionTitle',overlay:'viz.tradeoffTitle',assets:'dash.assets'};
    const notes={returns:'viz.returnNote',distribution:'results.distributionIntro',overlay:'viz.tradeoffNote',assets:'dash.assetCaption'};
    host.innerHTML=`<div class="results-facts">${[['dash.models',data.models.length],['dash.tasks',3],['dash.sessions',data.episodes[0]['0DTE'].n],['dash.assetCount',assetList().length]].map(([key,value])=>`<div><strong>${number(value)}</strong><span>${esc(t(key))}</span></div>`).join('')}</div>
      <div class="results-dashboard"><div class="dashboard-tabs" role="group" aria-label="${esc(t('layout.resultsNav'))}">${['returns','distribution','overlay','assets'].map(key=>`<button type="button" id="dashboard-view-${key}" data-dashboard-view="${key}" class="${view===key?'on':''}" aria-pressed="${view===key}">${esc(t(`dash.${key}`))}</button>`).join('')}</div>
      <div class="dashboard-toolbar"><label>${esc(t('viz.highlight'))}<select id="viz-model">${data.models.map(model=>`<option value="${esc(model.id)}" ${model.id===selected?'selected':''}>${esc(model.name)}</option>`).join('')}</select></label>${episodic?`<label>${esc(t('column.task'))}<select id="viz-task">${options([['Earnings','results.task.earnings',task==='Earnings'],['0DTE','results.task.0dte',task==='0DTE']])}</select></label>`:`<label>${esc(t('viz.mandate'))}<select id="viz-mode">${options([['Hedging','results.task.hedging',mode==='Hedging'],['Covered Call','results.task.covered',mode==='Covered Call']])}</select></label>`}<p>${esc(t('dash.interact'))}</p></div>
      <div class="dashboard-main"><article class="dashboard-plot"><h3>${esc(t(keys[view]))}</h3><p class="note">${esc(t(notes[view]))}</p>${view==='returns'?intervals():view==='overlay'?tradeoff():view==='assets'?heatmap():`<div class="dashboard-dist-scroll" tabindex="0" role="region" aria-label="${esc(t('results.distributionTitle'))}"><div id="dashboard-distribution"></div></div>`}<p class="dashboard-scroll-hint">${esc(t('viz.scrollHint'))}</p></article>${summary()}</div></div>`;
    if(view==='distribution')window.LOCharts.distributionChart(document.getElementById('dashboard-distribution'),data.models,dist,task,selected);
    host.querySelector('#viz-model').onchange=event=>{selected=event.target.value;render();};
    host.querySelector('#viz-task')?.addEventListener('change',event=>{task=event.target.value;render();syncTables();});
    host.querySelector('#viz-mode')?.addEventListener('change',event=>{mode=event.target.value;render();syncTables();});
    host.querySelectorAll('[data-dashboard-view]').forEach(button=>{button.onclick=()=>{view=button.dataset.dashboardView;render();syncTables();};});
    host.querySelectorAll('[data-viz-model]').forEach(node=>{node.onclick=()=>{selected=node.dataset.vizModel;render();};if(node.tagName.toLowerCase()==='g')node.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();node.onclick();}};});
    host.querySelectorAll('[data-asset-model]').forEach(button=>{button.onclick=()=>{selected=button.dataset.assetModel;ticker=button.dataset.assetTicker;render();};});
    if(focus)document.getElementById(focus)?.focus({preventScroll:true});
  }
  window.addEventListener('lo:languagechange',render);
  Promise.all(['data/results.json','data/distributions.json'].map(path=>fetch(path).then(response=>{if(!response.ok)throw new Error('Unavailable results');return response.json();}))).then(([results,distribution])=>{data=results;dist=distribution;render();}).catch(()=>{host.textContent=t('viz.error');});
})();
