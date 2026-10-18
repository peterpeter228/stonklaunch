'use client';
import Link from 'next/link';
import {ExternalDiscovery} from './external-discovery';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowUpRight, Zap, Search, SlidersHorizontal, ShieldCheck } from 'lucide-react';
import type { Launch, AssetCapability } from '@/types/domain';
import { useApi, usePlatform, LaunchList, AssetSelector, Loading, ErrorState } from './platform';
export function Discover() {
    const router = useRouter();
    const { runtime } = usePlatform();
    const launches = useApi<{
        items: Launch[];
        coverage: string;
    }>('/api/launches');
    const assets = useApi<{
        items: AssetCapability[];
    }>('/api/assets');
    const [scope, setScope] = useState('own');
    const [sort, setSort] = useState('latest');
    const [search, setSearch] = useState('');
    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');
    const [asset, setAsset] = useState('SOL');
    const items = useMemo(() => [...(launches.data?.items || [])].filter(l => (l.name + ' ' + l.symbol).toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === 'progress' ? b.progress - a.progress : sort === 'volume' ? Number(BigInt(b.volumeRaw || '0') - BigInt(a.volumeRaw || '0')) : Date.parse(b.createdAt) - Date.parse(a.createdAt)), [launches.data, search, sort]);
    function start() { let existing = {}; try {
        existing = JSON.parse(localStorage.getItem('stonklaunch-public-draft') || '{}');
    }
    catch { } localStorage.setItem('stonklaunch-public-draft', JSON.stringify({ ...existing, ...(name ? { name } : {}), ...(symbol ? { symbol } : {}), assetKey: asset })); router.push('/launch'); }
    return <div className="page discover-page"><section className="hero"><div className="hero-copy"><h1>Big ideas.<br /><span>On-chain beginnings.</span></h1><p>Your idea, your community, your token.<br />Create on Solana. Trade on the curve. Build what comes next.</p><Link href="/launch" className="button primary hero-cta">Create a token <ArrowUpRight size={20}/></Link><div className="hero-note"><ShieldCheck size={15}/>Transparent fees. Non-custodial by design.</div></div><div className="orbit-art" aria-hidden="true"><div className="orbit-grid"/>{[1, 2, 3, 4, 5, 6].map(n => <div className={'orbital orbital-' + n} key={n}/>)}<div className="orbit-core"><ArrowUpRight size={85} strokeWidth={1.3}/></div><i className="planet planet-one"/><i className="planet planet-two"/><i className="planet planet-three"/><span className="art-caption">A NEW ORBIT STARTS HERE</span></div></section><form className="quick-launch" onSubmit={e => { e.preventDefault(); start(); }}><div className="quick-title"><span className="outline-icon"><Zap size={23}/></span><span><strong>Make your first move.</strong><small>Start with a name. Make it yours.</small></span></div><label>Token name<input value={name} onChange={e => setName(e.target.value)} placeholder="Your next big idea" maxLength={32}/></label><label>Symbol<input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="e.g. ORBIT" maxLength={10}/></label><button type="submit" className="button primary">Start creating <ArrowRight size={17}/></button></form><section className="discover-section"><div className="section-header"><div><h2>Discover launches<span className="count">{launches.data?.items.length ?? '—'}</span></h2><p>{runtime?.mode === 'demo' ? 'A look at what’s possible. All launches below are sample data.' : 'Launches observed by StonkLaunch. No fabricated activity.'}</p></div><Link href="/terminal" className="text-link muted">Open terminal <ArrowUpRight size={16}/></Link></div><div className="discovery-scope" role="group" aria-label="Discovery scope"><button className={scope==='own'?'active':''} onClick={()=>setScope('own')}>StonkLaunch</button><button className={scope==='external'?'active':''} onClick={()=>setScope('external')}>External discovery <span>READ-ONLY</span></button></div>{scope==='external'?<ExternalDiscovery/>:<><div className="list-toolbar"><div className="tabs">{[['latest', 'Latest'], ['progress', 'Near graduation'], ['volume', 'Volume']].map(([v, label]) => <button key={v} className={sort === v ? 'active' : ''} onClick={() => setSort(v)}>{label}</button>)}</div><div className="search-field"><Search size={16}/><input aria-label="Search launches" placeholder="Search tokens" value={search} onChange={e => setSearch(e.target.value)}/><SlidersHorizontal size={15}/></div></div>{launches.loading ? <Loading /> : launches.error ? <ErrorState error={launches.error} retry={launches.refresh}/> : <LaunchList items={items}/>}</>}</section><section className="quote-section"><div><h3>Choose your starting point.</h3><p>Quote assets set the trading pair, not a price guarantee.</p></div>{assets.data ? <AssetSelector assets={assets.data.items} value={asset} onChange={setAsset}/> : <span className="muted">Checking asset capabilities…</span>}</section><div className="bottom-note"><span><span className="status-dot"/>{runtime?.mode === 'demo' ? 'Isolated demo environment' : 'Network-verified capabilities'}</span><span>Tokenized assets do not imply collateral, ownership, or redemption rights.</span></div></div>;
}
