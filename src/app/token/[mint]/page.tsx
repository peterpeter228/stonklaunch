import {TokenPage} from '@/components/token';
export default async function Page({params}:{params:Promise<{mint:string}>}){const {mint}=await params;return <TokenPage mint={mint}/>;}
