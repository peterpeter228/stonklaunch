export default function SourcePage() {
  return <section style={{maxWidth:880,margin:'0 auto',padding:'56px 0 72px'}}>
    <p className="eyebrow">OPEN SOURCE · GPLv3</p>
    <h1 style={{fontSize:'clamp(30px,5vw,48px)',lineHeight:1.1,margin:'16px 0 24px'}}>Source &amp; licenses</h1>
    <p style={{color:'#a7b7c9',lineHeight:1.8}}>Download the corresponding source for this application at no additional charge. You may study, modify and redistribute the covered application under GPLv3. Third-party components retain their respective licenses.</p>
    <div style={{display:'flex',flexWrap:'wrap',gap:12,margin:'28px 0'}}>
      <a className="button primary" href="/source/stonklaunch-source.tar.gz" download>Download corresponding source</a>
      <a className="button" href="/source/LICENSE.txt">GPLv3 license</a>
      <a className="button" href="/source/SHA256SUMS.txt">Verify download checksum</a>
    </div>
    <p style={{color:'#a7b7c9',lineHeight:1.8}}>The archive includes editable application code, build instructions, pinned Raydium and rpc-websockets source material, dependency notices and a file-hash manifest. Credentials, private records and repository history are not part of the download.</p>
    <p style={{color:'#8193ac',lineHeight:1.8,marginTop:24}}>This software is provided without warranty. Source availability does not constitute a security audit, a promise of returns, or approval to use unverified assets. Review every wallet transaction independently.</p>
  </section>;
}
