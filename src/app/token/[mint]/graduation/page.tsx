import {GraduationPage} from '@/components/token';
export default async function Page({params}:{params:Promise<{mint:string}>}){const {mint}=await params;return <GraduationPage mint={mint}/>;}
