'use client';
import {readRecovery,writeRecovery} from '@/lib/raydium/recovery';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, RefreshCw, ExternalLink } from 'lucide-react';
import type { LaunchDraft, TransactionPlan } from '@/types/domain';
import type { Keypair, Connection } from '@solana/web3.js';
import type { SigningWallet, TransactionStage } from '@/lib/raydium/client-transactions';
import { api, usePlatform, Notice, CopyAddress } from './platform';
type WalletProvider = SigningWallet & {
    signMessage?: (message: Uint8Array) => Promise<Uint8Array | {
        signature: Uint8Array;
    }>;
};
async function currentWallet(expected: string | null) { const p = (window as unknown as {
    solana?: WalletProvider;
}).solana; if (!p?.publicKey || !p.signTransaction || p.publicKey.toBase58() !== expected)
    throw new Error('Connect the same Solana wallet before continuing.'); const {PublicKey}=await import('@solana/web3.js'); return {publicKey:new PublicKey(p.publicKey.toBase58()),signTransaction:p.signTransaction.bind(p),signMessage:p.signMessage?.bind(p)}; }
async function authenticate(p: WalletProvider) { const session = await api<{
    session: {
        wallet: string;
    } | null;
}>('/api/auth/session'); if (session.session?.wallet === p.publicKey.toBase58())
    return; const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; if (!url || !key)
    throw new Error('Server authentication is not configured. Public browsing and your local draft remain available.'); if (!p.signMessage)
    throw new Error('This wallet does not support the required Solana login message.'); const { createBrowserClient } = await import('@supabase/ssr'); const client = createBrowserClient(url, key); const signingWallet = { publicKey: p.publicKey, signMessage: async (message: Uint8Array) => { const signed = await p.signMessage!(message); return signed instanceof Uint8Array ? signed : signed.signature; } }; const { error } = await client.auth.signInWithWeb3({ chain: 'solana', wallet: signingWallet, statement: 'Sign in to StonkLaunch only. This message does not transfer assets or authorize a transaction.' }); if (error)
    throw error; const verified = await api<{
    session: {
        wallet: string;
    } | null;
}>('/api/auth/session'); if (verified.session?.wallet !== p.publicKey.toBase58())
    throw new Error('The server has not verified this wallet session.'); }
