/* Agent workflow and explicitly illustrative AVSR/QOCR explainers. */
(function(){
  'use strict';
  const root=document.getElementById('agent-explorer');if(!root)return;
  const {t,number,date}=window.LOI18n;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let view='workflow',stage=0,record,observation,failed=false;
  let level=24,skew=-3,term=2,anchorM=1,anchorT=0,type='CALL',bucketM=1,bucketT=0,qty=2;
  const ms=[.95,1,1.05],ts=[7,30,90],expiryRanges=[[0,14],[15,45],[46,120]],ratioCenters=[.97,1,1.03];
  const iv=(m,days)=>level+skew*(m-1)/.05+6*((m-1)/.05)**2+term*Math.log(days/7)/Math.log(90/7);
  const label=text=>esc(t(text));
  const metric=(key,value)=>`<div><span>${label(key)}</span><strong>${esc(value)}</strong></div>`;
  const contracts=['CALL','PUT'].flatMap(right=>[3,10,21,35,60,90,120].flatMap(dte=>[95,97,99,100,101,103,105].map(strike=>({right,dte,strike,ratio:strike/100}))));
  const members=(mIndex,tIndex)=>contracts.filter(row=>row.right===type&&row.dte>=expiryRanges[tIndex][0]&&row.dte<=expiryRanges[tIndex][1]&&(mIndex===0?row.ratio<.99:mIndex===1?row.ratio>=.99&&row.ratio<=1.01:row.ratio>1.01));

  function workflow(){
    const stages=['context','analyzer','executor','verify'];
    const steps=`<div class="agent-workflow">${stages.map((key,index)=>`<button type="button" id="agent-stage-${index}" data-agent-stage="${index}" class="agent-node ${stage===index?'on':''}" aria-pressed="${stage===index}"><span>${number(index+1)}</span><strong>${label(`agent.${key}`)}</strong><small>${label(`agent.${key}Short`)}</small></button>`).join('')}</div><p class="agent-hold">${label('agent.hold')}</p>`;
    if(!record)return steps+`<p role="status">${label(failed?'replay.unavailable':'replay.loading')}</p>`;
    let artifact='';
    if(stage===0)artifact=`<div class="agent-metrics">${metric('agent.case',t('scenario.earnings-meta-q1.title'))}${metric('replay.day',date(record.day))}</div><details class="agent-artifact"><summary>${label('agent.reference')}</summary><pre lang="en">${esc(observation)}</pre></details>`;
    if(stage===1)artifact=`<p class="agent-original">${label('replay.original')}</p><p lang="en" class="agent-reasoning">${esc(record.reasoning)}</p><ul class="agent-targets" lang="en">${record.targets.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`;
    if(stage===2)artifact=`<div class="agent-order-list">${record.orders.map(order=>`<article><span class="agent-side">${esc(order.side)}</span><code>${esc(order.contract)}</code><strong>${label('replay.quantity')} ${number(order.qty)}</strong></article>`).join('')}</div><p class="note">${label('agent.orderNote')}</p>`;
    if(stage===3)artifact=`<ul class="agent-checks" lang="en">${record.checks.map(check=>`<li><strong>${esc(check.action)}</strong><span>${esc(check.reason)}</span></li>`).join('')}</ul><p class="note">${label('agent.verificationNote')}</p>`;
    return steps+`<div class="agent-stage-panel"><div class="agent-stage-copy"><span class="eyebrow">${label('agent.recorded')}</span><h3>${label(`agent.${stages[stage]}`)}</h3><p>${label(`agent.${stages[stage]}Body`)}</p><p class="note">DeepSeek-V4-Flash · META · ${esc(date(record.day))}</p><a href="demos.html?task=earnings&amp;scenario=earnings-meta-q1&amp;model=deepseek-v4-flash&amp;view=journal" target="_blank" rel="noopener">${label('case.fullReplay')}</a></div><div class="agent-stage-artifact">${artifact}</div></div>`;
  }
  function avsrOutput(){
    const selectedIV=iv(ms[anchorM],ts[anchorT]);
    const all=ts.flatMap(days=>Array.from({length:41},(_,i)=>iv(.9+i*.005,days))),lo=Math.min(...all)-1,hi=Math.max(...all)+1;
    const x=m=>55+(m-.9)/.2*480,y=value=>235-(value-lo)/(hi-lo)*200;
    let body='';
    for(let i=0;i<4;i++){const value=lo+(hi-lo)*i/3;body+=`<line x1="50" x2="545" y1="${y(value)}" y2="${y(value)}" class="viz-gridline"/><text x="3" y="${y(value)+4}">${number(value,1)}%</text>`;}
    ts.forEach((days,index)=>{const color=['#187e75','#ce692e','#6c64ac'][index];body+=`<polyline fill="none" stroke="${color}" stroke-width="2.5" points="${Array.from({length:41},(_,i)=>{const m=.9+i*.005;return `${x(m)},${y(iv(m,days))}`;}).join(' ')}"/>`;ms.forEach((m,mIndex)=>{body+=`<circle cx="${x(m)}" cy="${y(iv(m,days))}" r="${anchorM===mIndex&&anchorT===index?7:4}" fill="${color}" stroke="white" stroke-width="2"/>`;});});
    body+=[.9,.95,1,1.05,1.1].map(m=>`<text x="${x(m)}" y="263" text-anchor="middle">${number(m,2)}</text>`).join('')+`<text x="300" y="290" text-anchor="middle">K/S</text>`;
    return `<div class="agent-avsr-grid"><table><caption>${label('agent.anchorGrid')}</caption><thead><tr><th>K/S</th>${ts.map(days=>`<th>${number(days)}D</th>`).join('')}</tr></thead><tbody>${ms.map((m,i)=>`<tr><th>${number(m,2)}</th>${ts.map((days,j)=>`<td><button id="avsr-cell-${i}-${j}" type="button" data-avsr-m="${i}" data-avsr-t="${j}" class="${anchorM===i&&anchorT===j?'on':''}" aria-pressed="${anchorM===i&&anchorT===j}">${number(iv(m,days),1)}%</button></td>`).join('')}</tr>`).join('')}</tbody></table><div class="agent-smile" tabindex="0" role="region" aria-label="${label('agent.smile')}"><svg viewBox="0 0 580 305" role="img" aria-label="${label('agent.smile')}">${body}</svg><div class="agent-curve-key">${ts.map((days,i)=>`<span><i style="background:${['#187e75','#ce692e','#6c64ac'][i]}"></i>${number(days)}D</span>`).join('')}</div></div></div><p class="agent-chart-hint">${label('viz.scrollHint')}</p><p class="agent-selection">K/S ${number(ms[anchorM],2)} · ${number(ts[anchorT])}D · IV ${number(selectedIV,1)}%</p><div class="agent-metrics">${metric('agent.rr',`${number(iv(1.05,7)-iv(.95,7),1,true)} pp`)}${metric('agent.termSpread',`${number(iv(1,90)-iv(1,7),1,true)} pp`)}</div>`;
  }
  function avsr(){
    return `<div class="agent-adapter-intro"><span class="agent-method">AVSR</span><h3>${label('agent.avsrTitle')}</h3><p>${label('agent.avsrBody')}</p></div><div class="agent-sliders">${[['level',level,15,60],['skew',skew,-10,10],['term',term,-8,8]].map(([key,value,min,max])=>`<label>${label(`agent.${key}`)}<output id="avsr-${key}-value">${number(value,0)}${key==='level'?'%':' pp'}</output><input type="range" id="avsr-${key}" data-avsr-control="${key}" min="${min}" max="${max}" step="1" value="${value}"/></label>`).join('')}</div><div id="avsr-output">${avsrOutput()}</div><p class="agent-example-note">${label('agent.illustrative')}</p>`;
  }
  function qocr(){
    const rows=members(bucketM,bucketT);
    const expiryCenter=(expiryRanges[bucketT][0]+expiryRanges[bucketT][1])/2;
    const cost=row=>Math.abs(row.ratio-ratioCenters[bucketM])+.01*Math.abs(row.dte-expiryCenter);
    const best=[...rows].sort((a,b)=>cost(a)-cost(b)||a.strike-b.strike)[0];
    const intent={underlying:'EXAMPLE',option_type:type,moneyness:['K/S < 0.99','0.99 <= K/S <= 1.01','K/S > 1.01'][bucketM],expiry_days:expiryRanges[bucketT],quantity:qty};
    const moneyness=bucketM===1?'agent.atm':(type==='CALL'&&bucketM===0)||(type==='PUT'&&bucketM===2)?'agent.itm':'agent.otm';
    const humanIntent=[t(type==='CALL'?'agent.call':'agent.put'),t(moneyness),`${expiryRanges[bucketT][0]}–${expiryRanges[bucketT][1]}D`,`${t('replay.quantity')} ${number(qty)}`].join(' · ');
    return `<div class="agent-adapter-intro"><span class="agent-method">QOCR</span><h3>${label('agent.qocrTitle')}</h3><p>${label('agent.qocrBody')}</p></div><div class="agent-qocr-controls"><label>${label('agent.optionType')}<select id="qocr-type">${['CALL','PUT'].map(right=>`<option value="${right}" ${type===right?'selected':''}>${label(right==='CALL'?'agent.call':'agent.put')}</option>`).join('')}</select></label><label>${label('replay.quantity')}<select id="qocr-qty">${[1,2,5,10].map(n=>`<option value="${n}" ${qty===n?'selected':''}>${number(n)}</option>`).join('')}</select></label></div><div class="agent-qocr-layout"><div><p class="note">${label('agent.bucketHint')}</p><table class="qocr-buckets"><thead><tr><th>K/S</th>${expiryRanges.map(([min,max])=>`<th>${number(min)}–${number(max)}D</th>`).join('')}</tr></thead><tbody>${['< 0.99','0.99–1.01','> 1.01'].map((m,i)=>`<tr><th>${esc(m)}</th>${ts.map((_,j)=>`<td><button type="button" id="qocr-cell-${i}-${j}" data-qocr-m="${i}" data-qocr-t="${j}" class="${bucketM===i&&bucketT===j?'on':''}" aria-pressed="${bucketM===i&&bucketT===j}">${number(members(i,j).length)}<small>${label('agent.candidates')}</small></button></td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="agent-qocr-result"><h4>${label('agent.discreteIntent')}</h4><p class="agent-selection">${esc(humanIntent)}</p><details class="agent-artifact"><summary>${label('agent.rawIntent')}</summary><pre lang="en">${esc(JSON.stringify(intent,null,2))}</pre></details><h4>${label('agent.representative')}</h4><p class="agent-selection">${label(type==='CALL'?'agent.call':'agent.put')} · K ${number(best.strike)} · ${number(best.dte)}D · ${label('replay.quantity')} ${number(qty)}</p><p class="note">${label('agent.mappingRule')}</p></div></div><p class="agent-example-note">${label('agent.illustrative')}</p>`;
  }
  function bindAVSR(){
    root.querySelectorAll('[data-avsr-m]').forEach(button=>{button.onclick=()=>{anchorM=Number(button.dataset.avsrM);anchorT=Number(button.dataset.avsrT);document.getElementById('avsr-output').innerHTML=avsrOutput();bindAVSR();document.getElementById(`avsr-cell-${anchorM}-${anchorT}`).focus({preventScroll:true});};});
  }
  function render(){
    const focus=root.contains(document.activeElement)?document.activeElement.id:null;
    root.innerHTML=`<div class="agent-view-tabs" role="group" aria-label="${label('layout.agentNav')}">${['workflow','avsr','qocr'].map(key=>`<button type="button" id="agent-view-${key}" data-agent-view="${key}" class="${view===key?'on':''}" aria-pressed="${view===key}"><span>${key==='workflow'?'01':key==='avsr'?'02':'03'}</span><strong>${label(`agent.tab.${key}`)}</strong><small>${label(`agent.tab.${key}Hint`)}</small></button>`).join('')}</div><div class="agent-canvas">${view==='workflow'?workflow():view==='avsr'?avsr():qocr()}</div>`;
    root.querySelectorAll('[data-agent-view]').forEach(button=>{button.onclick=()=>{view=button.dataset.agentView;render();};});
    root.querySelectorAll('[data-agent-stage]').forEach(button=>{button.onclick=()=>{stage=Number(button.dataset.agentStage);render();};});
    root.querySelectorAll('[data-avsr-control]').forEach(input=>{input.oninput=()=>{const value=Number(input.value),key=input.dataset.avsrControl;if(key==='level')level=value;if(key==='skew')skew=value;if(key==='term')term=value;document.getElementById(`avsr-${key}-value`).textContent=`${number(value)}${key==='level'?'%':' pp'}`;document.getElementById('avsr-output').innerHTML=avsrOutput();bindAVSR();};});
    bindAVSR();
    root.querySelector('#qocr-type')?.addEventListener('change',event=>{type=event.target.value;render();});
    root.querySelector('#qocr-qty')?.addEventListener('change',event=>{qty=Number(event.target.value);render();});
    root.querySelectorAll('[data-qocr-m]').forEach(button=>{button.onclick=()=>{bucketM=Number(button.dataset.qocrM);bucketT=Number(button.dataset.qocrT);render();};});
    window.LOI18n.apply(root);if(focus)document.getElementById(focus)?.focus({preventScroll:true});
  }
  render();
  Promise.all(['data/replays/earnings-meta-q1/release/deepseek-v4-flash.json','data/scenarios/earnings-meta-q1.json'].map(path=>fetch(path).then(response=>{if(!response.ok)throw new Error('Unavailable archive');return response.json();}))).then(([run,scenario])=>{record=run.decisions[0];observation=scenario.groups[0].user;render();}).catch(()=>{failed=true;render();});
  window.addEventListener('lo:languagechange',render);
})();
