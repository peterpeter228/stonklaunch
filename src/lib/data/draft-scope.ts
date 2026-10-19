/** Every draft operation must retain all three ownership boundaries. */
export function draftScope(userId:string,wallet:string,cluster:string){return {owner_user_id:userId,owner_wallet:wallet,cluster};}
/** A private response is usable only for the identity and generation that requested it. */
export function currentPrivateResponse(start:{generation:number;wallet:string;cluster:string},current:{generation:number;wallet:string|null;cluster:string|undefined}){return start.generation===current.generation&&start.wallet===current.wallet&&start.cluster===current.cluster;}

/** Only explicit authentication/context rejection clears private UI, not transient service failures. */
export function rejectsPrivateSession(status:number,code:unknown){return status===401&&code==='AUTH_REQUIRED'||status===403&&['WALLET_SESSION_MISMATCH','VERIFIED_SOLANA_IDENTITY_REQUIRED','WALLET_CONTEXT_REQUIRED'].includes(String(code));}
