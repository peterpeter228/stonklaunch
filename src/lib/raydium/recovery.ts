'use client';
export type RecoveryRecord={cluster:string;wallet:string;kind:string;state?:string;signature?:string;[key:string]:unknown};
export function recoveryKey(kind:'transaction'|'launch',cluster:string,wallet:string){return `stonklaunch.pending${kind==='transaction'?'Transaction':'Launch'}:${cluster}:${wallet}`;}
export function writeRecovery(kind:'transaction'|'launch',record:RecoveryRecord){if(!record.cluster||!record.wallet)throw Error('Recovery context missing');localStorage.setItem(recoveryKey(kind,record.cluster,record.wallet),JSON.stringify(record));}
export function readRecovery(kind:'transaction'|'launch',cluster:string,wallet:string):RecoveryRecord|null{
 const scoped=localStorage.getItem(recoveryKey(kind,cluster,wallet));const legacy=scoped===null?localStorage.getItem(`stonklaunch.pending${kind==='transaction'?'Transaction':'Launch'}`):null;const raw=scoped??legacy;if(!raw)return null;
 let value:RecoveryRecord;try{value=JSON.parse(raw);}catch{throw Error('Recovery journal is damaged; inspect the original transaction before continuing.');}
 if(!value||typeof value!=='object'||typeof value.cluster!=='string'||typeof value.wallet!=='string')throw Error('Recovery journal context is missing; do not repeat the original operation.');
 if(value.cluster!==cluster||value.wallet!==wallet){if(scoped)throw Error('Recovery journal identity mismatch');return null;}
 if(!scoped)writeRecovery(kind,value);return value;
}
