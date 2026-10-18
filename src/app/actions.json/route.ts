import {createActionHeaders,type ActionsJson} from '@solana/actions';
export const GET=()=>Response.json({rules:[{pathPattern:'/api/actions/**',apiPath:'/api/actions/**'}]} satisfies ActionsJson,{headers:createActionHeaders()});
export const OPTIONS=()=>new Response(null,{status:204,headers:createActionHeaders()});
