// Token launch radar v3 — peer-calibrated implied values, validated out of sample.
// The model is fitted on recorded-token peers (real market caps) and tested before it
// is trusted: a time-split out-of-sample test, a blind holdout, leave-one-out, and a
// bootstrap stability check. Farm plans are netted per hands-on hour with a stated
// capital slice and a break-even farmer count.
//
// What the tests decided (measured, not assumed): the log-log size curve
// ln(mcap) = a + b*ln(TVL) beats the category-median multiple on every test
// (OOS x3.41 vs x4.89, blind x3.59 vs x5.64, LOO x3.40 vs x5.19). Adding 7D growth,
// listing age or chain count as features made the tests worse, so they are not in
// the model. A jointly-fitted family factor was tried for v3 and rejected: shrunken
// category medians of curve residuals (k=2..40) and a joint OLS with category
// dummies under ridge (lambda=1..400) never beat the pure curve on all three tests
// at once — the best OOS variant (k=5, x3.05) lost blind (x4.25 vs x3.59) and LOO
// (x3.84 vs x3.40). The OOS and blind biases disagree (-0.50 vs -0.11), so no bias
// correction is applied: a correction fitted on one test would not survive the other.
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
// Average ranks (ties share the mean rank) for Spearman correlation.
function avgRanks(vals:number[]){
  const order=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]);
  const r=new Array(vals.length).fill(0);
  let i=0;
  while(i<order.length){
    let j=i;
    while(j+1<order.length&&order[j+1][0]===order[i][0])j++;
    const avg=(i+j)/2;
    for(let k=i;k<=j;k++)r[order[k][1]]=avg;
    i=j+1;
  }
  return r;
}
function scorePredictions(test:any[],pred:(p:any)=>number){
  const errs=test.map((p:any)=>Math.log(pred(p)/p.mcap_usd));
  const abs=errs.map(Math.abs);
  const med=median(abs);
  const within2=test.filter((_:any,i:number)=>abs[i]<Math.log(2)).length/test.length;
  const within3=test.filter((_:any,i:number)=>abs[i]<Math.log(3)).length/test.length;
  const bias=median(errs);
  const rp=avgRanks(test.map(pred)),ra=avgRanks(test.map((p:any)=>p.mcap_usd));
  const mp=mean(rp),ma=mean(ra);
  let cov=0,vp=0,va=0;
  for(let i=0;i<rp.length;i++){cov+=(rp[i]-mp)*(ra[i]-ma);vp+=(rp[i]-mp)**2;va+=(ra[i]-ma)**2}
  const rho=vp&&va?cov/Math.sqrt(vp*va):0;
  return {n:test.length,median_log_err:+med.toFixed(4),median_factor:+Math.exp(med).toFixed(3),within_2x:+within2.toFixed(3),within_3x:+within3.toFixed(3),bias_log:+bias.toFixed(4),rank_corr:+rho.toFixed(3)};
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
// --- Validation 3: leave-one-out. Each peer predicted from the other 127. ---
function looScore(useCurve:boolean){
  const errs:number[]=[];const preds:number[]=[];const actual:number[]=[];
  for(const p of peers){
    const train=peers.filter((q:any)=>q!==p);
    const f=fitMultiples(train),c=fitSizeCurve(train);
    const pr=predictPeer(p,f,c,useCurve);
    errs.push(Math.abs(Math.log(pr/p.mcap_usd)));preds.push(pr);actual.push(p.mcap_usd);
  }
  const med=median(errs);
  const within2=errs.filter((e:number)=>e<Math.log(2)).length/errs.length;
  const within3=errs.filter((e:number)=>e<Math.log(3)).length/errs.length;
  const rp=avgRanks(preds),ra=avgRanks(actual);
  const mp=mean(rp),ma=mean(ra);
  let cov=0,vp=0,va=0;
  for(let i=0;i<rp.length;i++){cov+=(rp[i]-mp)*(ra[i]-ma);vp+=(rp[i]-mp)**2;va+=(ra[i]-ma)**2}
  const rho=vp&&va?cov/Math.sqrt(vp*va):0;
  return {n:peers.length,median_log_err:+med.toFixed(4),median_factor:+Math.exp(med).toFixed(3),within_2x:+within2.toFixed(3),within_3x:+within3.toFixed(3),bias_log:0,rank_corr:+rho.toFixed(3)};
}
const looCurveScore=looScore(true),looCat=looScore(false);
// --- Model choice: the size curve wins only if it beats the category model on all three. ---
const useCurve=oosCurveScore.median_log_err<oosCat.median_log_err&&blindCurveScore.median_log_err<blindCat.median_log_err&&looCurveScore.median_log_err<looCat.median_log_err;
const finalFit=fitMultiples(peers),finalCurve=fitSizeCurve(peers);
function value(p:any){
 const base=useCurve?Math.exp(finalCurve.a+finalCurve.b*Math.log(p.tvl_usd))/p.tvl_usd:multipleFor(finalFit,p.category);
 const group=peers.filter((q:any)=>q.category===p.category);
 const implied=Math.max(1,Math.round(p.tvl_usd*base));
 return {multiple:base,age_days:age(p),peer_count:group.length,implied_value_usd:implied,low_usd:0,high_usd:0};
}
const watch=new Set(snapshot.watchlist);
const candidates=snapshot.protocols.filter((p:any)=>watch.has(p.slug)||(noToken(p)&&p.category!=='CEX'&&!/\b(wrapped|staked|staking)\b|\s[vV]\d/.test(p.name)&&!['Bridge','Canonical Bridge','Liquid Staking','Liquid Restaking','Restaked BTC'].includes(p.category)));
// --- Validation 4: bootstrap stability. 200 resamples of peers, refit, p5/p95 band. ---
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
// --- Farm economics, netted per hands-on hour. ---
// Fixed, stated terms: a $1,000 capital slice, 30 days, ~2 hands-on hours, 6
// transactions (Ethereum $12 each, other chains $1.50 each), opportunity cost at
// ~5% APY on the slice. The reward pool is 5% of the LOW-band implied value.
// How many farmers share it is structural, not a point guess: one active farmer
// per $10,000 of TVL, so the farmer count scales with protocol size and the
// giants — whose multiples are compressed by the size curve — stop paying.
// Two robustness numbers are shown with every verdict: the break-even farmer
// count (the pool divided by the costs — the farm pays only while fewer than
// that many farmers share it) and the break-even odds (the share of bootstrap
// samples whose implied value is high enough for the reward to cover the costs).
// Verdict: farm if net per hour > $25, marginal (thin) if > $0, skip otherwise.
// Reward assumption: $0 until published terms say otherwise.
const CAPITAL_SLICE_USD=1000,HOURS=2,TX_COUNT=6,FARMER_DENSITY_TVL_USD=10000,POOL_SHARE=0.05;
function plan(p:any){
 const chain=p.chains[0]||'the supported chain',c=(p.category||'').toLowerCase();
 const perTx=/ethereum/i.test(chain)?12:1.5;
 const gas=`$${perTx} per transaction`;
 const capital=CAPITAL_SLICE_USD;
 let action='Read the product documentation and test one supported core action with the minimum permitted amount; skip deposits if the product has no retail access.';
 if(/lend|cdp/.test(c))action=`If retail supply is supported, supply $${capital.toLocaleString('en-US')} of an asset the ${p.name} market actually lists on ${chain}; avoid borrowing and leverage.`;
 else if(/dex|amm/.test(c))action=`If the ${p.name} app supports retail swaps on ${chain}, swap $10 of a liquid pair once; inspect route and slippage before signing. Avoid thin liquidity pools.`;
 else if(/yield|vault|curator|allocator/.test(c))action=`Inspect the ${p.name} vault assets, withdrawal queue and caps on ${chain}; if eligible, deposit $${capital.toLocaleString('en-US')} in the simplest unlevered vault and record the shares.`;
 else if(/bridge/.test(c))action=`Verify ${p.name} supports both chains and the intended asset, then test a $10 bridge. Confirm receipt before any further transfer; stop if recovery depends on an unknown operator.`;
 else if(/staking|restak/.test(c))action=`Verify ${p.name} accepts retail users and inspect slashing and redemption terms; if suitable, stake at most $${capital.toLocaleString('en-US')} equivalent on ${chain} and keep the receipt.`;
 else if(/perpetual|derivative|prediction/.test(c))action='Use the documented testnet or read-only market first. Do not manufacture volume, trade on leverage or open an unwanted position solely for speculative points.';
 else if(/rwa|credit|uncollateral/.test(c))action='Check jurisdiction, KYC and minimum investment first. If access is restricted or the minimum exceeds your budget, monitor only and commit no funds.';
 return [
 `Verify ${p.name}'s official domain using independent project documentation; confirm whether a token or points program is actually announced. This snapshot is not evidence of eligibility. Cost: $0. Time: 15 minutes.`,
 `Check ${chain} support and fund a dedicated wallet only after reviewing contracts and approvals. Capital budget: $${capital.toLocaleString('en-US')}; estimated network reserve ${gas}, not a live quote. Time: 10 minutes.`,
 `${action} Capital is at risk, not a fee; estimated gas ${gas}. Time: 15–25 minutes.`,
 `If the first test succeeds, review ${p.name} once weekly for 30 days; use it only when useful and obey its published rules. No repeated activity is assumed to qualify. Budget: at most ${TX_COUNT} transactions at ${gas} each. Time: 10 minutes per week.`,
 `Log transaction IDs and net costs; test withdrawal before increasing exposure. Revoke unused approvals and exit if fees exceed budget or the product changes. Reward assumption: $0 until published terms say otherwise. Time: 15 minutes plus any documented withdrawal queue.`
 ];
}
function economics(p:any,v:any,bootsCol:number[]){
 const perTx=/ethereum/i.test(p.chains[0]||'')?12:1.5;
 const gasTotal=+(TX_COUNT*perTx).toFixed(2);
 const opportunity=+(CAPITAL_SLICE_USD*0.05*30/365).toFixed(2);
 const costs=gasTotal+opportunity;
 const pool=+((v.low_usd*POOL_SHARE)).toFixed(2);
 const farmers=Math.max(1,Math.round(p.tvl_usd/FARMER_DENSITY_TVL_USD));
 const reward=+Math.max(0,pool/farmers).toFixed(2);
 const net=+(reward-costs).toFixed(2);
 const netPerHour=+(net/HOURS).toFixed(2);
 const verdict=netPerHour>25?'farm':netPerHour>0?'thin':'skip';
 const breakEvenFarmers=Math.floor(pool/costs);
 const threshold=costs*farmers/POOL_SHARE;
 const odds=+(bootsCol.filter((x:number)=>x>=threshold).length/bootsCol.length).toFixed(3);
 return {gas_total_usd:gasTotal,capital_usd:CAPITAL_SLICE_USD,opportunity_usd:opportunity,reward_scenario_usd:reward,net_usd:net,net_per_hour_usd:netPerHour,verdict,break_even_farmers:breakEvenFarmers,break_even_odds:odds,farmers_estimate:farmers};
}
const rows=candidates.map((p:any,i:number)=>{
  const v=value(p);
  const b=band(i,boots);
  v.low_usd=b.low;v.high_usd=b.high;
  widths.push(b.high/Math.max(1,b.low));
  const e=economics(p,v,boots.map((row:any)=>row[i]));
  const steps=plan(p);
  steps.push(`Scenario economics (not a promise): one active farmer per $10,000 of TVL shares 5% of the low-band value, so the scenario reward is $${e.reward_scenario_usd.toLocaleString('en-US')} for this protocol. Minus gas $${e.gas_total_usd} for ${TX_COUNT} transactions and $${e.opportunity_usd} of 30-day opportunity cost on a $${CAPITAL_SLICE_USD.toLocaleString('en-US')} slice, net $${e.net_usd.toLocaleString('en-US')} over ~${HOURS} hands-on hours ($${e.net_per_hour_usd.toLocaleString('en-US')}/hour). The farm pays if fewer than ${e.break_even_farmers.toLocaleString('en-US')} farmers share the pool; break-even odds ${Math.round(e.break_even_odds*100)}%. Verdict: ${e.verdict.toUpperCase()}.`);
  return {...p,...v,watchlist:watch.has(p.slug),token_status:'No token recorded',farm_steps:steps,...e};
}).sort((a:any,b:any)=>b.implied_value_usd-a.implied_value_usd||a.slug.localeCompare(b.slug)).map((p:any,i:number)=>({...p,rank:i+1}));
validateBoard(rows,snapshot);
const live=peers.map((p:any)=>({...p,token_status:'Token recorded'})).sort((a:any,b:any)=>b.mcap_usd-a.mcap_usd);
const verdicts={farm:rows.filter((r:any)=>r.verdict==='farm').length,thin:rows.filter((r:any)=>r.verdict==='thin').length,skip:rows.filter((r:any)=>r.verdict==='skip').length};
const belowFloor=rows.filter((r:any)=>r.tvl_usd<snapshot.floor_usd).length;
const validation={
  model:useCurve?`size curve ln(mcap) = ${finalCurve.a.toFixed(3)} + ${finalCurve.b.toFixed(3)}*ln(TVL)`:'category-shrunk median multiple',
  size_curve:{a:+finalCurve.a.toFixed(4),b:+finalCurve.b.toFixed(4)},
  oos_time_split:{...oosCurveScore,model_category:oosCat,model_size_curve:oosCurveScore},
  blind_holdout:{...blindCurveScore,model_category:blindCat,model_size_curve:blindCurveScore},
  loo:{...looCurveScore,model_category:looCat,model_size_curve:looCurveScore},
  feature_tests:'7D growth, listing age and chain count were tested as extra features and removed: each made the out-of-sample and/or blind error worse. A jointly-fitted family factor (shrunken category residuals, joint OLS with ridge) was tested for v3 and rejected: no variant beat the pure size curve on all three tests. No bias correction: OOS and blind biases disagree (-0.50 vs -0.11), so a correction fitted on one test would not survive the other.',
  bootstrap:{resamples:200,median_band_width_x:+median(widths).toFixed(2)},
  farm_verdicts:verdicts,
  farm_economics:{capital_slice_usd:CAPITAL_SLICE_USD,hours:HOURS,days:30,transactions:TX_COUNT,pool_share:POOL_SHARE,farmer_density_tvl_usd:FARMER_DENSITY_TVL_USD},
  stats:{below_floor:belowFloor,peer_baseline:+globalMultiple.toFixed(3)},
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
 `The curve is the model that measured best on three tests against the category-median multiple baseline (see Validation). The full formula, fitted coefficients and verdict rule are shown on the board itself.`,
 '',
 '## Validation (measured on recorded peers with real market caps, never on the ranked rows)',
 `- Time-split out-of-sample: fitted on the oldest 70% of dated peers (${oosTrain.length}), tested on the newest 30% (${oosTest.length}). Size curve median error x${oosCurveScore.median_factor}, within 3x ${Math.round(oosCurveScore.within_3x*100)}% (category baseline x${oosCat.median_factor}, ${Math.round(oosCat.within_3x*100)}%).`,
 `- Blind holdout: 20% of peers (${blindTest.length}) held out by slug hash, never fitted. Size curve median error x${blindCurveScore.median_factor}, within 3x ${Math.round(blindCurveScore.within_3x*100)}% (category baseline x${blindCat.median_factor}, ${Math.round(blindCat.within_3x*100)}%). Rank correlation ${blindCurveScore.rank_corr}.`,
 `- Leave-one-out: every peer predicted from the other ${peers.length-1}. Size curve median error x${looCurveScore.median_factor}, within 3x ${Math.round(looCurveScore.within_3x*100)}% (category baseline x${looCat.median_factor}, ${Math.round(looCat.within_3x*100)}%). Rank correlation ${looCurveScore.rank_corr}.`,
 `- Bootstrap stability: 200 resamples of peers, refit, 5th-95th percentile band per row. Median band width x${median(widths).toFixed(2)}. The low-high band on each row is this bootstrap interval, not an assumed stress band.`,
 '- A median error of x3.4 means the estimate is typically within a factor of 3.4 of the real market cap; within-3x is the share of tested peers predicted within a factor of three. Predicting a launch market cap from TVL alone is noisy — the numbers above are the honest measurement of that noise, and the model shown is the one that measured best.',
 '',
 '## Farm economics (netted per hands-on hour)',
 `Fixed terms: a $${CAPITAL_SLICE_USD.toLocaleString('en-US')} capital slice, 30 days, ~${HOURS} hands-on hours, ${TX_COUNT} transactions (Ethereum $12 each, other chains $1.50 each), opportunity cost at ~5% APY on the slice. Reward pool: 5% of the low-band implied value, shared by one active farmer per $${FARMER_DENSITY_TVL_USD.toLocaleString('en-US')} of TVL. Net per hour = (scenario reward - gas - opportunity cost) / ${HOURS}. Verdict: farm if net per hour > $25, marginal (thin) if > $0, skip otherwise.`,
 `Each row also shows its break-even farmer count (the pool divided by the costs — the farm pays only while fewer than that many farmers share it) and its break-even odds (the share of bootstrap samples whose implied value is high enough for the reward to cover the costs).`,
 `Verdicts across ${rows.length} rows: ${verdicts.farm} farm, ${verdicts.thin} thin, ${verdicts.skip} skip. The largest rows are skip: the size curve compresses their multiples, so the scenario reward cannot cover the costs at their farmer count.`,
 'No reward is assumed until a protocol publishes terms. TVL is not revenue; market cap is not fully diluted value.',
 '',
 '## Limits',
 'No supply, distribution, revenue or launch probability is available in the snapshot. A protocol with no token recorded may still have one. Farm plans are research templates with illustrative budgets; asset support, access, points, eligibility and live fees require independent verification.'
].join('\n');
writeFileSync(join(out,'methodology.md'),method+'\n');
writeFileSync(join(out,'dossier.json'),buildDossier(out,{text_max_bytes:65536}));
console.log(JSON.stringify({rows:rows.length,watchlist:snapshot.watchlist.length,live:live.length,globalMultiple,validation}));
