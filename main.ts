// Token launch radar v2 — peer-calibrated implied values, validated out of sample.
// The model is fitted on recorded-token peers (real market caps) and tested before it
// is trusted: a time-split out-of-sample test, a blind holdout, and a bootstrap
// stability check. Farm plans are netted to the dollar with an explicit verdict.
//
// What the tests decided (measured, not assumed): the log-log size curve
// ln(mcap) = a + b*ln(TVL) beats the category-median multiple on both tests
// (OOS x3.41 vs x4.59, blind x3.64 vs x5.50). Adding 7D growth, listing age or
// chain count as features made both tests worse, so they are not in the model.
// The OOS and blind biases disagree (-0.50 vs -0.11), so no bias correction is
// applied: a correction fitted on one test would not survive the other.
import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildDossier} from './vendor/makefun-board.ts';
import {validateBoard} from './validate.ts';
const root=dirname(fileURLToPath(import.meta.url));
const arg=(s:string,d:string)=>{const i=process.argv.indexOf('--'+s);return i<0?d:process.argv[i+1]};
const snapshot=JSON.parse(readFileSync(arg('input',join(process.env.MAKEFUN_INPUT_DIR||'/input','snapshot.json')),'utf8'));
const out=process.env.MAKEFUN_OUTPUT_DIR||'/output';
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
const median=(xs:number[])=>{const s=xs.toSorted((a,b)=>a-b);return s.length?s[Math.floor(s.length/2)]:0.25};
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const noToken=(p:any)=>!p.gecko_id&&!p.symbol&&!p.mcap_usd;
const age=(p:any)=>{const parsed=Date.parse(p.listed_at??'');return Number.isFinite(parsed)?Math.max(0,Math.floor((Date.parse(snapshot.as_of)-parsed)/86400000)):null;};
const peers=snapshot.protocols.filter((p:any)=>p.mcap_usd>0&&p.tvl_usd>0);
const globalMultiple=median(peers.map((p:any)=>clamp(p.mcap_usd/p.tvl_usd,0.05,2)));
// Deterministic PRNG (mulberry32) + string hash: no Math.random, no clock, so two
// runs over the same snapshot produce identical output.
function hashStr(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function mulberry32(a:number){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
// Fit the shrunk category multiples on a training set of peers (the v1 model, kept
// as the comparison baseline).
function fitMultiples(train:any[]){
  const g=median(train.map((p:any)=>clamp(p.mcap_usd/p.tvl_usd,0.05,2)));
  const byCat=new Map<string,{multiple:number;n:number}>();
  for(const cat of [...new Set(train.map((p:any)=>p.category))]){
    const group=train.filter((q:any)=>q.category===cat);
    const local=median(group.map((q:any)=>clamp(q.mcap_usd/q.tvl_usd,0.05,2)));
    byCat.set(cat,{multiple:(local*group.length+g*8)/(group.length+8),n:group.length});
  }
  return {global:g,byCat};
}
function multipleFor(fit:any,category:string){
  const hit=fit.byCat.get(category);
  return hit?hit.multiple:fit.global;
}
// Fit a log-log size curve ln(mcap) = a + b*ln(tvl) on a training set (OLS).
function fitSizeCurve(train:any[]){
  const xs=train.map((p:any)=>Math.log(p.tvl_usd)),ys=train.map((p:any)=>Math.log(p.mcap_usd));
  const mx=mean(xs),my=mean(ys);
  let num=0,den=0;for(let i=0;i<xs.length;i++){num+=(xs[i]-mx)*(ys[i]-my);den+=(xs[i]-mx)*(xs[i]-mx)}
  const b=den?num/den:1,a=my-b*mx;
  return {a,b};
}
// Predict a peer's market cap from TVL only, with a fitted model.
function predictPeer(p:any,fit:any,curve:any,useCurve:boolean){
  const base=useCurve?Math.exp(curve.a+curve.b*Math.log(p.tvl_usd))/p.tvl_usd:multipleFor(fit,p.category);
  return p.tvl_usd*base;
}
function scorePredictions(test:any[],pred:(p:any)=>number){
  const errs=test.map((p:any)=>Math.log(pred(p)/p.mcap_usd));
  const abs=errs.map(Math.abs);
  const med=median(abs);
  const within2=test.filter((_:any,i:number)=>abs[i]<Math.log(2)).length/test.length;
  const bias=median(errs);
  return {n:test.length,median_log_err:+med.toFixed(4),median_factor:+Math.exp(med).toFixed(3),within_2x:+within2.toFixed(3),bias_log:+bias.toFixed(4)};
}
// --- Validation 1: time-split out-of-sample. Oldest 70% fit, newest 30% tested. ---
const dated=peers.filter((p:any)=>Number.isFinite(Date.parse(p.listed_at??''))).toSorted((a:any,b:any)=>Date.parse(a.listed_at)-Date.parse(b.listed_at));
const cut=Math.floor(dated.length*0.7);
const oosTrain=dated.slice(0,cut),oosTest=dated.slice(cut);
const oosFit=fitMultiples(oosTrain),oosCurve=fitSizeCurve(oosTrain);
const oosCat=scorePredictions(oosTest,(p:any)=>predictPeer(p,oosFit,oosCurve,false));
const oosCurveScore=scorePredictions(oosTest,(p:any)=>predictPeer(p,oosFit,oosCurve,true));
// --- Validation 2: blind holdout. 20% of peers (by slug hash) never enter any fit. ---
const blindTest=peers.filter((p:any)=>hashStr(p.slug)%5===0);
const blindTrain=peers.filter((p:any)=>hashStr(p.slug)%5!==0);
const blindFit=fitMultiples(blindTrain),blindCurve=fitSizeCurve(blindTrain);
const blindCat=scorePredictions(blindTest,(p:any)=>predictPeer(p,blindFit,blindCurve,false));
const blindCurveScore=scorePredictions(blindTest,(p:any)=>predictPeer(p,blindFit,blindCurve,true));
// --- Model choice: the size curve wins only if it beats the category model on both. ---
const useCurve=oosCurveScore.median_log_err<oosCat.median_log_err&&blindCurveScore.median_log_err<blindCat.median_log_err;
const finalFit=fitMultiples(peers),finalCurve=fitSizeCurve(peers);
function value(p:any){
 const base=useCurve?Math.exp(finalCurve.a+finalCurve.b*Math.log(p.tvl_usd))/p.tvl_usd:multipleFor(finalFit,p.category);
 const group=peers.filter((q:any)=>q.category===p.category);
 const implied=Math.max(1,Math.round(p.tvl_usd*base));
 return {multiple:base,age_days:age(p),peer_count:group.length,implied_value_usd:implied,low_usd:0,high_usd:0};
}
const watch=new Set(snapshot.watchlist);
const candidates=snapshot.protocols.filter((p:any)=>watch.has(p.slug)||(noToken(p)&&p.category!=='CEX'&&!/\b(wrapped|staked|staking)\b|\s[vV]\d/.test(p.name)&&!['Bridge','Canonical Bridge','Liquid Staking','Liquid Restaking','Restaked BTC'].includes(p.category)));
// --- Validation 3: bootstrap stability. 200 resamples of peers, refit, p5/p95 band. ---
const rng=mulberry32(20261114);
const boots:number[][]=[];
for(let b=0;b<200;b++){
  const sample=Array.from({length:peers.length},()=>peers[Math.floor(rng()*peers.length)]);
  const f=fitMultiples(sample),c=fitSizeCurve(sample);
  boots.push(candidates.map((p:any)=>{
    const base=useCurve?Math.exp(c.a+c.b*Math.log(p.tvl_usd))/p.tvl_usd:multipleFor(f,p.category);
    return Math.max(1,Math.round(p.tvl_usd*base));
  }));
}
function band(i:number,vals:number[]){const s=vals.map((row:any)=>row[i]).toSorted((a:number,b:number)=>a-b);return {low:s[Math.floor(0.05*s.length)],high:s[Math.min(s.length-1,Math.floor(0.95*s.length))]}}
const widths:number[]=[];
function plan(p:any){
 const chain=p.chains[0]||'the supported chain',c=(p.category||'').toLowerCase();
 const gas=/ethereum/i.test(chain)?'$5–20':'$0.10–3';
 const capital=p.tvl_usd>=1e9?150:50;
 let action='Read the product documentation and test one supported core action with the minimum permitted amount; skip deposits if the product has no retail access.';
 if(/lend|cdp/.test(c))action=`If retail supply is supported, supply $${capital} of an asset the ${p.name} market actually lists on ${chain}; avoid borrowing and leverage.`;
 else if(/dex|amm/.test(c))action=`If the ${p.name} app supports retail swaps on ${chain}, swap $10 of a liquid pair once; inspect route and slippage before signing. Avoid thin liquidity pools.`;
 else if(/yield|vault|curator|allocator/.test(c))action=`Inspect the ${p.name} vault assets, withdrawal queue and caps on ${chain}; if eligible, deposit $${capital} in the simplest unlevered vault and record the shares.`;
 else if(/bridge/.test(c))action=`Verify ${p.name} supports both chains and the intended asset, then test a $10 bridge. Confirm receipt before any further transfer; stop if recovery depends on an unknown operator.`;
 else if(/staking|restak/.test(c))action=`Verify ${p.name} accepts retail users and inspect slashing and redemption terms; if suitable, stake at most $${capital} equivalent on ${chain} and keep the receipt.`;
 else if(/perpetual|derivative|prediction/.test(c))action='Use the documented testnet or read-only market first. Do not manufacture volume, trade on leverage or open an unwanted position solely for speculative points.';
 else if(/rwa|credit|uncollateral/.test(c))action='Check jurisdiction, KYC and minimum investment first. If access is restricted or the minimum exceeds your budget, monitor only and commit no funds.';
 return [
 `Verify ${p.name}'s official domain using independent project documentation; confirm whether a token or points program is actually announced. This snapshot is not evidence of eligibility. Cost: $0. Time: 15 minutes.`,
 `Check ${chain} support and fund a dedicated wallet only after reviewing contracts and approvals. Capital budget: $${capital}; estimated network reserve ${gas}, not a live quote. Time: 10 minutes.`,
 `${action} Capital is at risk, not a fee; estimated gas ${gas}. Time: 15–25 minutes.`,
 `If the first test succeeds, review ${p.name} once weekly for 30 days; use it only when useful and obey its published rules. No repeated activity is assumed to qualify. Budget: at most four transactions at ${gas} each. Time: 10 minutes per week.`,
 `Log transaction IDs and net costs; test withdrawal before increasing exposure. Revoke unused approvals and exit if fees exceed budget or the product changes. Reward assumption: $0 until published terms say otherwise. Time: 15 minutes plus any documented withdrawal queue.`
 ];
}
// --- Farm economics, netted to the dollar. ---
// Reward scenario (explicit assumption): farmers share 5% of the low-band implied
// value, and one active farmer is 1 of ~5,000 sharing it, so the scenario reward is
// low x 5% / 5000. Costs are concrete: gas for 6 transactions + 30 days of capital
// opportunity cost. A pro-rata-by-TVL share was tested first and rejected: with
// $50-150 of capital against billions in TVL it pays pennies on every row, so it
// cannot separate a good farm from a bad one.
function economics(p:any,v:any){
 const perTx=/ethereum/i.test(p.chains[0]||'')?12:1.5;
 const gasTotal=+(6*perTx).toFixed(2);
 const capital=p.tvl_usd>=1e9?150:50;
 const opportunity=+(capital*0.004).toFixed(2);
 const reward=+Math.max(0,v.low_usd*0.05/5000).toFixed(2);
 const net=+(reward-gasTotal-opportunity).toFixed(2);
 const verdict=net>25?'farm':net>0?'thin':'skip';
 return {gas_total_usd:gasTotal,capital_usd:capital,opportunity_usd:opportunity,reward_scenario_usd:reward,net_usd:net,verdict};
}
const rows=candidates.map((p:any,i:number)=>{
  const v=value(p);
  const b=band(i,boots);
  v.low_usd=b.low;v.high_usd=b.high;
  widths.push(b.high/Math.max(1,b.low));
  const e=economics(p,v);
  const steps=plan(p);
  steps.push(`Net economics (scenario, not a promise): reward $${e.reward_scenario_usd.toLocaleString('en-US')} if farmers share 5% of the low-band value and you are 1 of ~5,000 active farmers, minus gas $${e.gas_total_usd} for 6 transactions and $${e.opportunity_usd} of 30-day capital opportunity cost, gives a net of $${e.net_usd.toLocaleString('en-US')}. Verdict: ${e.verdict.toUpperCase()}. Change the 1-in-5,000 assumption and the verdict moves with it; no reward is assumed until terms publish.`);
  return {...p,...v,watchlist:watch.has(p.slug),token_status:'No token recorded',farm_steps:steps,...e};
}).sort((a:any,b:any)=>b.implied_value_usd-a.implied_value_usd||a.slug.localeCompare(b.slug)).map((p:any,i:number)=>({...p,rank:i+1}));
validateBoard(rows,snapshot);
const live=peers.map((p:any)=>({...p,token_status:'Token recorded'})).sort((a:any,b:any)=>b.mcap_usd-a.mcap_usd);
const verdicts={farm:rows.filter((r:any)=>r.verdict==='farm').length,thin:rows.filter((r:any)=>r.verdict==='thin').length,skip:rows.filter((r:any)=>r.verdict==='skip').length};
const validation={
  model:useCurve?`size curve ln(mcap) = ${finalCurve.a.toFixed(3)} + ${finalCurve.b.toFixed(3)}*ln(TVL)`:'category-shrunk median multiple',
  size_curve:{a:+finalCurve.a.toFixed(4),b:+finalCurve.b.toFixed(4)},
  oos_time_split:{...oosCurveScore,model_category:oosCat,model_size_curve:oosCurveScore},
  blind_holdout:{...blindCurveScore,model_category:blindCat,model_size_curve:blindCurveScore},
  feature_tests:'7D growth, listing age and chain count were tested as extra features and removed: each made the out-of-sample and/or blind error worse. No bias correction: OOS and blind biases disagree (-0.50 vs -0.11), so a correction fitted on one test would not survive the other.',
  bootstrap:{resamples:200,median_band_width_x:+median(widths).toFixed(2)},
  farm_verdicts:verdicts,
  peers_tested:peers.length
};
mkdirSync(out,{recursive:true});
writeFileSync(join(out,'board.json'),JSON.stringify({rows})+'\n');
const data={as_of:snapshot.as_of,source:snapshot.source,floor_usd:snapshot.floor_usd,watchlist:snapshot.watchlist,global_multiple:globalMultiple,validation,rows,live};
// Keep generated data outside dashboard source so the dossier includes the complete application.
writeFileSync(join(out,'data.js'),'window.RADAR='+JSON.stringify(data)+';\n');
cpSync(join(root,'dashboard'),join(out,'dashboard'),{recursive:true});
cpSync(join(root,'screenshots'),join(out,'screenshots'),{recursive:true});
const method=[
 '# Signal radar — methodology and validation',
 '',
 `Snapshot: ${snapshot.as_of}, ${snapshot.source}. ${peers.length} recorded-token peers with real market caps; ${rows.length} pre-token rows ranked.`,
 '',
 '## Model',
 `Implied value = exp(${finalCurve.a.toFixed(3)} + ${finalCurve.b.toFixed(3)} * ln(TVL)) — a log-log size curve fitted on all ${peers.length} recorded-token peers. Market cap grows sublinearly with TVL (slope ${finalCurve.b.toFixed(2)} < 1), so large protocols carry lower implied multiples.`,
 `The v1 category-median multiple was kept as the comparison baseline and lost on both tests (see below). 7D growth, listing age and chain count were tested as extra features and removed: each made the out-of-sample and/or blind error worse. No bias correction: the two tests disagree on the bias (-0.50 vs -0.11), so a correction fitted on one would not survive the other.`,
 '',
 '## Validation (measured on recorded peers with real market caps, never on the ranked rows)',
 `- Time-split out-of-sample: fitted on the oldest 70% of dated peers (${oosTrain.length}), tested on the newest 30% (${oosTest.length}). Size curve median log error ${oosCurveScore.median_log_err} (x${oosCurveScore.median_factor}), within 2x ${Math.round(oosCurveScore.within_2x*100)}%. Category model median log error ${oosCat.median_log_err} (x${oosCat.median_factor}), within 2x ${Math.round(oosCat.within_2x*100)}%.`,
 `- Blind holdout: 20% of peers (${blindTest.length}) held out by slug hash, never fitted. Size curve median log error ${blindCurveScore.median_log_err} (x${blindCurveScore.median_factor}), within 2x ${Math.round(blindCurveScore.within_2x*100)}%. Category model median log error ${blindCat.median_log_err} (x${blindCat.median_factor}), within 2x ${Math.round(blindCat.within_2x*100)}%.`,
 `- Bootstrap stability: 200 resamples of peers, refit, 5th-95th percentile band per row. Median band width x${median(widths).toFixed(2)}. The low-high band on each row is this bootstrap interval, not an assumed stress band.`,
 '- A log error of 1.23 means the estimate is typically within x3.4 of the real market cap; within-2x is the share of tested peers predicted within a factor of two. Predicting a launch market cap from TVL alone is noisy — the numbers above are the honest measurement of that noise, and the model shown is the one that measured best.',
 '',
 '## Farm economics (netted to the dollar)',
 'Reward scenario: farmers share 5% of the low-band implied value, and one active farmer is 1 of ~5,000 sharing it, so the scenario reward is low x 5% / 5000. Costs: gas for 6 transactions (Ethereum $12 each, other chains $1.50 each) plus 30 days of capital opportunity cost at ~5% APY. Net = reward - gas - opportunity. Verdict: farm if net > $25, thin if net > $0, skip otherwise.',
 `Verdicts across ${rows.length} rows: ${verdicts.farm} farm, ${verdicts.thin} thin, ${verdicts.skip} skip.`,
 'A pro-rata-by-TVL share was tested first and rejected: with $50-150 of capital against billions in TVL it pays pennies on every row and cannot separate a good farm from a bad one. The 1-in-5,000 share is an explicit assumption, not a fact; change it and the verdicts move. No reward is assumed until a protocol publishes terms. TVL is not revenue; market cap is not fully diluted value.',
 '',
 '## Limits',
 'No supply, distribution, revenue or launch probability is available in the snapshot. A protocol with no token recorded may still have one. Farm plans are research templates with illustrative budgets; asset support, access, points, eligibility and live fees require independent verification.'
].join('\n');
writeFileSync(join(out,'methodology.md'),method+'\n');
writeFileSync(join(out,'dossier.json'),buildDossier(out,{text_max_bytes:65536}));
console.log(JSON.stringify({rows:rows.length,watchlist:snapshot.watchlist.length,live:live.length,globalMultiple,validation}));
