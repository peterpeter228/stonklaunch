'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ArrowUpRight, ArrowRight, Wallet, X, Orbit, ShieldCheck, Info, RefreshCw, Check, Copy } from 'lucide-react';
import type { RuntimeConfig, AssetCapability, Launch, ApiEnvelope } from '@/types/domain';
export async function api<T>(url: string, body?: unknown): Promise<T> { const res = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-wallet-address': typeof window==='undefined'?'':((window as unknown as {solana?:{publicKey?:{toBase58:()=>string}}}).solana?.publicKey?.toBase58()||'') }, body: JSON.stringify(body) } : { cache: 'no-store' }); const result = await res.json() as ApiEnvelope<T>; if ('error' in result)
    throw new Error(`${result.error.message} (${result.error.code})`); if (!res.ok)
    throw new Error('The service is unavailable. Your inputs are safe.'); return result.data; }
export function useApi<T>(url: string) { const [data, setData] = useState<T | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [revision, setRevision] = useState(0); useEffect(() => { let active = true; setLoading(true); api<T>(url).then(d => { if (active) {
    setData(d);
    setError('');
} }).catch(e => { if (active)
    setError(e.message); }).finally(() => { if (active)
    setLoading(false); }); return () => { active = false; }; }, [url, revision]); return { data, error, loading, refresh: () => setRevision(v => v + 1) }; }
