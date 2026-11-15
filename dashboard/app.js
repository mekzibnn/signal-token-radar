'use strict';
const D=window.RADAR,$=s=>document.querySelector(s);
const esc=s=>String(s??'Unknown').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n==null?'Not recorded':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(n);
const pct=n=>n==null?'Unknown':`${n>=0?'+':''}${n.toFixed(1)}%`;
let live=false,page=0,sort='implied_value_usd',direction=-1,filtered=[];const size=8;
$('#date').textContent=D.as_of+' UTC';$('#source').textContent='Source: '+D.source;
$('#stats').innerHTML=[['Radar universe',D.rows.length,'Protocols with no token recorded'],['Watchlist coverage',D.watchlist.length+'/'+D.watchlist.length,'Every house watchlist protocol included'],['Below the floor',D.rows.filter(r=>r.tvl_usd<D.floor_usd).length,'Discoveries below $50M TVL'],['Peer baseline',D.global_multiple.toFixed(2)+'×','Median recorded market cap / TVL']].map(([a,b,c])=>`<div class="stat"><label>${esc(a)}</label><strong>${esc(b)}</strong><small>${esc(c)}</small></div>`).join('');
for(const category of [...new Set(D.rows.map(r=>r.category).filter(Boolean))].sort())$('#category').insertAdjacentHTML('beforeend',`<option>${esc(category)}</option>`);
for(const chain of [...new Set(D.rows.flatMap(r=>r.chains))].sort())$('#chain').insertAdjacentHTML('beforeend',`<option>${esc(chain)}</option>`);
function render(){
 const q=$('#search').value.toLowerCase(),category=$('#category').value,chain=$('#chain').value,scope=$('#scope').value;
 filtered=(live?D.live:D.rows).filter(r=>(r.name+' '+r.slug+' '+r.chains.join(' ')).toLowerCase().includes(q)&&(!category||r.category===category)&&(!chain||r.chains.includes(chain))&&(live||scope==='all'||(scope==='watch'?r.watchlist:r.tvl_usd<D.floor_usd)));
 filtered.sort((a,b)=>sort==='name'?direction*a.name.localeCompare(b.name):direction*((a[live&&sort==='implied_value_usd'?'mcap_usd':sort]??-Infinity)-(b[live&&sort==='implied_value_usd'?'mcap_usd':sort]??-Infinity))||a.slug.localeCompare(b.slug));
 page=Math.min(page,Math.max(0,Math.ceil(filtered.length/size)-1));
 $('#count').textContent=filtered.length;$('#view-title').firstChild.textContent=live?'Recorded tokens ':'Launch radar ';
 $('#view-note').textContent=live?'Recorded market cap · kept separate from hypothetical launch values':'No token recorded in the snapshot · not proof a token does not exist';
 $('#rows').innerHTML=filtered.slice(page*size,(page+1)*size).map(r=>`<tr><td>${live?'—':r.rank}</td><td><button class="protocol" data-slug="${esc(r.slug)}">${esc(r.name)}<span class="sub">${esc(r.category)} · ${esc(r.chains.slice(0,2).join(' / '))}</span></button></td><td class="value">${money(live?r.mcap_usd:r.implied_value_usd)}<span class="sub">${live?'Recorded market cap':money(r.low_usd)+'–'+money(r.high_usd)+' stress band'}</span></td><td>${money(r.tvl_usd)}</td><td class="${(r.change_7d??0)>=0?'up':'down'}">${pct(r.change_7d)}</td><td><span class="tag ${r.watchlist?'':'early'}">${live?'Token recorded':r.watchlist?'Watchlist':'Discovery'}</span><span class="sub">${live?'Market observation':r.peer_count+' category peers'}</span></td><td><button class="plan" data-slug="${esc(r.slug)}">${live?'View evidence':'Inspect plan ↗'}</button></td></tr>`).join('');
 $('#empty').hidden=filtered.length>0;$('#range').textContent=filtered.length?`${page*size+1}–${Math.min((page+1)*size,filtered.length)} of ${filtered.length} protocols`:'0 protocols';$('#prev').disabled=page===0;$('#next').disabled=(page+1)*size>=filtered.length;
 document.querySelectorAll('[data-slug]').forEach(b=>b.onclick=()=>openDetail(b.dataset.slug));
}
function openDetail(slug){
 const r=(live?D.live:D.rows).find(r=>r.slug===slug);if(!r)return;
 $('#detail-content').innerHTML=`<div class="detail-head"><div class="eyebrow">${live?'RECORDED TOKEN / MARKET EVIDENCE':'PROTOCOL DOSSIER / #'+r.rank}</div><h2>${esc(r.name)}</h2><p>${esc(r.category)} · ${esc(r.chains.join(' / '))} · ${esc(r.token_status)}</p></div><div class="detail-grid"><section><h3>${live?'Recorded market cap':'Implied token value'}</h3><div class="estimate">${money(live?r.mcap_usd:r.implied_value_usd)}</div>${live?'':`<p>Assumption stress band ${money(r.low_usd)}–${money(r.high_usd)}<br>0.5×–1.7× base estimate · not a confidence interval</p>`}<div class="formula">TVL <b>${money(r.tvl_usd)}</b><br>7D TVL change <b>${pct(r.change_7d)}</b><br>Tracked since <b>${esc(r.listed_at||'Unknown')}</b>${live?'':`<br>Category peers <b>${r.peer_count}</b><br>Shrunk peer multiple <b>${r.multiple.toFixed(3)}×</b><br>Growth multiplier <b>${r.growth.toFixed(3)}×</b><br>Maturity multiplier <b>${r.maturity.toFixed(3)}×</b>`}</div><p class="warning">${live?'This protocol records a token. A new-token farm thesis is not established.':'No launch date, supply or airdrop is established. TVL is not revenue. Listing age does not prove token-free history.'}</p><p>Snapshot: ${esc(D.as_of)}. Values are a reproducible scenario from sealed data, not a live valuation.</p><button id="detail-method">Read full methodology ↗</button></section><section><h3>${live?'Research checklist':'A small, deliberate farm plan'}</h3>${live?'<p>Verify token contract and published distribution terms. Separate token purchases from any future rewards program. Review liquidity, unlocks and product access before committing capital.</p>':`<p>Illustrative budget · verify product support before acting</p><ol class="steps">${r.farm_steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`}</section></div>`;
 $('#detail-method').onclick=()=>$('#methodology').showModal();$('#detail').showModal();
}
for(const s of ['#search','#category','#chain','#scope'])$(s).addEventListener('input',()=>{page=0;render()});
$('#reset').onclick=()=>{for(const s of ['#search','#category','#chain'])$(s).value='';$('#scope').value='all';page=0;render()};
$('#prev').onclick=()=>{page--;render()};$('#next').onclick=()=>{page++;render()};
document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{direction=sort===b.dataset.sort?-direction:-1;sort=b.dataset.sort;page=0;render()});
$('#live').onclick=()=>{live=!live;page=0;$('#live').textContent=live?'⌁ Back to launch radar':'◈ Recorded tokens';render()};
$('#method').onclick=()=>$('#methodology').showModal();document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({as_of:D.as_of,rows:filtered},null,2)],{type:'application/json'}));a.download='signal-radar.json';a.click();URL.revokeObjectURL(a.href)};
render();
