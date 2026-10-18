export const DEFAULT_PLATFORM_FEE_BPS = 50;
export const DEFAULT_CREATOR_FEE_BPS = 50;
export const DEFAULT_SHARE_FEE_BPS = 0;
export const LAUNCHLAB_RATE_DENOMINATOR = 1_000_000;
export type FeePolicy = {platformBps:number;creatorBps:number;shareBps:number};
function integer(value:string|undefined,fallback:number,name:string){
 if(value===undefined||value==='')return fallback;
 if(!/^\d+$/.test(value))throw new Error(`${name}: expected integer basis points`);
 const n=Number(value);if(!Number.isSafeInteger(n)||n>10000)throw new Error(`${name}: out of range`);return n;
}
export function loadFeePolicy(env:Record<string,string|undefined>=process.env):FeePolicy{
 const platformBps=integer(env.LAUNCHLAB_PLATFORM_FEE_BPS,50,'platform');
 const creatorBps=integer(env.LAUNCHLAB_CREATOR_FEE_BPS,50,'creator');
 const shareBps=integer(env.LAUNCHLAB_SHARE_FEE_BPS,0,'share');
 if(shareBps!==0)throw new Error('Referral fees are disabled');
 if(platformBps+creatorBps>=10000)throw new Error('Combined fees must be less than 100%');
 return {platformBps,creatorBps,shareBps};
}
export function bpsToLaunchlabRate(bps:number):bigint{
 if(!Number.isSafeInteger(bps)||bps<0||bps>10000)throw new Error('Invalid basis points');
 return BigInt(bps)*100n;
}
export type FeeBinding={platformId:string;platformAdmin:string;platformClaimFeeWallet:string;platformFeeRate:string;creatorFeeRate:string;shareFeeRate?:string;protocolFeeRate?:string;slot?:number};
export function assertFeeBinding(actual:FeeBinding,desired:Partial<FeeBinding>):void{
 for(const key of ['platformId','platformAdmin','platformClaimFeeWallet','platformFeeRate','creatorFeeRate','shareFeeRate'] as const){
  if(desired[key]!==undefined&&actual[key]!==desired[key])throw new Error(`CONFIG_MISMATCH: ${key}`);
 }
}
