/* Read-only case previews inside the shared task dialog. */
(function () {
  'use strict';
  const {t,number,date}=window.LOI18n;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cache=new Map();
  let task,caseIDs=[],caseID,model='deepseek-v4-flash',chart='price',seq=0,run,market,catalog,models,generation=0,loading=false,failed=false;
  const host=()=>document.getElementById('scene-example');
  const read=path=>{
    if(!cache.has(path))cache.set(path,fetch(path).then(r=>{if(!r.ok)throw new Error('Unavailable archive');return r.json();}).catch(error=>{cache.delete(path);throw error;}));
    return cache.get(path);
  };
  const fmt=(value,digits=2,signed=false)=>number(value,digits,signed);
  const pct=value=>`${fmt(value*100,2,true)}%`;
  const clock=time=>new Intl.DateTimeFormat(window.LOI18n.locale,{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(time));
  const stamp=row=>`${date(row.day)} · ${clock(row.time)} ET`;
  const svg=(body,label,height=300)=>`<div class="case-chart-scroll" tabindex="0" role="region" aria-label="${esc(t(label))}"><svg viewBox="0 0 680 ${height}" role="group" aria-label="${esc(t(label))}">${body}</svg></div>`;
  const text=(x,y,value,anchor='start')=>`<text x="${x}" y="${y}" text-anchor="${anchor}">${esc(value)}</text>`;

  async function load() {
    const current=++generation;loading=true;failed=false;run=null;render();
    try{
      [catalog,models]=await Promise.all([read('data/replays/index.json'),read('data/results.json')]);
      if(current!==generation)return;
      const entry=catalog.find(row=>row.scenario===caseID&&row.model===model);
      if(!entry)throw new Error('Missing case');
      const data=await Promise.all([read(`data/replays/${entry.path}`),read(`data/market/${caseID}.json`)]);
      if(current!==generation)return;
      run=data[0];market={...data[1],bars:data[1].bars.filter(bar=>bar.time.slice(0,10)>=run.daily[0].day&&bar.time.slice(0,10)<=run.daily.at(-1).day)};
      seq=run.decisions.some(row=>row.seq===seq)?seq:0;
    }catch(_){if(current===generation)failed=true;}
    finally{if(current===generation){loading=false;render();}}
  }

  function candles(){
    const bars=market.bars,minute=market.resolution==='1m';
    if(!bars.length)return `<p>${esc(t('replay.noPrices'))}</p>`;
    const low=Math.min(...bars.map(row=>row.low)),high=Math.max(...bars.map(row=>row.high)),span=high-low||1;
    const x=index=>65+index/(bars.length-1||1)*580,y=value=>22+(high-value)/span*200;
    let body='';
    for(let i=0;i<4;i++){const value=low+span*i/3;body+=`<line x1="60" x2="650" y1="${y(value)}" y2="${y(value)}" class="viz-gridline"/>`+text(4,y(value)+4,fmt(value));}
    const width=Math.max(1,Math.min(12,430/bars.length));
    bars.forEach((bar,index)=>{
      const color=bar.close>=bar.open?'#20856c':'#c65b5b';
      body+=`<g><title>${esc(minute?clock(bar.time):date(bar.time))} · O ${fmt(bar.open)} H ${fmt(bar.high)} L ${fmt(bar.low)} C ${fmt(bar.close)}</title><line x1="${x(index)}" x2="${x(index)}" y1="${y(bar.high)}" y2="${y(bar.low)}" stroke="${color}"/><rect x="${x(index)-width/2}" y="${Math.min(y(bar.open),y(bar.close))}" width="${width}" height="${Math.max(1,Math.abs(y(bar.open)-y(bar.close)))}" fill="${color}"/></g>`;
    });
    const lanes=[];
    run.decisions.forEach(record=>{
      let index=bars.findIndex(bar=>bar.time===record.day);
      if(minute){let distance=Infinity;bars.forEach((bar,i)=>{const delta=Math.abs(Date.parse(bar.time)-Date.parse(record.time));if(delta<distance){distance=delta;index=i;}});if(distance>60000)index=-1;}
      if(index<0)return;
      let lane=lanes.findIndex(last=>x(index)-last>=22);
      if(lane<0)lane=lanes.length;
      lanes[lane]=x(index);
      const cy=242+lane*20;
      body+=`<g id="case-node-${record.seq}" data-case-decision="${record.seq}" role="button" tabindex="0" aria-label="${esc(t('replay.checkpoint',{seq:number(record.seq+1),time:stamp(record)}))}"><title>${esc(stamp(record))}</title><rect x="${x(index)-6}" y="${cy-8}" width="12" height="16" fill="transparent"/><circle cx="${x(index)}" cy="${cy}" r="${record.seq===seq?7:4}" fill="${record.orders.length?'#2864aa':'#697687'}" stroke="${record.seq===seq?'#172c34':'#fff'}" stroke-width="2"/></g>`;
    });
    const height=Math.max(300,270+lanes.length*20);
    body+=text(65,height-15,minute?clock(bars[0].time):date(bars[0].time))+text(645,height-15,minute?clock(bars.at(-1).time):date(bars.at(-1).time),'end');
    return svg(body,'replay.market',height);
  }

  function returns(){
    const minute=market.resolution==='1m';
    const account=run.equity.map(row=>({x:Date.parse(minute?row.time:row.day),value:(row.equity/run.baseline.equity-1)*100}));
    const bars=market.bars.filter(bar=>minute?Date.parse(bar.time)>=Date.parse(run.baseline.time):bar.time>=run.baseline.day);
    const asset=bars.length?bars.map(bar=>({x:Date.parse(bar.time),value:(bar.close/bars[0].close-1)*100})):[];
    const all=[...account,...asset],lo=Math.min(0,...all.map(row=>row.value)),hi=Math.max(0,...all.map(row=>row.value)),span=hi-lo||1;
    const start=Math.min(...all.map(row=>row.x)),end=Math.max(...all.map(row=>row.x));
    const x=value=>65+(value-start)/(end-start||1)*580,y=value=>22+(hi-value)/span*205;
    let body='';
    for(let i=0;i<4;i++){const value=lo+span*i/3;body+=`<line x1="60" x2="650" y1="${y(value)}" y2="${y(value)}" class="viz-gridline"/>`+text(2,y(value)+4,`${fmt(value,1)}%`);}
    [[account,'#176c60'],[asset,'#be701d']].forEach(([rows,color])=>{if(rows.length)body+=`<polyline fill="none" stroke="${color}" stroke-width="2.5" points="${rows.map(row=>`${x(row.x)},${y(row.value)}`).join(' ')}"/>`;});
    body+=text(65,280,date(run.daily[0].day))+text(645,280,date(run.daily.at(-1).day),'end');
    return svg(body,'replay.returns')+`<div class="case-return-key"><span><i style="background:#176c60"></i>${esc(t('replay.return'))}</span><span><i style="background:#be701d"></i>${esc(t('replay.asset',{ticker:market.ticker}))}</span></div><p class="note">${esc(t('replay.returnNote'))}</p>`;
  }

  function render(){
    const root=host();if(!root)return;
    const focusID=root.contains(document.activeElement)?document.activeElement.id:null;
    const restoreFocus=()=>{if(focusID)document.getElementById(focusID)?.focus({preventScroll:true});};
    const controls=`<div class="case-controls"><label>${esc(t('demo.chooseScenario'))}<select id="case-scenario">${caseIDs.map(id=>`<option value="${id}" ${id===caseID?'selected':''}>${esc(t(`scenario.${id}.title`))}</option>`).join('')}</select></label>${models?`<label>${esc(t('replay.model'))}<select id="case-model">${models.models.map(row=>`<option value="${row.id}" ${row.id===model?'selected':''}>${esc(row.name)}</option>`).join('')}</select></label>`:''}</div>`;
    if(loading||failed||!run){root.innerHTML=controls+`<p role="status">${esc(t(failed?'replay.unavailable':'replay.loading'))}</p>${failed?`<button class="btn btn-sm" id="case-retry" type="button">${esc(t('replay.retry'))}</button>`:''}`;bind();restoreFocus();return;}
    const record=run.decisions.find(row=>row.seq===seq)||run.decisions[0];
    const completed=run.completion?.recorded_finish&&run.completion.exit_code===0;
    const href=`demos.html?task=${task}&scenario=${caseID}&model=${model}&view=market`;
    root.innerHTML=controls+`<p class="note">${esc(t('case.recordedNote'))}</p>${completed?'':`<p class="replay-status-partial">${esc(t('replay.failed',{code:run.completion?.exit_code??'—'}))}</p>`}
      <div class="case-kpis">${[['replay.return',pct(run.summary.return)],['replay.drawdown',pct(-run.summary.max_daily_drawdown)],['replay.decisions',number(run.decisions.length)],['replay.fills',number(run.fills.length)]].map(([key,value])=>`<div><span>${esc(t(key))}</span><strong>${esc(value)}</strong></div>`).join('')}</div>
      <div class="seg case-chart-tabs">${['price','returns'].map(id=>`<button type="button" id="case-chart-${id}" data-case-chart="${id}" class="${chart===id?'on':''}" aria-pressed="${chart===id}">${esc(t(id==='price'?'replay.price':'replay.returns'))}</button>`).join('')}</div>
      ${chart==='price'?candles():returns()}<p class="note">${esc(t('case.chartNote'))}</p>
      <label>${esc(t('replay.selectDecision'))}<select id="case-decision">${run.decisions.map(row=>`<option value="${row.seq}" ${row.seq===seq?'selected':''}>#${number(row.seq+1)} · ${esc(stamp(row))}</option>`).join('')}</select></label>
      <article class="case-decision"><h3>${esc(t('replay.record',{seq:number(record.seq+1)}))}</h3><p class="note">${esc(stamp(record))} · ${esc(t(record.orders.length?'replay.proposed':'replay.noOrder'))}</p><p class="note">${esc(t('replay.original'))}</p><div class="case-reasoning" lang="en">${esc(record.reasoning||t('replay.noReason'))}</div><h4>${esc(t('replay.orders'))}</h4>${record.orders.length?`<ul lang="en">${record.orders.map(order=>`<li>${esc(order.side||order.action)} · ${esc(order.contract||order.symbol)} · ${esc(t('replay.quantity'))} ${fmt(order.qty??order.quantity,0)}</li>`).join('')}</ul>`:`<p>${esc(t('replay.noOrder'))}</p>`}</article>
      <a class="btn btn-sm" href="${href}" target="_blank" rel="noopener">${esc(t('case.fullReplay'))}</a>`;
    bind();window.LOI18n.apply(root);restoreFocus();
  }
  function bind(){
    const root=host();
    root.querySelector('#case-scenario')?.addEventListener('change',event=>{caseID=event.target.value;seq=0;load();});
    root.querySelector('#case-model')?.addEventListener('change',event=>{model=event.target.value;seq=0;load();});
    root.querySelector('#case-retry')?.addEventListener('click',load);
    root.querySelector('#case-decision')?.addEventListener('change',event=>{seq=Number(event.target.value);render();});
    root.querySelectorAll('[data-case-chart]').forEach(button=>{button.onclick=()=>{chart=button.dataset.caseChart;render();};});
    root.querySelectorAll('[data-case-decision]').forEach(node=>{node.onclick=()=>{seq=Number(node.dataset.caseDecision);render();};node.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();node.onclick();}};});
  }
  window.addEventListener('lo:scene-render',event=>{
    ++generation;
    if(task!==event.detail.task){task=event.detail.task;caseID=event.detail.cases[0];seq=0;run=null;}
    caseIDs=event.detail.cases;
    if(!host())return;
    if(run){loading=false;render();}else load();
  });
  document.getElementById('scenario-guide')?.addEventListener('close',()=>{++generation;});
})();
