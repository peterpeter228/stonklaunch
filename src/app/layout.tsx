import type {Metadata} from 'next';
import {Shell} from '@/components/platform';
import './globals.css';
export const metadata:Metadata={title:'StonkLaunch — On-chain beginnings',description:'Create, discover, and follow Solana token launches. Transparent fees. Non-custodial by design.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><Shell>{children}</Shell></body></html>;}
