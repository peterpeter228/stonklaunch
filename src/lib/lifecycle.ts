export type SubmissionState='draft'|'validating'|'awaiting_signature'|'submitted'|'confirmed'|'failed'|'confirmation_unknown';
export function resolveTradeRoute(status:number,cpmmVerified:boolean):'launchlab'|'cpmm'{
 if(status===0)return 'launchlab';
 if(status===1)throw new Error('MIGRATION_PENDING');
 if(status===2&&cpmmVerified)return 'cpmm';
 throw new Error('CPMM_UNVERIFIED');
}
export function canResubmit(state:SubmissionState):boolean{return state==='draft'||state==='failed';}
export function eventIdentity(cluster:string,signature:string,outer:number,inner:number):string{
 if(!signature||!Number.isSafeInteger(outer)||!Number.isSafeInteger(inner)||outer<0||inner<0)throw new Error('Invalid event identity');
 return `${cluster}:${signature}:${outer}:${inner}`;
}
export function reconcileSubmission(state:SubmissionState,result:'confirmed'|'failed'|'not_found'|'rpc_error'):SubmissionState{
 if(result==='confirmed')return 'confirmed';if(result==='failed')return 'failed';
 if(state==='submitted'||state==='confirmation_unknown')return 'confirmation_unknown';return state;
}
