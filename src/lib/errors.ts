import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
export class AppError extends Error {
  constructor(public code:string, message:string, public status=400, public details?:unknown){super(message);this.name='AppError';}
}
export function success<T>(data:T,status=200){return NextResponse.json({data,requestId:randomUUID()},{status,headers:{'Cache-Control':'no-store'}});}
export function failure(error:unknown){
  const id=randomUUID();
  if(error instanceof ZodError)return NextResponse.json({error:{code:'INVALID_INPUT',message:'请求参数不符合要求',details:error.flatten()},requestId:id},{status:400});
  if(error instanceof AppError)return NextResponse.json({error:{code:error.code,message:error.message,details:error.details},requestId:id},{status:error.status});
  // SDK errors may include RPC URLs or provider tokens. Do not echo arbitrary messages.
  const known=error as {code?:string;status?:number};
  if(known?.code && /^[A-Z_]{3,80}$/.test(known.code))return NextResponse.json({error:{code:known.code,message:'链上操作未完成，请检查配置与当前网络'},requestId:id},{status:known.status&&known.status>=400&&known.status<600?known.status:503});
  console.error('Request failed',id,error instanceof Error?error.name:'UnknownError');
  return NextResponse.json({error:{code:'SERVICE_UNAVAILABLE',message:'服务暂时不可用；没有提交或确认任何交易'},requestId:id},{status:503});
}
export async function api<T>(fn:()=>Promise<T>|T){try{return success(await fn());}catch(e){return failure(e);}}
export async function readBodyLimited(request:Request,limit:number){
 if(Number(request.headers.get('content-length')||0)>limit)throw new AppError('PAYLOAD_TOO_LARGE','请求过大',413);
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new AppError('PAYLOAD_TOO_LARGE','请求过大',413);}chunks.push(value);}
 const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}return body;
}
export async function readJson(request:Request){
 const text=new TextDecoder().decode(await readBodyLimited(request,32768));
 try{return JSON.parse(text);}catch{throw new AppError('INVALID_JSON','需要有效 JSON',400);}
}
