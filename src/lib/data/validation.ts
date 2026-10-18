import { z } from 'zod';
import { PublicKey } from '@solana/web3.js';
export const publicKey=z.string().refine(v=>{try{return new PublicKey(v).toBase58()===v;}catch{return false;}},'Invalid Solana public key');
export const amountRaw=z.string().regex(/^[1-9][0-9]{0,19}$/).refine(v=>BigInt(v)<=18446744073709551615n,'Amount exceeds u64');
export const tradeInput=z.object({poolId:publicKey,side:z.enum(['buy','sell']),amountRaw,slippageBps:z.number().int().min(0).max(1000).default(50)}).strict();
export const launchInput=z.object({name:z.string().trim().min(1).max(32),symbol:z.string().trim().regex(/^[A-Za-z0-9]{1,10}$/),description:z.string().trim().max(1000),assetKey:z.string().min(1).max(32),imageUrl:z.string().url().optional(),clientMintPublicKey:publicKey,initialBuyRaw:z.literal('0').optional()}).strict();
