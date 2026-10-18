import {api,readJson} from '@/lib/errors';import {requireFinancialMode} from '@/lib/runtime';import {tradeInput} from '@/lib/data/validation';import {quoteTrade} from '@/lib/raydium/service';
export const POST=(r:Request)=>api(async()=>{requireFinancialMode();return quoteTrade(tradeInput.parse(await readJson(r)));});
