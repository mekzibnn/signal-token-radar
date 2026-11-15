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
const noToken=(p:any)=>!p.gecko_id&&!p.symbol&&!p.mcap_usd;
const age=(p:any)=>{const parsed=Date.parse(p.listed_at??'');return Number.isFinite(parsed)?Math.max(0,Math.floor((Date.parse(snapshot.as_of)-parsed)/86400000)):null;};
const peers=snapshot.protocols.filter((p:any)=>p.mcap_usd>0&&p.tvl_usd>0);
const globalMultiple=median(peers.map((p:any)=>clamp(p.mcap_usd/p.tvl_usd,0.05,2)));
function value(p:any){
 const group=peers.filter((q:any)=>q.category===p.category);
 const n=group.length;
 const local=median(group.map((q:any)=>clamp(q.mcap_usd/q.tvl_usd,0.05,2)));
 const multiple=(local*n+globalMultiple*8)/(n+8);
 const growth=1+0.35*Math.tanh((p.change_7d??0)/35);
 const days=age(p);
 const maturity=0.65+0.35*(1-Math.exp(-(days??365)/540));
 const implied=Math.max(1,Math.round(p.tvl_usd*multiple*growth*maturity));
 return {multiple,growth,maturity,age_days:days,peer_count:n,implied_value_usd:implied,low_usd:Math.round(implied*0.5),high_usd:Math.round(implied*1.7)};
}
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
const watch=new Set(snapshot.watchlist);
const candidates=snapshot.protocols.filter((p:any)=>watch.has(p.slug)||(noToken(p)&&p.category!=='CEX'&&!/\b(wrapped|staked|staking)\b|\s[vV]\d/.test(p.name)&&!['Bridge','Canonical Bridge','Liquid Staking','Liquid Restaking','Restaked BTC'].includes(p.category)));
const rows=candidates.map((p:any)=>({...p,...value(p),watchlist:watch.has(p.slug),token_status:'No token recorded',farm_steps:plan(p)})).sort((a:any,b:any)=>b.implied_value_usd-a.implied_value_usd||a.slug.localeCompare(b.slug)).map((p:any,i:number)=>({...p,rank:i+1}));
validateBoard(rows,snapshot);
const live=peers.map((p:any)=>({...p,token_status:'Token recorded'})).sort((a:any,b:any)=>b.mcap_usd-a.mcap_usd);
mkdirSync(out,{recursive:true});
writeFileSync(join(out,'board.json'),JSON.stringify({rows})+'\n');
const data={as_of:snapshot.as_of,source:snapshot.source,floor_usd:snapshot.floor_usd,watchlist:snapshot.watchlist,global_multiple:globalMultiple,rows,live};
// Keep generated data outside dashboard source so the dossier includes the complete application.
writeFileSync(join(out,'data.js'),'window.RADAR='+JSON.stringify(data)+';\n');
cpSync(join(root,'dashboard'),join(out,'dashboard'),{recursive:true});
cpSync(join(root,'screenshots'),join(out,'screenshots'),{recursive:true});
writeFileSync(join(out,'dossier.json'),buildDossier(out,{text_max_bytes:65536}));
console.log(JSON.stringify({rows:rows.length,watchlist:snapshot.watchlist.length,live:live.length,globalMultiple}));
