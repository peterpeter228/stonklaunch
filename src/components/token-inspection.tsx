'use client';
import {useEffect,useRef} from 'react';
import {ShieldCheck,RefreshCw,X} from 'lucide-react';
import type {TokenInspection} from '@/types/token-inspection';
import {useApi,Loading,ErrorState,Notice,CopyAddress} from './platform';

function exactUnits(raw:string,decimals:number){
  if(!/^\d+$/.test(raw)||!Number.isInteger(decimals)||decimals<0||decimals>255)return 'Unavailable';
  if(decimals===0)return raw;
  const padded=raw.padStart(decimals+1,'0');
  return padded.slice(0,-decimals)+(padded.slice(-decimals).replace(/0+$/,'')?'.'+padded.slice(-decimals).replace(/0+$/,''):'');
}
function tokenUnits(raw:string,decimals:number){const v=exactUnits(raw,decimals);return v+' '+(v==='1'?'token':'tokens');}
function Authority({label,value}:{label:string;value:string|null}){return <div className="inspection-authority"><span>{label}</span>{value?<CopyAddress label={label} value={value}/>:<strong>No authority set</strong>}</div>;}

export function TokenInspectionPanel({mint,onClose}:{mint:string;onClose:()=>void}){
 const req=useApi<TokenInspection>('/api/tokens/'+encodeURIComponent(mint)+'/inspection');
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus({preventScroll:true});heading.current?.closest('section')?.scrollIntoView({block:'start'});},[]);
 const d=req.data;
 return <section className="inspection-panel" aria-labelledby="inspection-title">
  <div className="inspection-header"><div><span className="eyebrow"><ShieldCheck size={13}/> READ-ONLY · NO SIGNATURE</span><h2 id="inspection-title" tabIndex={-1} ref={heading}>Transfer costs, not promises.</h2></div><button className="button small" onClick={onClose} aria-label="Close token inspection"><X size={16}/></button></div>
  <p className="inspection-mint">{mint}</p>
  {req.loading?<Loading/>:req.error?<ErrorState error={req.error} retry={req.refresh}/>:d?<>
   {d.synthetic&&<Notice tone="warning">DEMO · Synthetic mint configuration. These are not real fees, payouts or investment results.</Notice>}
   <div className="inspection-grid">
    <div><span>Transfer-fee extension</span><strong>{d.feeStatus==='configured'?`${((d.transferFee?.currentBps||0)/100).toFixed(2)}% per transfer`:'Not present'}</strong><small>{d.feeStatus==='configured'?'Current epoch rate, before the cap':'This does not mean zero trading costs or zero risk.'}</small></div>
    <div><span>Maximum fee per transfer</span><strong>{d.transferFee?tokenUnits(d.transferFee.maximumFeeRaw,d.decimals):'Not applicable'}</strong><small>Token units, not USD. Integer rounding applies.</small></div>
    <div><span>Verified holder payouts</span><strong>Unknown</strong><small>No payout history has been verified. No daily yield or break-even estimate.</small></div>
   </div>
   {d.transferFee?.nextEpoch!==null&&d.transferFee?.nextEpoch!==undefined&&<Notice tone="warning">Scheduled fee: {((d.transferFee.nextBps||0)/100).toFixed(2)}%, capped at {tokenUnits(d.transferFee.nextMaximumFeeRaw||'0',d.decimals)} per transfer, from epoch {d.transferFee.nextEpoch}. Recheck before any transaction.</Notice>}
   <details className="inspection-details"><summary>Authorities and snapshot evidence</summary><div className="inspection-authorities">
    <Authority label="Mint authority" value={d.mintAuthority}/><Authority label="Freeze authority" value={d.freezeAuthority}/>
    {d.transferFee&&<><Authority label="Fee-setting authority" value={d.transferFee.configAuthority}/><Authority label="Withheld-fee withdrawal authority" value={d.transferFee.withdrawAuthority}/></>}
   </div><p>Mint-level withheld amount: {d.transferFee?tokenUnits(d.transferFee.withheldRaw,d.decimals):'Not applicable'}. This is not total tax collected, claimable holder income, or distributed rewards.</p><p>Network: {d.cluster} · Epoch: {d.currentEpoch} · Slot: {d.slot??'synthetic'}</p><p>Observed: {new Date(d.observedAt).toISOString()} · {d.dataSource}</p><p className="inspection-mint">Token program: {d.tokenProgram}</p></details>
   <p className="inspection-disclaimer">This inspection does not enable trading or certify the token as safe. Pool fees, route costs, price impact and network costs are separate. A fee extension does not guarantee rewards.</p>
   <button className="button small" onClick={req.refresh}><RefreshCw size={14}/>Refresh inspection</button>
  </>:null}
 </section>;
}