type Provider = {
    publicKey?: {
        toString: () => string;
    };
    connect: () => Promise<{
        publicKey: {
            toString: () => string;
        };
    }>;
    disconnect?: () => Promise<void>;
};
type Platform = {
    runtime: RuntimeConfig | null;
    wallet: string | null;
    connect: () => void;
    notify: (text: string) => void;
};
const Context = createContext<Platform>({ runtime: null, wallet: null, connect: () => { }, notify: () => { } });
export const usePlatform = () => useContext(Context);
export function Shell({ children }: {
    children: ReactNode;
}) {
    const path = usePathname();
    const { data: runtime, error } = useApi<RuntimeConfig>('/api/runtime');
    const [wallet, setWallet] = useState<string | null>(null);
    const [modal, setModal] = useState(false);
    const [toast, setToast] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [walletError, setWalletError] = useState('');
    const notify = (text: string) => setToast(text);
    useEffect(() => { if (toast) {
        const t = setTimeout(() => setToast(''), 6000);
        return () => clearTimeout(t);
    } }, [toast]);
    async function connectWallet() { if (!runtime || runtime.mode === 'demo') {
        setWalletError('Demo uses no real wallet and never requests a signature. You can explore every page without connecting.');
        return;
    } const provider = (window as unknown as {
        solana?: Provider;
    }).solana; if (!provider) {
        setWalletError('No Solana wallet detected. Open this app in your wallet browser or install a trusted Solana wallet.');
        return;
    } try {
        setConnecting(true);
        const result = await provider.connect();
        setWallet(result.publicKey.toString());
        setModal(false);
    }
    catch {
        setWalletError('Connection was cancelled. Nothing was signed or sent.');
    }
    finally {
        setConnecting(false);
    } }
    return <Context.Provider value={{ runtime, wallet, connect: () => setModal(true), notify }}><div className="app-shell"><header className="topbar"><Link href="/" className="brand" aria-label="StonkLaunch home"><span className="brand-icon"><Orbit size={25}/></span><span>Stonk<span>Launch</span></span></Link><nav aria-label="Main navigation">{[['/', 'Discover'], ['/launch', 'Create'], ['/terminal', 'Terminal']].map(([href, label]) => <Link key={href} href={href} className={(path === href ? 'active' : '')}>{label}</Link>)}</nav><div className="header-actions"><span className={'network-badge ' + (runtime?.mode === 'demo' ? 'demo' : '')}><span />{runtime ? runtime.mode === 'demo' ? 'DEMO' : runtime.cluster : 'Connecting'}</span><button className="button wallet-button" aria-label="Connect Solana wallet" onClick={() => setModal(true)}><Wallet size={16}/><span>{wallet ? short(wallet) : 'Connect wallet'}</span></button></div></header><div className="mode-bar"><span><span className="status-dot"/>{runtime?.mode === 'demo' ? 'Demo playground. Sample data, no real transactions.' : runtime?.mode === 'mainnet-readonly' ? 'Mainnet · Read-only. Financial actions are disabled.' : runtime ? 'On-chain data · Verify every transaction in your wallet.' : error ? 'Data connection unavailable. No financial actions are enabled.' : 'Checking network and platform configuration…'}</span><span className="mode-right">Built on Solana <ArrowUpRight size={12}/></span></div><main>{children}</main><footer><Link href="/" className="footer-brand">StonkLaunch</Link><span>Ideas become communities. Transactions stay yours.</span><span><Link href="/source">Source &amp; licenses</Link></span></footer></div>{toast && <div className="toast" role="status"><Info size={18}/>{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={16}/></button></div>}{modal && <div className="modal-backdrop" onClick={() => setModal(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="wallet-title" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setModal(false)} aria-label="Close wallet dialog"><X /></button><div className="large-icon"><Wallet /></div><h2 id="wallet-title">Your wallet. Your control.</h2><p>Connect a Solana wallet to prepare transactions. Connecting does not sign a transaction or grant administrator access.</p>{runtime?.mode === 'demo' ? <Notice>Demo mode never connects a funds workflow. Explore with sample tokens, or configure a verified network to use your wallet.</Notice> : <button className="button primary full" onClick={connectWallet} disabled={connecting}>{connecting ? 'Connecting…' : wallet ? 'Reconnect wallet' : 'Connect Solana wallet'}<ArrowRight size={17}/></button>}{wallet && <p className="address">{wallet}</p>}{walletError && <Notice tone="warning">{walletError}</Notice>}<div className="fine-print"><ShieldCheck size={16}/> We never ask for a seed phrase or private key.</div></section></div>}</Context.Provider>;
}
export function Notice({ children, tone = 'info' }: {
    children: ReactNode;
    tone?: 'info' | 'warning' | 'success';
}) { return <div className={'notice ' + tone}><Info size={17}/><div>{children}</div></div>; }
export function Loading() { return <div className="loading-state"><RefreshCw className="spin" size={22}/><span>Reading platform data…</span></div>; }
export function ErrorState({ error, retry }: {
    error: string;
    retry?: () => void;
}) { return <div className="empty-state"><Info size={30}/><h3>We couldn’t verify this data</h3><p>{error}</p>{retry && <button className="button" onClick={retry}><RefreshCw size={15}/>Try again</button>}</div>; }
export function Empty({ title = 'Nothing here yet', text = 'New launches will appear here once they have been indexed.' }: {
    title?: string;
    text?: string;
}) { return <div className="empty-state"><Orbit size={32}/><h3>{title}</h3><p>{text}</p><Link href="/launch" className="text-link">Start your own launch <ArrowRight size={15}/></Link></div>; }
export function short(s: string) { return s.length > 15 ? `${s.slice(0, 6)}…${s.slice(-5)}` : s; }
export function rawFormat(raw: string | null, decimals = 9) { if (raw === null)
    return '—'; try {
    const n = BigInt(raw);
    const den = 10n ** BigInt(decimals);
    const whole = n / den;
    const fraction = (n % den).toString().padStart(decimals, '0').slice(0, 4).replace(/0+$/, '');
    return whole.toLocaleString() + (fraction ? '.' + fraction : '');
}
catch {
    return '—';
} }
export function TokenAvatar({ name, index = 0, large = false }: {
    name: string;
    index?: number;
    large?: boolean;
}) { return <div className={'token-avatar avatar-' + (index % 4) + (large ? ' large' : '')}><span>{name.slice(0, 2).toUpperCase()}</span><Orbit size={large ? 60 : 36}/></div>; }
export function Progress({ value }: {
    value: number;
}) { return <div className="progress-track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${Math.min(100, Math.max(0, value))}%` }}/></div>; }
export function CopyAddress({ value, label = 'Address' }: {
    value: string;
    label?: string;
}) { const [copied, setCopied] = useState(false); return <button className="copy-address" title={value} onClick={async () => { try {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
}
catch {
    setCopied(false);
} }}>{label}: {short(value)}{copied ? <Check size={13}/> : <Copy size={13}/>}</button>; }
export function AssetSelector({ assets, value, onChange }: {
    assets: AssetCapability[];
    value: string;
    onChange: (key: string) => void;
}) { const { runtime, notify } = usePlatform(); return <div className="asset-options">{assets.map((asset, index) => { const allowed = asset.canCreate || runtime?.mode === 'demo' && asset.symbol === 'SOL'; return <button key={asset.assetKey} type="button" className={'asset-option ' + (value === asset.assetKey ? 'selected' : '')} aria-disabled={!allowed} onClick={() => allowed ? onChange(asset.assetKey) : notify(asset.reasonCodes.join(' · ') || 'This quote asset is awaiting protocol verification.')}><span className={'asset-mark mark-' + index}>{asset.symbol === 'SOL' ? <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h13l-3 3H2zm-3 6h13l3 3H5zm3 6h13l-3 3H2z" fill="currentColor"/></svg> : asset.symbol === 'USDC' ? '$' : <ArrowUpRight size={17}/>}</span><span><strong>{asset.symbol}</strong><small>{allowed ? runtime?.mode === 'demo' ? 'Demo available' : 'Verified quote' : 'Awaiting verification'}</small></span>{value === asset.assetKey ? <Check size={16}/> : !allowed ? <span className="soon">Not enabled</span> : null}</button>; })}</div>; }
export function LaunchList({ items }: {
    items: Launch[];
}) { if (!items.length)
    return <Empty />; return <div className="launch-list"><div className="list-labels"><span>Token / Quote</span><span>Curve progress</span><span>Indexed volume</span><span>Status</span><span /></div>{items.map((l, i) => <Link href={'/token/' + encodeURIComponent(l.mint)} className="launch-row" key={l.mint}><div className="token-cell"><TokenAvatar name={l.symbol} index={i}/><span><strong>{l.name}{l.cluster === 'demo' && <em>DEMO</em>}</strong><small>${l.symbol} <span className="dot-separator">·</span> {l.quoteSymbol}{l.createdAt && <span className="launch-created"> · {new Date(l.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}</small></span></div><div className="progress-cell"><div><span>{l.progress.toFixed(1)}%</span><small>{l.status === 2 && l.cpmmVerified ? 'CPMM verified' : l.status === 1 ? 'Migration pending' : l.status===2?'Verification pending':'Bonding curve'}</small></div><Progress value={l.progress}/></div><div className="volume-cell"><strong>{l.quoteDecimals===undefined?'—':rawFormat(l.volumeRaw,l.quoteDecimals)} <small>{l.quoteSymbol}</small></strong><small>{l.cluster === 'demo' ? 'Sample volume' : 'Indexed coverage only'}</small></div><div><span className={'pill ' + (l.status === 2 && l.cpmmVerified ? 'purple' : '')}>{l.status === 2 && l.cpmmVerified ? 'Graduated' : l.status === 1 ? 'Migrating' : l.status===2?'Verification pending':'On the curve'}</span></div><ArrowUpRight className="row-arrow" size={20}/></Link>)}</div>; }
