import { PublicKey } from '@solana/web3.js';
import { getPdaMetadataKey, METADATA_PROGRAM_ID } from '@raydium-io/raydium-sdk-v2';
import { connection } from './chain';
// Bounded MetadataV1 identity prefix, based on official Metaplex state/metadata.rs.
// We intentionally do not fetch arbitrary off-chain URIs or decode mutable trailing rights.
export function decodeMetadataIdentity(data:Buffer,mint:PublicKey){
 if(data.length<77||data[0]!==4||!data.subarray(33,65).equals(mint.toBuffer()))throw Error('METADATA_IDENTITY_MISMATCH');
 let offset=65;const read=(max:number)=>{if(offset+4>data.length)throw Error('METADATA_TRUNCATED');const n=data.readUInt32LE(offset);offset+=4;if(n>max||offset+n>data.length)throw Error('METADATA_LENGTH');const value=new TextDecoder('utf-8',{fatal:true}).decode(data.subarray(offset,offset+n)).replace(/\0+$/,'').trim();offset+=n;return value;};
 return {name:read(32),symbol:read(10),uri:read(200)};
}
export async function readMetadataIdentity(mint:PublicKey){
 const address=getPdaMetadataKey(mint).publicKey;const result=await connection().getAccountInfoAndContext(address,'confirmed');
 if(!result.value||!result.value.owner.equals(METADATA_PROGRAM_ID))throw Error('METADATA_ACCOUNT_UNVERIFIED');
 return {...decodeMetadataIdentity(result.value.data,mint),slot:result.context.slot,address:address.toBase58()};
}