export function TransactionControl({ draft, endpoint, input, onConfirmed }: {
    draft?: LaunchDraft;
    endpoint?: string;
    input?: Record<string, unknown>;
    onConfirmed?: () => void;
}) {
    const { runtime, wallet, connect } = usePlatform();
    const mint = useRef<Keypair | null>(null);
    const requestId = useRef<string | null>(null);
    const [authenticated, setAuthenticated] = useState(false);
    const [plan, setPlan] = useState<TransactionPlan | null>(null);
    const [stage, setStage] = useState<TransactionStage | 'idle'>('idle');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [signature, setSignature] = useState('');
    const [createdMint, setCreatedMint] = useState('');
    const [summaryOpen, setSummaryOpen] = useState(false);
    const pending = useRef(false);const epoch=useRef(0);
    const inputFingerprint=JSON.stringify(draft||input||{});
    useEffect(()=>{epoch.current++;setPlan(null);setSummaryOpen(false);setAuthenticated(false);mint.current=null;requestId.current=null;pending.current=false;setSignature('');setCreatedMint('');setStage('idle');
      try{const saved=runtime&&wallet?readRecovery('transaction',runtime.cluster,wallet):null;if(saved?.cluster===runtime?.cluster&&saved?.wallet===wallet&&['submitted','confirmation_unknown'].includes(saved.state||'')){pending.current=true;setSignature(saved.signature||'');setStage('confirmation_unknown');}}catch(e){pending.current=true;setStage('confirmation_unknown');setError(e instanceof Error?e.message:'Recovery record unavailable');}
    },[wallet,runtime?.cluster]);
    useEffect(()=>{epoch.current++;setPlan(null);setSummaryOpen(false);if(!pending.current)setStage('idle');},[inputFingerprint]);
    async function login() { const currentEpoch=epoch.current;setBusy(true); setError(''); try {
        const p = await currentWallet(wallet);
        await authenticate(p);
        if(currentEpoch===epoch.current)setAuthenticated(true);
    }
    catch (e) {
        if(currentEpoch!==epoch.current)return;
        setError(e instanceof Error ? e.message : 'Login was not completed.');
    }
    finally {
        setBusy(false);
    } }
    async function prepare() { const currentEpoch=epoch.current;if (!runtime || !['devnet', 'mainnet-live'].includes(runtime.mode) || !runtime.walletEnabled) {
        setError('Financial transactions are not enabled in this mode.');
        return;
    } setBusy(true); setError(''); setStage('validating'); try {
        const original = wallet?readRecovery('transaction',runtime.cluster,wallet):null;
        if (original) {
            const saved = original;
            if ((saved.state === 'submitted' || saved.state === 'confirmation_unknown') && saved.cluster===runtime.cluster && saved.wallet===wallet) {
                setSignature(saved.signature||'');
                pending.current = true;
                setStage('confirmation_unknown');
                throw new Error('A previous transaction has an unresolved outcome. Check the original signature before preparing another.');
            }
        }
        await currentWallet(wallet);
        const session = await api<{
            session: {
                wallet: string;
            } | null;
        }>('/api/auth/session');
        if (session.session?.wallet !== wallet) {
            setAuthenticated(false);
            throw new Error('Sign in again with the connected wallet before preparing.');
        }
        let response: TransactionPlan;
        if (draft) {
            const { createClientMint } = await import('@/lib/raydium/client-transactions');
            if (!mint.current)
                mint.current = createClientMint();
            if (!requestId.current)
                requestId.current = crypto.randomUUID();
            const res = await fetch('/api/launches/prepare', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestId.current, 'x-wallet-address': wallet || '' }, body: JSON.stringify({ ...draft, clientMintPublicKey: mint.current.publicKey.toBase58(), initialBuyRaw: '0' }) });
            const body = await res.json();
            if (body.error)
                throw new Error(body.error.message);
            response = body.data;
        }
        else {
            response = await api<TransactionPlan>(endpoint!, input);
        }
        if(currentEpoch!==epoch.current)return;
        if (response.blockers.length)
            throw new Error(response.blockers.join(' · '));
        setPlan(response);
        setStage('idle');
        setSummaryOpen(true);
    }
    catch (e) {
        if(currentEpoch!==epoch.current)return;
        setError(e instanceof Error ? e.message : 'Preparation failed. Inputs are preserved.');
        if (!pending.current)
            setStage('failed');
    }
    finally {
        setBusy(false);
    } }
    async function connection(): Promise<Connection> { const url = process.env.NEXT_PUBLIC_SOLANA_RPC_URL; if (!url)
        throw new Error('A browser-safe Solana RPC endpoint must be configured before signing.'); const { Connection } = await import('@solana/web3.js'); return new Connection(url, 'confirmed'); }
    async function sign() { const currentEpoch=epoch.current;if (!plan || !runtime || pending.current)
        return; setBusy(true); setError(''); try {
        if(!draft&&input){for(const k of ['poolId','side','quoteMint'])if(input[k]!==undefined&&plan.summary[k]!==input[k])throw new Error('Reviewed plan no longer matches the selected operation.');if(input.amountRaw!==undefined&&plan.summary.amountInRaw!==input.amountRaw)throw new Error('Reviewed amount no longer matches the input.');}
        const p = await currentWallet(wallet);
        const c = await connection();
        const helpers = await import('@/lib/raydium/client-transactions');
        const onStage = (s: TransactionStage, detail?: string) => { if(currentEpoch!==epoch.current)return; if(s==='failed')pending.current=false; setStage(s === 'confirmed' ? 'submitted' : s); if (['submitted', 'confirmed', 'confirmation_unknown'].includes(s) && detail) {
            setSignature(detail);
            pending.current = s !== 'confirmed';
        } };
        let sig: string;
        if (draft) {
            if (!mint.current)
                throw new Error('Mint signer is no longer available. Check the original mint before creating another.');
            const built = await helpers.buildClientLaunch(plan, mint.current, p, runtime, c);
            setCreatedMint(built.mint);
            const result = await helpers.signAndSubmitLaunch(built, p, runtime, c, onStage);
            sig = result.signatures[result.signatures.length - 1];
        }
        else {
            sig = await helpers.signAndSubmitPlan(plan, p, runtime, c, onStage);
        }
        if(currentEpoch!==epoch.current)return;setSignature(sig);
        await api('/api/transactions/observe', { signature: sig });
        if (draft) {
            await api('/api/launches/' + mint.current!.publicKey.toBase58());
        }
        setStage('confirmed');
        setPlan(null);
        onConfirmed?.();
    }
    catch (e) {
        if(currentEpoch!==epoch.current)return;
        setError(e instanceof Error ? e.message : 'The operation did not complete. Your draft is preserved.');
    }
    finally {
        setBusy(false);
    } }
    async function observe() { const currentEpoch=epoch.current;setBusy(true); try {
        const result = await api<Record<string, unknown>>('/api/transactions/observe', { signature });if(currentEpoch!==epoch.current)return;
        if (result.state === 'confirmed' || result.state === 'finalized') {
            pending.current = false;
            setStage('confirmed');
            setError('The original transaction is confirmed. Pool binding and balances must still be read before treating the economic operation as settled.');
            const saved = runtime&&wallet?readRecovery('transaction',runtime.cluster,wallet):null;
            if(saved)writeRecovery('transaction',{ ...saved, state: 'confirmed' });
            onConfirmed?.();
        }
        else if (result.state === 'failed') {
            pending.current = false;
            setStage('failed');
            setError('The original transaction failed on-chain. Review its error before preparing any new action.');
            const saved = runtime&&wallet?readRecovery('transaction',runtime.cluster,wallet):null;
            if(saved)writeRecovery('transaction',{ ...saved, state: 'failed' });
        }
        else {
            setError('The original transaction is still pending or unverified. Do not repeat the economic action.');
        }
    }
    catch (e) {
        if(currentEpoch!==epoch.current)return;
        setError(e instanceof Error ? e.message : 'Confirmation remains unknown.');
    }
    finally {
        setBusy(false);
    } }
    if (runtime?.mode === 'demo' || runtime?.mode === 'mainnet-readonly')
        return <Notice>{runtime.mode === 'demo' ? 'Demo never prepares or signs financial transactions.' : 'Mainnet read-only mode. Transaction preparation is disabled.'}</Notice>;
    return <div className="transaction-control">{!wallet ? <button className="button primary full" onClick={connect}>Connect wallet <ArrowRight size={16}/></button> : !authenticated ? <><Notice>Sign a login message to verify your identity. This is separate from transaction approval and does not move assets.</Notice><button className="button primary full" disabled={busy} onClick={login}>{busy ? 'Verifying session…' : 'Sign in with wallet'}</button></> : pending.current ? <button className="button full" disabled={busy} onClick={observe}><RefreshCw size={15}/>Check original transaction</button> : !plan ? <button className="button primary full" disabled={busy || stage === 'confirmed'} onClick={prepare}>{busy ? 'Checking chain and configuration…' : stage === 'confirmed' ? 'Confirmed' : 'Prepare and review transaction'}<ArrowRight size={16}/></button> : <><button className="button full" onClick={() => setSummaryOpen(!summaryOpen)}>Review exact transaction summary</button>{summaryOpen && <pre className="plan-preview">{JSON.stringify(plan.summary, null, 2)}</pre>}<Notice tone="warning">Review the complete summary, destination, fees, and network in your wallet. Plans can expire. No automatic re-submission.</Notice><button className="button primary full" disabled={busy} onClick={sign}>{busy ? 'Waiting for wallet / network…' : 'Review & sign in wallet'}<ArrowRight size={16}/></button></>}{stage !== 'idle' && <p className="transaction-stage" role="status">Status: {stage.replaceAll('_', ' ')}</p>}{signature && <div className="transaction-signature"><CopyAddress value={signature} label="Transaction"/><a className="text-link" target="_blank" rel="noreferrer" href={`https://explorer.solana.com/tx/${signature}${runtime?.cluster === 'devnet' ? '?cluster=devnet' : ''}`}>Explorer <ExternalLink size={13}/></a></div>}{createdMint && <CopyAddress value={createdMint} label="Original mint"/>}{stage === 'confirmed' && createdMint && <Link className="button full" href={'/token/' + createdMint}>View verified launch</Link>}{error && <Notice tone="warning">{error}</Notice>}</div>;
}

export function WalletLoginButton({onAuthenticated}:{onAuthenticated?:()=>void}){const {runtime,wallet,connect}=usePlatform();const [busy,setBusy]=useState(false);const [error,setError]=useState('');async function login(){setBusy(true);setError('');try{await authenticate(await currentWallet(wallet));onAuthenticated?.();}catch(e){setError(e instanceof Error?e.message:'Wallet authentication failed.');}finally{setBusy(false);}}if(runtime?.mode==='demo')return null;return <div className="wallet-auth-control"><Notice>Wallet connection alone does not authenticate fee ownership. A login message verifies your identity without moving assets.</Notice><button className="button" disabled={busy} onClick={()=>wallet?login():connect()}>{busy?'Verifying wallet session…':wallet?'Sign in to view your fees':'Connect wallet'}</button>{error&&<Notice tone="warning">{error}</Notice>}</div>;}
