export function parseRawAmount(value:string,decimals:number):bigint{
 if(!Number.isInteger(decimals)||decimals<0||decimals>18)throw new Error('Invalid decimals');
 if(!/^(0|[1-9]\d*)(\.\d+)?$/.test(value))throw new Error('Use a positive decimal number without exponent notation');
 const [whole,fraction='']=value.split('.');
 if(fraction.length>decimals)throw new Error(`Maximum ${decimals} decimal places`);
 const raw=BigInt(whole)*10n**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0')||'0');
 if(raw>18446744073709551615n)throw new Error('Amount exceeds protocol u64');return raw;
}
export function formatRawAmount(raw:string|bigint,decimals:number):string{
 if(!Number.isInteger(decimals)||decimals<0||decimals>18)throw new Error('Invalid decimals');
 const n=BigInt(raw);if(n<0n)throw new Error('Negative amount');if(decimals===0)return n.toString();
 const text=n.toString().padStart(decimals+1,'0');return `${text.slice(0,-decimals)}.${text.slice(-decimals)}`.replace(/\.?0+$/,'');
}
