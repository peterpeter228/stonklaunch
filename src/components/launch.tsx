'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ImagePlus, ShieldCheck, Save, RotateCcw, Download, ExternalLink } from 'lucide-react';
import type { AssetCapability, LaunchDraft, TransactionPlan } from '@/types/domain';
import { TransactionControl } from './transaction-control';
import { api, useApi, usePlatform, AssetSelector, TokenAvatar, Notice } from './platform';
const blank: LaunchDraft = { name: '', symbol: '', description: '', assetKey: 'SOL' };
export function LaunchPage() {
    const { runtime, wallet, connect, notify } = usePlatform();
    const assets = useApi<{
        items: AssetCapability[];
    }>('/api/assets');
    const [draft, setDraft] = useState<LaunchDraft>(blank);
    const [loaded, setLoaded] = useState(false);
    const [review, setReview] = useState(false);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    const [advanced, setAdvanced] = useState(false);
    const [image, setImage] = useState<string | null>(null);
    const [plan, setPlan] = useState<TransactionPlan | null>(null);
    useEffect(() => { try {
        const saved = JSON.parse(localStorage.getItem('stonklaunch-public-draft') || 'null');
        if (saved)
            setDraft({ ...blank, ...saved, assetKey: saved.assetKey === 'sol' ? 'SOL' : saved.assetKey });
    }
    catch { } setLoaded(true); }, []);
    useEffect(() => { if (loaded)
        localStorage.setItem('stonklaunch-public-draft', JSON.stringify(draft)); }, [draft, loaded]);
    function update(key: keyof LaunchDraft, value: string) { setDraft(d => ({ ...d, [key]: value })); setReview(false); setPlan(null); setError(''); setResult(''); }
    async function prepare() { setError(''); setBusy(true); try {
        if (runtime?.mode === 'demo') {
            setResult('Demo walkthrough complete. No token was created, no transaction was built, and no wallet signature was requested. Explore the sample launch to see trading, graduation, and its watermarked poster.');
            return;
        }
        const data = await api<TransactionPlan>('/api/launches/prepare', { ...draft, wallet });
        setPlan(data);
        if (data.blockers?.length)
            setError(data.blockers.join(' · '));
        else
            setResult('Preparation returned. Wallet signing is available only after the complete transaction and mint signer have been verified. No transaction has been sent.');
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Preparation failed. Your draft is saved.');
    }
    finally {
        setBusy(false);
    } }
    async function upload(file?: File) { if (!file)
        return; if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
        setError('Choose a PNG, JPG, or WebP image smaller than 2 MB.');
        return;
    } setError(''); if (image)
        URL.revokeObjectURL(image); setImage(URL.createObjectURL(file)); if (runtime?.mode === 'demo') {
        notify('Image preview only in demo. The file is not uploaded or saved to the draft.');
        return;
    } try {
        const body = new FormData();
        body.append('file', file);
        const response = await fetch('/api/uploads', { method: 'POST', body });
        const data = await response.json();
        if (!response.ok || data.error)
            throw new Error(data.error?.message || 'Upload unavailable.');
        update('imageUrl', data.data.url);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed.');
    } }
    const selected = assets.data?.items.find(a => a.assetKey === draft.assetKey);
    const canReview = !!draft.name.trim() && /^[a-zA-Z0-9]{1,10}$/.test(draft.symbol) && !!selected && (selected.canCreate || runtime?.mode === 'demo' && selected.symbol === 'SOL');
    return <div className="page workflow-page"><Link href="/" className="back-link"><ArrowLeft size={15}/>Back to discover</Link><div className="page-heading"><div><h1>Give your idea a <span>ticker.</span></h1><p>A few details. A transparent fee review. Your launch starts here.</p></div><span className="saved-label"><Save size={14}/>{loaded ? 'Public draft saved on this device' : 'Loading draft…'}</span></div><div className="workflow-grid"><section className="panel create-panel"><div className="step-bar"><span className={!review ? 'current' : 'complete'}><b>{review ? <Check size={13}/> : 1}</b>Make it yours</span><i /><span className={review ? 'current' : ''}><b>2</b>Review & create</span></div>{!review ? <><div className="form-section"><div className="section-number">01</div><div className="form-section-content"><h3>Choose a quote asset</h3><p>Your token will trade against this asset.</p><AssetSelector assets={assets.data?.items || []} value={draft.assetKey} onChange={v => update('assetKey', v)}/></div></div><div className="form-section"><div className="section-number">02</div><div className="form-section-content"><h3>Make it recognizable</h3><p>A name and a symbol your community can get behind.</p><div className="identity-form"><label className="image-upload">{image ? <img src={image} alt="Token artwork preview"/> : <><ImagePlus size={25}/><span>Add image</span><small>PNG / JPG / WebP · 2 MB</small></>}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => upload(e.target.files?.[0])}/></label><div className="identity-fields"><label>Token name <span>{draft.name.length}/32</span><input placeholder="e.g. Orbit Club" maxLength={32} value={draft.name} onChange={e => update('name', e.target.value)}/></label><label>Symbol <span>1–10 letters or numbers</span><div className="symbol-input"><span>$</span><input placeholder="ORBIT" value={draft.symbol} maxLength={10} onChange={e => update('symbol', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}/></div></label></div></div><label className="description-field">Description <span>Optional</span><textarea maxLength={500} placeholder="What are you building? Tell your community the story." rows={4} value={draft.description} onChange={e => update('description', e.target.value)}/></label></div></div><button className="advanced-toggle" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}>Advanced parameters <ChevronDown size={17}/></button>{advanced && <div className="advanced-content"><div className="detail-row"><span>Migration destination</span><strong>Raydium CPMM</strong></div><div className="detail-row"><span>Base token transfer tax</span><strong>Disabled</strong></div><div className="detail-row"><span>Initial purchase</span><strong>Off</strong></div><p>Supply and curve parameters are taken from the verified protocol configuration. No custom custody contracts.</p></div>}{error && <Notice tone="warning">{error}</Notice>}<div className="form-actions"><button className="button ghost" onClick={() => { setDraft(blank); setImage(null); notify('Public form draft cleared.'); }}><RotateCcw size={14}/>Reset draft</button><button className="button primary" disabled={!canReview} onClick={() => setReview(true)}>Review launch <ArrowRight size={17}/></button></div></> : <div className="review-content"><h2>One last look.</h2><p>Review the network, asset, and fees before any wallet interaction.</p><div className="review-details"><div className="detail-row"><span>Token</span><strong>{draft.name} (${draft.symbol})</strong></div><div className="detail-row"><span>Quote asset</span><strong>{selected?.symbol}</strong></div><div className="detail-row"><span>Network / mode</span><strong>{runtime?.cluster} / {runtime?.mode}</strong></div><div className="detail-row"><span>Connected wallet</span><strong className="break-word">{wallet || 'Not connected'}</strong></div><div className="detail-row"><span>Platform configuration</span><strong className="break-word">{runtime?.platformId || 'Not configured'}</strong></div><div className="detail-row"><span>Global configuration</span><strong className="break-word">{selected?.globalConfigId || 'Not verified'}</strong></div></div><FeeSummary />{runtime?.mode === 'demo' ? <Notice>This walkthrough is isolated from real funds. It will not create a token, ask for a wallet signature, or broadcast a transaction.</Notice> : <Notice tone="warning">{runtime?.blockers.join(' · ') || 'Network costs and the full transaction must be reviewed in your wallet before signing.'}</Notice>}<div className="form-actions"><button className="button ghost" onClick={() => { setReview(false); setResult(''); }}>Edit details</button><button className="button primary" style={{ display: runtime?.mode === 'demo' ? 'inline-flex' : 'none' }} disabled={busy || !runtime} onClick={() => runtime?.mode !== 'demo' && !wallet ? connect() : prepare()}>{busy ? 'Checking configuration…' : runtime?.mode === 'demo' ? 'Experience the demo' : !wallet ? 'Connect wallet' : 'Check creation readiness'}<ArrowRight size={17}/></button></div>{runtime?.mode !== 'demo' && <TransactionControl draft={draft}/>} {error && <Notice tone="warning">{error} Your public draft is preserved.</Notice>}{result && <div className="demo-result"><ShieldCheck size={25}/><h3>{runtime?.mode === 'demo' ? 'You’re ready to explore.' : 'Preparation status'}</h3><p>{result}</p>{runtime?.mode === 'demo' && <Link href="/token/demo-orbit" className="button primary">Explore sample launch <ArrowRight size={16}/></Link>}</div>}{plan && <pre className="plan-preview">{JSON.stringify(plan.summary, null, 2)}</pre>}</div>}</section><aside className="launch-aside"><div className="panel token-preview"><div className="preview-label">YOUR TOKEN, AT A GLANCE<span>PREVIEW</span></div><div className="preview-art">{image ? <img src={image} alt="Your token"/> : <TokenAvatar name={draft.symbol || 'SL'} large/>}<span className="preview-orbit"/></div><h2>{draft.name || 'Your next big idea'}</h2><p>${draft.symbol || 'TICKER'} <span> / {selected?.symbol || 'SOL'}</span></p><div className="preview-description">{draft.description || 'Every community starts somewhere. Make this one yours.'}</div><div className="preview-bottom"><span>LaunchLab curve</span><span>→ Raydium CPMM</span></div></div><div className="panel fee-card"><h3>Clear from the start.</h3><FeeSummary /><div className="fine-print"><ShieldCheck size={16}/>Your wallet signs. The protocol settles. We never custody your funds.</div></div></aside></div></div>;
}
export function FeeSummary() { const { runtime } = usePlatform(); return <div className="fee-summary"><div className="detail-row"><span>Platform trading fee <small>Target configuration</small></span><strong>{runtime ? (runtime.feePolicy.platformBps / 100).toFixed(2) + '%' : '—'}</strong></div><div className="detail-row"><span>Creator trading fee <small>Target configuration</small></span><strong>{runtime ? (runtime.feePolicy.creatorBps / 100).toFixed(2) + '%' : '—'}</strong></div><div className="detail-row"><span>Referral fee</span><strong>{runtime ? (runtime.feePolicy.shareBps / 100).toFixed(2) + '%' : '—'}</strong></div><div className="detail-row"><span>Protocol trading fee</span><strong>Read from chain</strong></div><div className="detail-row fee-total"><span>Network costs & rent</span><strong>At preparation</strong></div><p>Fees shown are not a quote or a total. Actual pool binding, protocol fees, and network costs are verified before signing.</p></div>; }
