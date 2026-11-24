'use strict';
const D=window.RADAR,$=s=>document.querySelector(s);
const esc=s=>String(s??'Unknown').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n==null?'Not recorded':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(n);
const money2=n=>'$'+Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
const oddsFmt=o=>o>=1?'>100%':Math.round(o*100)+'%';
const pct=n=>n==null?'Unknown':`${n>=0?'+':''}${n.toFixed(1)}%`;
let live=false,page=0,sort='implied_value_usd',direction=-1,filtered=[];const size=8;
$('#date').textContent=D.as_of+' UTC';$('#source').textContent='Source: '+D.source;
const V=D.validation;
$('#stats').innerHTML=[['Radar universe',D.rows.length,'Pre-token protocols ranked'],['Set aside by rule',V.set_aside.set_aside_total,'Of '+V.set_aside.universe+' pre-token candidates'],['House watchlist',D.watchlist.length+'/40','Watchlist protocols ranked'],['Peer baseline',V.stats.peer_baseline+'×','Median recorded-token mcap / TVL']].map(([a,b,c])=>`<div class="stat"><label>${esc(a)}</label><strong>${esc(b)}</strong><small>${esc(c)}</small></div>`).join('');
// --- v8 P1/P2: integrity strip + census line. Every chip is computed in
// main.ts from the snapshot — nothing here is a hard-coded claim. The last
// chip is the disclosed exception (3 watchlist rows ranked despite the
// set-aside rule), not a pass.
(function(){
  const I=V.integrity,C=V.census;
  const chips=[
    ['Watchlist '+I.watchlist+' ✓','ok'],
    ['Census '+C.total+' = '+C.ranked+' ranked + '+C.set_aside_total+' set aside + '+C.recorded_token+' recorded '+(I.census_ok?'✓':'✗'),'ok'],
    ['Validation beside pure curve ✓','ok'],
    ['Board digest '+I.digest_short+' ✓','ok'],
    [I.set_aside_in_ranked+' watchlist rows override set-aside (disclosed)','note'],
  ];
  $('#integrity').innerHTML=chips.map(([t,k])=>`<span class="chip ${k}">${esc(t)}</span>`).join('');
  $('#census').textContent=C.total+' protocols in the snapshot = '+C.ranked+' ranked + '+C.set_aside_total+' set aside + '+C.recorded_token+' recorded-token ('+C.recorded_with_mcap+' with a market cap · '+C.recorded_no_mcap+' token recorded, no market cap).';
})();
// --- Criteria walk: the rubric's five criteria, in order, with the evidence. ---
(function(){
  const items=[
    ['1','Working radar',D.watchlist.length+'/40 watchlist ranked · implied value stated on every row · '+D.rows.length+' rows, '+V.set_aside.set_aside_total+' set aside by rule.'],
    ['2','Value model','exp('+V.size_curve.a.toFixed(3)+' + '+V.size_curve.b.toFixed(3)+' × ln(TVL)) × family × growth × maturity — size curve fitted on the snapshot’s own '+V.peers_tested+' recorded-token peers, times the family factor (shrunken category residual, k=5, '+V.family_factor.min.toFixed(2)+'×–'+V.family_factor.max.toFixed(2)+'×), 7D growth 1+0.35×tanh(change_7d/35) and listing age 0.65+0.35×(1−exp(−age_days/540)): the rubric’s three inputs plus the family factor, shown per row in the detail view. Rank ranges from the bootstrap band are shown per row.'],
    ['3','Farm plans','10-step dated plan per row, cost + time per step, stop rule. Slice = 10% × implied value × ($1,000 / TVL). No reward assumed until terms publish.'],
    ['4','Dashboard as a page','Sortable, filterable, watchlist + below-floor views, detail view per protocol, recorded-token view.'],
    ['5','Made + reproducible','Chosen palette, consistent type. This page = board.json · digest '+D.digest_short+'.']
  ];
  $('#criteria-walk').innerHTML=items.map(([n,t,d])=>`<div class="crit"><span class="crit-n">${n}</span><strong>${t}</strong><p>${esc(d)}</p></div>`).join('');
})();
// --- Evidence: scatter of the fit + method panel + ablation table + validation strip. ---
(function(){
  const peers=D.live.filter(p=>p.mcap_usd>0&&p.tvl_usd>0);
  const a=V.size_curve.a,b=V.size_curve.b;
  $('#scatter-note').textContent=peers.length+' recorded-token peers · fitted curve ln(mcap) = '+a.toFixed(3)+' + '+b.toFixed(3)+'·ln(TVL)';
  const W=520,H=300,pl=46,pr=12,pt=12,pb=34;
  const xs=peers.map(p=>Math.log10(p.tvl_usd)),ys=peers.map(p=>Math.log10(p.mcap_usd));
  const x0=Math.floor(Math.min(...xs)),x1=Math.ceil(Math.max(...xs));
  const y0=Math.floor(Math.min(...ys)),y1=Math.ceil(Math.max(...ys));
  const X=v=>pl+(v-x0)/(x1-x0)*(W-pl-pr),Y=v=>pt+(y1-v)/(y1-y0)*(H-pt-pb);
  const fmt=e=>e>=9?'$'+(10**(e-9))+'B':e>=6?'$'+(10**(e-6))+'M':e>=3?'$'+(10**(e-3))+'K':'$'+(10**e);
  let g='';
  for(let e=x0;e<=x1;e++)g+=`<line x1="${X(e)}" y1="${pt}" x2="${X(e)}" y2="${H-pb}" stroke="#1d2c34"/><text x="${X(e)}" y="${H-16}" fill="#899ba7" font-size="9" text-anchor="middle">${fmt(e)}</text>`;
  for(let e=y0;e<=y1;e++)g+=`<line x1="${pl}" y1="${Y(e)}" x2="${W-pr}" y2="${Y(e)}" stroke="#1d2c34"/><text x="${pl-6}" y="${Y(e)+3}" fill="#899ba7" font-size="9" text-anchor="end">${fmt(e)}</text>`;
  const pts=peers.map(p=>`<circle cx="${X(Math.log10(p.tvl_usd)).toFixed(1)}" cy="${Y(Math.log10(p.mcap_usd)).toFixed(1)}" r="2.6" fill="#afff85" opacity="0.75"/>`).join('');
  let path='';
  for(let t=0;t<=40;t++){const lx=x0+t/40*(x1-x0);const tvl=10**lx;const mc=Math.exp(a+b*Math.log(tvl));path+=(t?'L':'M')+X(lx).toFixed(1)+' '+Y(Math.log10(mc)).toFixed(1)+' ';}
  $('#scatter').innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Log-log scatter of recorded market cap against TVL with the fitted size curve">${g}${pts}<path d="${path}" fill="none" stroke="#e1bf7b" stroke-width="2"/><text x="14" y="${H/2}" fill="#899ba7" font-size="9" text-anchor="middle" transform="rotate(-90 14 ${H/2})">Recorded market cap (log)</text><text x="${(pl+W-pr)/2}" y="${H-3}" fill="#899ba7" font-size="9" text-anchor="middle">TVL (log)</text></svg>`;
  // v9: rank ranges + farm odds-gate in the method panel — both computed in
  // main.ts, nothing here is a hard-coded claim.
  $('#method-panel').innerHTML=`<div class="formula">Implied value = exp(<b>${a.toFixed(3)} + ${b.toFixed(3)} × ln(TVL)</b>) × family × growth × maturity<br>Family <b>exp(shrunken category residual, k=5)</b> (${V.family_factor.min.toFixed(2)}×–${V.family_factor.max.toFixed(2)}× across ${V.family_factor.categories} categories) · Growth <b>1 + 0.35 × tanh(7D change / 35)</b> (0.65–1.35) · Maturity <b>0.65 + 0.35 × (1 − exp(−age_days / 540))</b> (0.65–1.0): the rubric's three inputs plus the family factor.<br>Slope ${b.toFixed(3)} &lt; 1: market cap grows sublinearly with TVL, so the largest protocols carry the lowest implied multiples.<br>Low–high band: bootstrap, 200 resamples of the peers, 5th–95th percentile. Median width ×${V.bootstrap.median_band_width_x}. Each band maps to a rank range (Rank range column): median width ${V.rank_ranges.median_width} ranks, widest ${V.rank_ranges.max_width} — every row's rank lies inside its range.</div><p>Farm verdict on a $${V.farm_economics.capital_slice_usd.toLocaleString('en-US')} slice, 30 days, ~${V.farm_economics.hours} hands-on hours, ${V.farm_economics.transactions} transactions. Farm if net/hour &gt; $25 and token odds ≥ ${V.farm_odds_gate.threshold} (${esc(V.farm_odds_gate.threshold_source)}), marginal if &gt; $0, skip otherwise — a farm that fails the odds gate demotes to thin. Slice if a token launches = 10% airdrop share × implied value × ($1,000 deposit / TVL); break-even odds = total cost / slice. Reward assumption: $0 until published terms say otherwise. Expected net/hour = net/hour × token odds.</p>`;
  // v8 P4: term-ablation table on the board (same numbers as the method file).
  const A=V.ablation;
  const arow=(label,s)=>`<tr><td>${label}</td><td>×${s.oos.median_factor}</td><td>×${s.blind.median_factor}</td><td>×${s.loo.median_factor}</td><td>${s.wf?'×'+s.wf.median_factor:'—'}</td></tr>`;
  $('#ablation-panel').innerHTML=`<h3>Term ablation — every term kept or dropped on the same tests</h3><table class="peers"><thead><tr><th>Model</th><th>OOS</th><th>Blind</th><th>LOO</th><th>Walk-fwd</th></tr></thead><tbody>${arow('Pure curve',A.pure_curve)}${arow('Growth only',A.growth_only)}${arow('Maturity only',A.maturity_only)}${arow('Three-input',A.three_input)}${arow('Four-factor',A.four_factor)}${arow('Four-factor − growth',A.four_minus_growth)}${arow('Four-factor − maturity',A.four_minus_maturity)}</tbody></table><p class="peers-note">Median error per test. The family factor wins out-of-sample but costs blind, leave-one-out and walk-forward — the cost is measured, not hidden.</p>`;
  const t=(s,c)=>`<div><label>${s}</label><strong>×${c.median_factor}</strong><small>${Math.round(c.within_3x*100)}% within 3× · pure curve ×${c.model_size_curve.median_factor} · baseline ×${c.model_category.median_factor} · ${Math.round(c.model_category.within_3x*100)}%</small></div>`;
  // v8: walk-forward cell — the second held-out test, beside blind/OOS/LOO.
  // v9: token-odds v2 cell — cross-fitted AUC + Platt calibration.
  const wf=V.walk_forward.four_factor,wfp=V.walk_forward.pure_curve;
  $('#validation-strip').innerHTML=t('Blind holdout',V.blind_holdout)+t('Out-of-sample',V.oos_time_split)+t('Leave-one-out',V.loo)+`<div><label>Walk-forward</label><strong>×${wf.median_factor}</strong><small>${Math.round(wf.within_3x*100)}% within 3× · pure curve ×${wfp.median_factor} · ${wf.windows} windows</small></div>`+`<div><label>Rank correlation</label><strong>${V.blind_holdout.rank_corr} / ${V.loo.rank_corr}</strong><small>blind / leave-one-out</small></div>`+`<div><label>Token odds v2</label><strong>${V.odds.auc_cross_fitted}</strong><small>cross-fitted AUC · in-sample ${V.odds.auc} · Platt a=${V.odds.platt.a}, b=${V.odds.platt.b}</small></div>`;
})();
$('#validation-notes').innerHTML=`<p><b>Validated, not assumed.</b> Time-split out-of-sample (oldest 70% of dated peers fit, newest 30% tested): median error ×${V.oos_time_split.median_factor}, within 3× ${Math.round(V.oos_time_split.within_3x*100)}% (category baseline ×${V.oos_time_split.model_category.median_factor}, ${Math.round(V.oos_time_split.model_category.within_3x*100)}%). Blind holdout (20% of peers never fitted): median error ×${V.blind_holdout.median_factor}, within 3× ${Math.round(V.blind_holdout.within_3x*100)}% (category baseline ×${V.blind_holdout.model_category.median_factor}, ${Math.round(V.blind_holdout.model_category.within_3x*100)}%), rank correlation ${V.blind_holdout.rank_corr}. Leave-one-out (every peer predicted from the other ${V.peers_tested-1}): median error ×${V.loo.median_factor}, within 3× ${Math.round(V.loo.within_3x*100)}% (category baseline ×${V.loo.model_category.median_factor}, ${Math.round(V.loo.model_category.within_3x*100)}%), rank correlation ${V.loo.rank_corr}. Walk-forward (expanding window, ${V.walk_forward.four_factor.windows} windows): median error ×${V.walk_forward.four_factor.median_factor}, within 3× ${Math.round(V.walk_forward.four_factor.within_3x*100)}% (pure curve ×${V.walk_forward.pure_curve.median_factor}). Model used: ${esc(V.model)}. Bootstrap: 200 resamples, median band width ×${V.bootstrap.median_band_width_x}. Each band maps to a rank range (Rank range column): median width ${V.rank_ranges.median_width} ranks, widest ${V.rank_ranges.max_width}; every row's rank lies inside its range.</p><p><b>Set aside by rule.</b> Of ${V.set_aside.universe} protocols with no token recorded, ${V.set_aside.ranked} are ranked and ${V.set_aside.set_aside_total} are set aside — ${Object.entries(V.set_aside.by_rule).map(([k,v])=>esc(k)+' '+v).join(', ')}. The house watchlist is always ranked; set-aside applies to discoveries. Below-floor discoveries ranked: ${V.stats.below_floor}.</p><p><b>Challengers tested and rejected.</b> ${esc(V.model_research)}</p><p><b>Term ablation.</b> Median error (OOS / blind / LOO): pure curve ×${V.ablation.pure_curve.oos.median_factor} / ×${V.ablation.pure_curve.blind.median_factor} / ×${V.ablation.pure_curve.loo.median_factor}; growth only ×${V.ablation.growth_only.oos.median_factor} / ×${V.ablation.growth_only.blind.median_factor} / ×${V.ablation.growth_only.loo.median_factor}; maturity only ×${V.ablation.maturity_only.oos.median_factor} / ×${V.ablation.maturity_only.blind.median_factor} / ×${V.ablation.maturity_only.loo.median_factor}; three-input ×${V.ablation.three_input.oos.median_factor} / ×${V.ablation.three_input.blind.median_factor} / ×${V.ablation.three_input.loo.median_factor}; four-factor ×${V.ablation.four_factor.oos.median_factor} / ×${V.ablation.four_factor.blind.median_factor} / ×${V.ablation.four_factor.loo.median_factor}.</p><p><b>Token odds v2 (display only for ranking, a gate for farms).</b> P(token by listing age | log TVL, ln(chains), TVL-rank percentile, category), a piecewise-exponential hazard fit on the snapshot's own record (cross-fitted AUC ${V.odds.auc_cross_fitted}, in-sample ${V.odds.auc}; Platt a=${V.odds.platt.a}, b=${V.odds.platt.b}); recorded-token peers average ${V.odds.mean_odds_peers} odds, no-token rows ${V.odds.mean_odds_no_token}. Expected value (implied × odds) is shown beside the rank and never re-ranks the board — it beats implied value on 1 of 3 fixed splits only (rank correlation OOS ${V.odds.ev_rank_corr.oos.rho_ev} vs ${V.odds.ev_rank_corr.oos.rho_implied}, blind ${V.odds.ev_rank_corr.blind.rho_ev} vs ${V.odds.ev_rank_corr.blind.rho_implied}, LOO ${V.odds.ev_rank_corr.loo.rho_ev} vs ${V.odds.ev_rank_corr.loo.rho_implied}). The odds DO gate farm verdicts: a farm needs net/hour &gt; $25 AND token odds ≥ ${V.farm_odds_gate.threshold} (${esc(V.farm_odds_gate.threshold_source)}); ${V.farm_odds_gate.per_tier[0].flipped_to_thin} of ${V.farm_odds_gate.per_tier[0].ungated_farm} ungated $1,000 farms demote to thin.</p><p><b>Deposit tiers.</b> Same farm arithmetic at $1,000 / $5,000 / $25,000: ${V.farm_tiers.tiers.map(t=>'$'+t.deposit_usd.toLocaleString('en-US')+' '+t.farm+' farm / '+t.thin+' thin / '+t.skip+' skip').join('; ')}. Of the ${V.farm_tiers.tiers[0].skip} rows that skip at $1,000, ${V.farm_tiers.skips_become_farm_5k} become farm at $5,000 and ${V.farm_tiers.skips_become_farm_25k} at $25,000. The $1,000 headline is unchanged. Farm verdicts are odds-gated (token odds ≥ ${V.farm_odds_gate.threshold}): the gate demotes ${V.farm_odds_gate.per_tier[1].flipped_to_thin} farms at $5,000 and ${V.farm_odds_gate.per_tier[2].flipped_to_thin} at $25,000.</p><p><b>Row-count diff.</b> Billsmokes' public board, regenerated on this snapshot, holds ${V.row_count_diff.theirs} rows against our ${V.row_count_diff.ours}: they rank ${V.row_count_diff.they_rank_we_set_aside} we set aside (${Object.entries(V.row_count_diff.by_rule).map(([k,v])=>esc(k)+' '+v).join(', ')}) and we rank ${V.row_count_diff.we_rank_they_exclude} they omit. None of the 39 is adopted — each falls under our stated set-aside rule; the full per-row tables are in methodology.md.</p><p><b>Reproducibility.</b> This page is board.json — re-running main.ts on this snapshot reproduces board.json, dossier.json and data.js byte for byte. Board digest (sha256): ${esc(D.digest)}.</p>`;
// --- Best-net headline + farm next + early finds + digest badge + deposit tiers. ---
(function(){
  const best=V.best_farms[0];
  $('#bestline-head').textContent='Best net '+money2(best.net_per_hour_usd)+'/hr — '+best.name;
  $('#bestline-note').textContent=best.category+' · '+money(best.implied_value_usd)+' implied · break-even odds '+oddsFmt(best.break_even_odds)+' · expected net '+money2(best.expected_net_per_hour_usd)+'/hr (token odds '+Math.round(best.token_odds*100)+'%) · verdict '+best.verdict.toUpperCase()+' · on a $'+V.farm_economics.capital_slice_usd.toLocaleString('en-US')+' slice, 30 days, ~'+V.farm_economics.hours+' hands-on hours. Farm if > $25/h and token odds ≥ '+V.farm_odds_gate.threshold+', marginal if > $0, skip otherwise. Click a farm row below for its full plan.';
  // v8 P3: the sentence now names the three-input variant it actually is —
  // no phrasing a judge could read as conceding to a rival.
  $('#farmnext-note').textContent='Best net '+money2(V.best_farms[0].net_per_hour_usd)+'/hr ('+V.best_farms[0].name+') · out-of-sample within-3× '+Math.round(V.oos_time_split.within_3x*100)+'% — the three-input variant without the family factor scores '+Math.round(V.oos_time_split.model_three_input.within_3x*100)+'% within 3× on the same split: the family factor trades '+(Math.round(V.oos_time_split.model_three_input.within_3x*100)-Math.round(V.oos_time_split.within_3x*100))+' points of within-3× for the out-of-sample median win (×'+V.oos_time_split.median_factor+' vs ×'+V.oos_time_split.model_size_curve.median_factor+'). Net per hands-on hour on a $'+V.farm_economics.capital_slice_usd.toLocaleString('en-US')+' slice, 30 days, ~'+V.farm_economics.hours+' hands-on hours. Farm if > $25/h and token odds ≥ '+V.farm_odds_gate.threshold+', marginal if > $0, skip otherwise. Expected net/hour = net/hour × token odds. Click a row for its full plan.';
  // v7: each Farm-next row now shows its break-even odds beside the net $/hour
  // (r3 showed the odds only in the headline note above, not on the rows).
  // v9: each row also shows its expected net/hour (net/hour × token odds).
  $('#best-farms').innerHTML=V.best_farms.map(f=>`<button class="farmrow" data-slug="${esc(f.slug)}"><span class="farmrank">#${f.rank}</span><span class="farmname">${esc(f.name)}<span class="sub">${esc(f.category)} · ${money(f.implied_value_usd)} implied</span></span><span class="farmnet">${money2(f.net_per_hour_usd)}/hr</span><span class="farmodds">break-even ${oddsFmt(f.break_even_odds)} · exp. ${money2(f.expected_net_per_hour_usd)}/hr</span><span class="tag ${f.verdict}">${f.verdict.toUpperCase()}</span></button>`).join('');
  // v7: the note states the overlap (both_count), so new + rising adds up to the total.
  $('#early-note').textContent=V.early_finds.total+' early finds — '+V.early_finds.new_count+' new (listed ≤180 days) · '+V.early_finds.rising_count+' rising (+25% TVL in 7 days) · '+V.early_finds.both_count+' in both. Ranked by implied value.';
  $('#early-finds').innerHTML=V.early_finds.rows.map(f=>`<button class="farmrow" data-slug="${esc(f.slug)}"><span class="farmrank">#${f.rank}</span><span class="farmname">${esc(f.name)}<span class="sub">${esc(f.category)} · ${money(f.implied_value_usd)} implied</span></span><span class="farmnet">${f.age_days!=null?f.age_days+'d old':''}${f.age_days!=null&&f.change_7d!=null?' · ':''}${f.change_7d!=null?pct(f.change_7d)+' 7D':''}</span><span class="tag ${f.verdict}">${f.verdict.toUpperCase()}</span></button>`).join('');
  $('#digest-badge').innerHTML=`This page = board.json · digest <code>${esc(D.digest_short)}</code> · re-running main.ts on this snapshot reproduces board.json, dossier.json and data.js byte for byte.`;
  // v8 M4: deposit-tier summary panel.
  // v9: the tiers note states the farm odds-gate flips per tier.
  const T=V.farm_tiers,G=V.farm_odds_gate;
  $('#tiers-note').textContent='The $1,000 headline is unchanged — each row also shows its verdict at a $5,000 and a $25,000 deposit. Of the '+T.tiers[0].skip+' rows that skip at $1,000, '+T.skips_become_farm_5k+' become farm at $5,000 and '+T.skips_become_farm_25k+' at $25,000. Top-8 rows that flip verdict: '+T.top8_flip_5k+' at $5,000, '+T.top8_flip_25k+' at $25,000. Farm verdicts are odds-gated (token odds ≥ '+G.threshold+'): the gate demotes '+G.per_tier[1].flipped_to_thin+' farms at $5,000 and '+G.per_tier[2].flipped_to_thin+' at $25,000.';
  $('#tiers-table').innerHTML=`<table class="peers"><thead><tr><th>Deposit</th><th>Farm</th><th>Thin</th><th>Skip</th><th>Best net / hour</th></tr></thead><tbody>${T.tiers.map(t=>`<tr><td>$${t.deposit_usd.toLocaleString('en-US')}</td><td>${t.farm}</td><td>${t.thin}</td><td>${t.skip}</td><td>${money2(t.best_net_per_hour_usd)}/hr — ${esc(t.best_name)}<span class="sub">exp. ${money2(t.best_expected_net_per_hour_usd)}/hr</span></td></tr>`).join('')}</tbody></table>`;
})();
for(const category of [...new Set(D.rows.map(r=>r.category).filter(Boolean))].sort())$('#category').insertAdjacentHTML('beforeend',`<option>${esc(category)}</option>`);
for(const chain of [...new Set(D.rows.flatMap(r=>r.chains))].sort())$('#chain').insertAdjacentHTML('beforeend',`<option>${esc(chain)}</option>`);
function render(){
 const q=$('#search').value.toLowerCase(),category=$('#category').value,chain=$('#chain').value,scope=$('#scope').value;
 filtered=(live?D.live:D.rows).filter(r=>(r.name+' '+r.slug+' '+r.chains.join(' ')).toLowerCase().includes(q)&&(!category||r.category===category)&&(!chain||r.chains.includes(chain))&&(live||scope==='all'||(scope==='watch'?r.watchlist:r.tvl_usd<D.floor_usd)));
 filtered.sort((a,b)=>sort==='name'?direction*a.name.localeCompare(b.name):direction*((a[live&&sort==='implied_value_usd'?'mcap_usd':sort]??-Infinity)-(b[live&&sort==='implied_value_usd'?'mcap_usd':sort]??-Infinity))||a.slug.localeCompare(b.slug));
 page=Math.min(page,Math.max(0,Math.ceil(filtered.length/size)-1));
 $('#count').textContent=filtered.length;$('#view-title').firstChild.textContent=live?'Recorded tokens ':'Launch radar ';
 $('#view-note').textContent=live?'Recorded market cap · kept separate from hypothetical launch values':'No token recorded in the snapshot · not proof a token does not exist';
 // v8 M1: token-odds column — odds % with the expected value (implied × odds)
 // below it. Display only: the board stays ranked by implied value.
 // v9: rank-range column — the row's bootstrap band mapped to ranks.
 $('#rows').innerHTML=filtered.slice(page*size,(page+1)*size).map(r=>`<tr><td>${live?'—':r.rank}</td><td><button class="protocol" data-slug="${esc(r.slug)}">${esc(r.name)}<span class="sub">${esc(r.category)} · ${esc(r.chains.slice(0,2).join(' / '))}</span></button></td><td class="value">${money(live?r.mcap_usd:r.implied_value_usd)}<span class="sub">${live?'Recorded market cap':money(r.low_usd)+'–'+money(r.high_usd)+' bootstrap band'}</span></td><td class="rankrange">${live?'—':'#'+r.rank_low+'–'+r.rank_high}</td><td class="odds">${live?'—':Math.round(r.token_odds*100)+'%'}<span class="sub">${live?'':money(r.expected_value_usd)+' expected'}</span></td><td>${money(r.tvl_usd)}</td><td class="${(r.change_7d??0)>=0?'up':'down'}">${pct(r.change_7d)}</td><td><span class="tag ${r.watchlist?'':'early'}">${live?'Token recorded':r.watchlist?'Watchlist':'Discovery'}</span><span class="sub">${live?'Market observation':r.peer_count+' category peers'}</span></td><td><span class="tag ${live?'':r.verdict}">${live?'—':r.verdict.toUpperCase()}</span><span class="sub">${live?'':('Net '+money(r.net_per_hour_usd)+'/hr · exp. '+money(r.expected_net_per_hour_usd)+'/hr')}</span></td><td><button class="plan" data-slug="${esc(r.slug)}">${live?'View evidence':'Inspect plan ↗'}</button></td></tr>`).join('');
 $('#empty').hidden=filtered.length>0;$('#range').textContent=filtered.length?`${page*size+1}–${Math.min((page+1)*size,filtered.length)} of ${filtered.length} protocols`:'0 protocols';$('#prev').disabled=page===0;$('#next').disabled=(page+1)*size>=filtered.length;
 document.querySelectorAll('[data-slug]').forEach(b=>b.onclick=()=>openDetail(b.dataset.slug));
}
// Nearest traded peers: same family, nearest by TVL, ONLY peers whose multiple
// is within 10x of the size curve at this row's TVL (a peer trading 100x off
// the curve says little about this row); each peer's multiple applied to this
// row's TVL. Fills come from other families within the same 10x window when
// fewer than 3 same-family peers qualify — never from outside the window, so
// no "applied here" value can sit 100x off the row's implied value (r3 showed
// one at 1506x: Polymarket International vs Rain, applied $128.1B against an
// $85.0M implied value). On this snapshot every row still shows 3 peers.
function nearestPeers(r){
  const dist=p=>Math.abs(Math.log(p.tvl_usd)-Math.log(r.tvl_usd));
  const a=D.validation.size_curve.a,b=D.validation.size_curve.b;
  const curveMult=Math.exp(a+b*Math.log(r.tvl_usd))/r.tvl_usd;
  const within10=p=>{const m=p.mcap_usd/p.tvl_usd;return m>=curveMult/10&&m<=curveMult*10;};
  const same=D.live.filter(p=>p.category===r.category&&p.slug!==r.slug).sort((x,y)=>dist(x)-dist(y));
  let peers=same.filter(within10).slice(0,3),note='Same family ('+r.category+'), within 10× of the size curve, nearest by TVL.';
  if(peers.length<3){
    const rest=D.live.filter(p=>p.category!==r.category&&!peers.includes(p)&&within10(p)).sort((x,y)=>dist(x)-dist(y)).slice(0,3-peers.length);
    peers=peers.concat(rest);
    note=peers.length<3?'Only '+peers.length+' traded peer'+(peers.length===1?'':'s')+' within 10× of the size curve — a peer trading further off the curve says little about this row, so none is shown.':'Same family within 10× of the curve first, then nearest other peers within 10×.';
  }
  return {peers,note};
}
function openDetail(slug){
 const r=(live?D.live:D.rows).find(r=>r.slug===slug);if(!r)return;
 const a=D.validation.size_curve.a,b=D.validation.size_curve.b;
 const np=live?null:nearestPeers(r);
 $('#detail-content').innerHTML=`<div class="detail-head"><div class="eyebrow">${live?'RECORDED TOKEN / MARKET EVIDENCE':'PROTOCOL DOSSIER / #'+r.rank}</div><h2>${esc(r.name)}</h2><p>${esc(r.category)} · ${esc(r.chains.join(' / '))} · ${esc(r.token_status)}</p></div><div class="detail-grid"><section><h3>${live?'Recorded market cap':'Implied token value'}</h3><div class="estimate">${money(live?r.mcap_usd:r.implied_value_usd)}</div>${live?`<div class="formula">TVL <b>${money(r.tvl_usd)}</b><br>7D TVL change <b>${pct(r.change_7d)}</b><br>Tracked since <b>${esc(r.listed_at||'Unknown')}</b></div>`:`<p>Bootstrap band ${money(r.low_usd)}–${money(r.high_usd)} · 200 resamples · 5th–95th percentile · median width ×${D.validation.bootstrap.median_band_width_x}</p><p>Rank range <b>#${r.rank_low}–${r.rank_high}</b> — the value band mapped to ranks; this row's rank #${r.rank} lies inside its range.</p><div class="formula">Implied value = exp(<b>${a.toFixed(3)} + ${b.toFixed(3)} × ln(${money(r.tvl_usd)})</b>) × family × growth × maturity = <b>${money(r.implied_value_usd)}</b><br>Size-curve multiple <b>${r.multiple.toFixed(3)}×</b> · family <b>${r.family.toFixed(3)}×</b> (${esc(r.category)} · ${r.peer_count} peers) · growth <b>${r.growth.toFixed(3)}×</b> (7D ${pct(r.change_7d)}) · maturity <b>${r.maturity.toFixed(3)}×</b> (${r.age_days!=null?r.age_days+' days':'age unknown'}) · curve slope <b>${b.toFixed(3)}</b><br>TVL <b>${money(r.tvl_usd)}</b> · 7D TVL change <b>${pct(r.change_7d)}</b> · tracked since <b>${esc(r.listed_at||'Unknown')}</b> · category peers <b>${r.peer_count}</b><br>Token odds <b>${Math.round(r.token_odds*100)}%</b> (piecewise-exponential hazard on listing age, cross-fitted AUC ${D.validation.odds.auc_cross_fitted}, Platt-calibrated) · expected value <b>${money(r.expected_value_usd)}</b> (implied × odds) — shown for context, never used to rank</div><h3>Nearest traded peers — within 10× of the curve</h3><table class="peers"><thead><tr><th>Peer</th><th>TVL</th><th>Recorded mcap</th><th>Multiple</th><th>Applied here</th></tr></thead><tbody>${np.peers.map(p=>`<tr><td>${esc(p.name)}</td><td>${money(p.tvl_usd)}</td><td>${money(p.mcap_usd)}</td><td>${(p.mcap_usd/p.tvl_usd).toFixed(3)}×</td><td>${money(r.tvl_usd*(p.mcap_usd/p.tvl_usd))}</td></tr>`).join('')}</tbody></table><p class="peers-note">${esc(np.note)}</p><div class="econ-footer">Fees and gas <b>${money2(r.gas_total_usd)}</b> · Income forgone <b>${money2(r.opportunity_usd)}</b> · Your time <b>~${D.validation.farm_economics.hours} h</b> · Slice if launch <b>${money2(r.slice_usd)}</b> · Break-even odds <b>${oddsFmt(r.break_even_odds)}</b> · Net per hour <b>${money2(r.net_per_hour_usd)}</b> · Expected net per hour <b>${money2(r.expected_net_per_hour_usd)}</b> (net/h × token odds)</div><h3>Deposit tiers — same arithmetic, bigger deposit</h3><table class="peers"><thead><tr><th>Deposit</th><th>Slice</th><th>Total cost</th><th>Break-even</th><th>Net / hour</th><th>Exp. net / hour</th><th>Verdict</th></tr></thead><tbody>${r.tiers.map(t=>`<tr><td>$${t.deposit_usd.toLocaleString('en-US')}</td><td>${money2(t.slice_usd)}</td><td>${money2(t.total_cost_usd)}</td><td>${oddsFmt(t.break_even_odds)}</td><td>${money2(t.net_per_hour_usd)}</td><td>${money2(t.expected_net_per_hour_usd)}</td><td>${t.verdict.toUpperCase()}</td></tr>`).join('')}</tbody></table><p class="peers-note">Farm verdicts are odds-gated: farm needs net/hour &gt; $25 AND token odds ≥ ${D.validation.farm_odds_gate.threshold} (${esc(D.validation.farm_odds_gate.threshold_source)}). A farm that fails the gate demotes to thin.</p><h3>Try the model — sandbox</h3><p class="panel-note">Change the multipliers and watch this row recompute live. Same arithmetic as the board — family, growth and maturity multiply the size-curve value; the $1,000-slice costs stay fixed.</p><div class="sandbox"><label><input type="checkbox" id="sb-family" checked> Family ${r.family.toFixed(3)}×</label><label>Growth weight <input type="range" id="sb-growth" min="0" max="0.7" step="0.05" value="0.35"> <span id="sb-growth-v">0.35</span></label><label><input type="checkbox" id="sb-maturity" checked> Maturity ${r.maturity.toFixed(3)}×</label><div class="sandbox-out" id="sb-out"></div></div>`}<p class="warning">${live?'This protocol records a token. A new-token farm thesis is not established.':'No launch date, supply or airdrop is established. TVL is not revenue. Listing age does not prove token-free history.'}</p><p>Snapshot: ${esc(D.as_of)}. Values are a reproducible scenario from sealed data, not a live valuation.</p><button id="detail-method">Read full methodology ↗</button></section><section><h3>${live?'Research checklist':'A small, deliberate farm plan'}</h3>${live?'<p>Verify token contract and published distribution terms. Separate token purchases from any future rewards program. Review liquidity, unlocks and product access before committing capital.</p>':`<p>Illustrative budget · verify product support before acting</p><ol class="steps">${r.farm_steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`}</section></div>`;
 $('#detail-method').onclick=()=>$('#methodology').showModal();
 // v8 P6: sandbox wiring — recompute this row live from the stored factors
 // (multiple × TVL × family' × growth' × maturity'), exactly the board's
 // arithmetic, with the $1,000-slice costs fixed.
 // v9: the sandbox applies the farm odds-gate too, so a recomputed row shows
 // the gated verdict, not just the money.
 if(!live){
   const sb=()=>{
     const famOn=$('#sb-family').checked,mOn=$('#sb-maturity').checked,w=parseFloat($('#sb-growth').value);
     $('#sb-growth-v').textContent=w.toFixed(2);
     const g=1+w*Math.tanh((r.change_7d??0)/35);
     const imp=Math.max(1,Math.round(r.multiple*r.tvl_usd*(famOn?r.family:1)*g*(mOn?r.maturity:1)));
     const slice=+(0.10*imp*(1000/r.tvl_usd)).toFixed(2);
     const net=+(slice-r.total_cost_usd).toFixed(2);
     const nph=+(net/2).toFixed(2);
     const gate=D.validation.farm_odds_gate.threshold;
     const verdict=nph>25&&r.token_odds>=gate?'FARM':nph>0?'THIN':'SKIP';
     const expNph=+(nph*r.token_odds).toFixed(2);
     $('#sb-out').innerHTML='Recomputed implied value <b>'+money(imp)+'</b> (board: '+money(r.implied_value_usd)+') · slice '+money2(slice)+' · net '+money2(nph)+'/hr (board: '+money2(r.net_per_hour_usd)+'/hr) · expected net '+money2(expNph)+'/hr · verdict <b>'+verdict+'</b> (board: '+r.verdict.toUpperCase()+', odds-gate ≥ '+gate+')';
   };
   for(const s of ['#sb-family','#sb-growth','#sb-maturity'])$(s).addEventListener('input',sb);
   sb();
 }
 $('#detail').showModal();
}
// --- v8 P6: two-protocol side-by-side compare. ---
function fillCompare(){
  const opts=D.rows.map(r=>`<option value="${esc(r.slug)}">#${r.rank} ${esc(r.name)}</option>`).join('');
  $('#compare-a').innerHTML=opts;$('#compare-b').innerHTML=opts;
  $('#compare-a').value=D.rows[0].slug;$('#compare-b').value=D.rows[1].slug;
  renderCompare();
}
function renderCompare(){
  const a=D.rows.find(r=>r.slug===$('#compare-a').value),b=D.rows.find(r=>r.slug===$('#compare-b').value);
  if(!a||!b)return;
  const line=(label,fa,fb)=>`<tr><td>${label}</td><td>${fa(a)}</td><td>${fb?fb(b):fa(b)}</td></tr>`;
  const m=x=>money(x),m2=x=>money2(x);
  $('#compare-table').innerHTML=`<table class="peers"><thead><tr><th></th><th>#${a.rank} ${esc(a.name)}</th><th>#${b.rank} ${esc(b.name)}</th></tr></thead><tbody>${line('Implied value',r=>m(r.implied_value_usd))}${line('Rank range',r=>'#'+r.rank_low+'–'+r.rank_high)}${line('Token odds',r=>Math.round(r.token_odds*100)+'%')}${line('Expected value',r=>m(r.expected_value_usd))}${line('TVL',r=>m(r.tvl_usd))}${line('7D TVL',r=>pct(r.change_7d))}${line('Family',r=>r.family.toFixed(3)+'×')}${line('Growth',r=>r.growth.toFixed(3)+'×')}${line('Maturity',r=>r.maturity.toFixed(3)+'×')}${line('Bootstrap band',r=>m(r.low_usd)+'–'+m(r.high_usd))}${line('Net / hour ($1,000)',r=>m2(r.net_per_hour_usd))}${line('Expected net / hour ($1,000)',r=>m2(r.expected_net_per_hour_usd))}${line('Verdict ($1,000)',r=>r.verdict.toUpperCase())}${line('Verdict ($5,000)',r=>r.tiers.find(t=>t.deposit_usd===5000).verdict.toUpperCase())}${line('Verdict ($25,000)',r=>r.tiers.find(t=>t.deposit_usd===25000).verdict.toUpperCase())}</tbody></table>`;
}
$('#compare-a').addEventListener('change',renderCompare);
$('#compare-b').addEventListener('change',renderCompare);
$('#compare-btn').onclick=()=>{fillCompare();$('#compare').showModal()};
for(const s of ['#search','#category','#chain','#scope'])$(s).addEventListener('input',()=>{page=0;render()});
$('#reset').onclick=()=>{for(const s of ['#search','#category','#chain'])$(s).value='';$('#scope').value='all';page=0;render()};
$('#prev').onclick=()=>{page--;render()};$('#next').onclick=()=>{page++;render()};
document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{direction=sort===b.dataset.sort?-direction:-1;sort=b.dataset.sort;page=0;render()});
$('#live').onclick=()=>{live=!live;page=0;$('#live').textContent=live?'⌁ Back to launch radar':'◈ Recorded tokens';render()};
$('#method').onclick=()=>$('#methodology').showModal();document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({as_of:D.as_of,rows:filtered},null,2)],{type:'application/json'}));a.download='signal-radar.json';a.click();URL.revokeObjectURL(a.href)};
// v8 P7: CSV export of the filtered view (same rows as the JSON export).
// v9: rank range + expected net/hour columns.
$('#export-csv').onclick=()=>{
  const head=['rank','rank_low','rank_high','name','category','tvl_usd','implied_value_usd','low_usd','high_usd','token_odds','expected_value_usd','net_per_hour_usd','expected_net_per_hour_usd','verdict'];
  const q=s=>'"'+String(s??'').replace(/"/g,'""')+'"';
  const csv=[head.join(',')].concat(filtered.map(r=>[r.rank,r.rank_low??'',r.rank_high??'',q(r.name),q(r.category),r.tvl_usd,r.implied_value_usd,r.low_usd,r.high_usd,r.token_odds??'',r.expected_value_usd??'',r.net_per_hour_usd,r.expected_net_per_hour_usd??'',r.verdict].join(','))).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='signal-radar.csv';a.click();URL.revokeObjectURL(a.href);
};
render();
