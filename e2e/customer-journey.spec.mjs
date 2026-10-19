import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import jsQR from 'jsqr';

// One bounded customer journey repeated at desktop and exact 360px emulation.
// All app data is DEMO; only the catalog outage is intentionally fault-injected.
test('DEMO creation, poster, denied trades and external inspection recovery', async ({ page, context }, info) => {
  const consoleErrors = [], pageErrors = [], failedResponses = [], unexpectedNetwork = [];
  let injectCatalogOutage = false;
  const expectedError = (url, status) =>
    (url.endsWith('/api/trades/quote') && status === 403) ||
    (url.endsWith('/api/discovery') && status === 503) ||
    (url.endsWith('/api/tokens/not-a-mint/inspection') && status === 400);
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push({ text: msg.text(), location: msg.location() });
  });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('response', res => {
    if (res.status() >= 400) failedResponses.push({ url: res.url(), status: res.status(), expected: expectedError(res.url(), res.status()) });
  });
  // No outside browser traffic, extensions, accounts or wallet providers.
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:3110') {
      unexpectedNetwork.push(url.origin + url.pathname);
      return route.abort('blockedbyclient');
    }
    if (injectCatalogOutage && url.pathname === '/api/discovery') {
      injectCatalogOutage = false;
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'QA_CATALOG_OUTAGE', message: 'Synthetic outage for UI recovery acceptance' } }) });
    }
    return route.continue();
  });
  async function capture(name) {
    const metrics = await page.evaluate(() => ({ viewport: innerWidth, client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    await info.attach(`${name}-viewport`, { body: JSON.stringify(metrics), contentType: 'application/json' });
    await info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    expect(metrics.viewport).toBe(info.project.use.viewport.width);
    expect(metrics.scroll, `${name}: horizontal page overflow`).toBeLessThanOrEqual(metrics.client + 1);
  }
  try {
    await page.goto('/');
    await expect(page.getByText('Demo playground. Sample data, no real transactions.')).toBeVisible();
    await capture('01-home');
    await page.getByLabel('Token name', { exact: true }).fill('Synthetic QA Orbit');
    await page.getByLabel('Symbol', { exact: true }).fill('QATEST');
    await page.getByRole('button', { name: 'Start creating' }).click();
    await expect(page).toHaveURL(/\/launch$/);
    const name = page.getByPlaceholder('e.g. Orbit Club');
    const symbol = page.getByPlaceholder('ORBIT', { exact: true });
    await expect(name).toHaveValue('Synthetic QA Orbit');
    await page.reload();
    await expect(name).toHaveValue('Synthetic QA Orbit');
    await symbol.fill('');
    await expect(page.getByRole('button', { name: 'Review launch' })).toBeDisabled();
    await symbol.fill('QATEST');
    await name.fill('星'.repeat(15));
    await expect(page.getByText('Name must fit 32 UTF-8 bytes', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review launch' })).toBeDisabled();
    await name.fill('Synthetic QA Orbit');
    const upload = page.locator('input[type=file]');
    await upload.setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('synthetic invalid artwork') });
    await expect(page.getByText('Choose a PNG, JPG, or WebP image smaller than 2 MB.')).toBeVisible();
    await upload.setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: await sharp({ create: { width: 32, height: 32, channels: 4, background: '#5be6cc' } }).png().toBuffer() });
    await expect(page.getByAltText('Token artwork preview')).toBeVisible();
    await expect(page.getByText('Choose a PNG, JPG, or WebP image smaller than 2 MB.')).toHaveCount(0);
    await expect(name).toHaveValue('Synthetic QA Orbit');
    await capture('02-form-recovered');
    await page.getByRole('button', { name: 'Review launch' }).click();
    await expect(page.getByText('This walkthrough is isolated from real funds.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Experience the demo' }).click();
    await expect(page.getByText('No token was created, no transaction was built', { exact: false })).toBeVisible();
    await capture('03-demo-result');
    await page.getByRole('link', { name: 'Explore sample launch' }).click();
    await expect(page).toHaveURL(/\/token\/demo-orbit$/);
    await page.getByLabel('Trade amount').fill('-1');
    await expect(page.getByRole('button', { name: 'Get a verified quote' })).toBeDisabled();
    await page.getByLabel('Trade amount').fill('0.1');
    for (const side of ['Buy', 'Sell']) {
      await page.getByRole('button', { name: new RegExp('^' + side + ' ') }).click();
      await page.getByRole('button', { name: 'Get a verified quote' }).click();
      await expect(page.getByText('DEMO_NO_REAL_TRANSACTIONS', { exact: false })).toBeVisible();
      await expect(page.getByLabel('Trade amount')).toHaveValue('0.1');
      await expect(page.getByRole('button', { name: 'Get a verified quote' })).toBeEnabled();
    }
    await capture('04-trade-denied');
    await page.getByRole('button', { name: 'Share launch' }).click();
    await expect(page.getByRole('dialog', { name: 'Share launch poster' })).toBeVisible();
    await expect(page.getByAltText(/launch poster with DEMO watermark/)).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PNG' }).click();
    const download = await downloadPromise;
    expect(await download.failure()).toBeNull();
    const poster = await readFile(await download.path());
    const metadata = await sharp(poster).metadata();
    expect([metadata.width, metadata.height]).toEqual([1080, 1350]);
    const { data, info: pixels } = await sharp(poster).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const qr = jsQR(new Uint8ClampedArray(data), pixels.width, pixels.height);
    expect(qr?.data).toBe('http://127.0.0.1:3110/token/demo-orbit');
    await info.attach('downloaded-demo-poster', { body: poster, contentType: 'image/png' });
    await capture('05-poster');
    await page.getByRole('button', { name: 'Close poster' }).click();
    await page.getByRole('link', { name: 'Graduation details' }).click();
    await expect(page.getByText('Reaching a target is not the same as completing migration.')).toBeVisible();
    await capture('06-graduation');
    await page.getByRole('link', { name: 'StonkLaunch home' }).click();
    injectCatalogOutage = true;
    await page.getByRole('button', { name: 'External discovery' }).click();
    await expect(page.getByText('QA_CATALOG_OUTAGE', { exact: false })).toBeVisible();
    await capture('07-injected-catalog-outage');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('.external-row')).toHaveCount(3);
    await page.getByLabel('Search external discovery').fill('no-synthetic-match');
    await expect(page.getByRole('heading', { name: 'No matching catalog entries' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page.locator('.external-row')).toHaveCount(3);
    await page.getByLabel('Inspect a token mint').fill('not-a-mint');
    await page.getByRole('button', { name: 'Inspect costs', exact: true }).click();
    await expect(page.getByText('DEMO_INSPECTION_ONLY', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Close token inspection' }).click();
    await page.locator('.external-row').first().getByRole('button', { name: /^Inspect costs for/ }).click();
    await expect(page.getByRole('heading', { name: 'Transfer costs, not promises.' })).toBeVisible();
    await expect(page.getByText('3.00% per transfer', { exact: true })).toBeVisible();
    await expect(page.getByText('Unknown', { exact: true })).toBeVisible();
    await expect(page.getByText('DEMO · Synthetic mint configuration.', { exact: false })).toBeVisible();
    await page.getByText('Authorities and snapshot evidence', { exact: true }).click();
    await expect(page.getByTitle('synthetic-demo-fee-authority', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Refresh inspection' }).click();
    await expect(page.getByText('3.00% per transfer', { exact: true })).toBeVisible();
    await capture('08-inspection-recovered');
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Terminal' }).click();
    await page.getByRole('button', { name: 'My launches' }).click();
    await expect(page.getByRole('heading', { name: 'Your launches live here' })).toBeVisible();
    await page.getByRole('button', { name: 'Fee management' }).click();
    await expect(page.getByRole('heading', { name: 'No verified fees to show' })).toBeVisible();
    await expect(page.getByText('DEMO_NO_REAL_REVENUE', { exact: false })).toBeVisible();
    await capture('09-terminal-fees');
    await page.getByRole('link', { name: 'Source & licenses', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Source & licenses', exact: true })).toBeVisible();
    const sourceDownloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download corresponding source', exact: true }).click();
    const sourceDownload = await sourceDownloadPromise;
    const sourceBytes = await readFile(await sourceDownload.path());
    expect([...sourceBytes.subarray(0, 2)]).toEqual([31, 139]);
    const checksumResponse = await page.request.get('/source/SHA256SUMS.txt');
    expect(checksumResponse.status()).toBe(200);
    const expectedHash = (await checksumResponse.text()).trim().split(/\s+/)[0];
    expect(createHash('sha256').update(sourceBytes).digest('hex')).toBe(expectedHash);
    const licenseResponse = await page.request.get('/source/LICENSE.txt');
    expect(licenseResponse.status()).toBe(200);
    expect(await licenseResponse.text()).toContain('GNU GENERAL PUBLIC LICENSE');
    await capture('10-source-license');
    expect(pageErrors).toEqual([]);
    expect(unexpectedNetwork).toEqual([]);
    expect(failedResponses.filter(item => !item.expected)).toEqual([]);
    // Only expected API-denial and injected outage resource errors are tolerated.
    const unexpectedConsole = consoleErrors.filter(item => !failedResponses.some(res => res.expected && item.location.url === res.url && item.text.includes(String(res.status))));
    expect(unexpectedConsole).toEqual([]);
  } finally {
    await info.attach('browser-diagnostics', { body: JSON.stringify({ scope: 'DEMO only; catalog outage intentionally injected; no mainnet or wallet claim', consoleErrors, pageErrors, failedResponses, unexpectedNetwork }, null, 2), contentType: 'application/json' });
  }
});

// Mocked off-chain journey only: no keys, signatures, Auth accounts, Storage or RPC.
test('readonly private drafts isolate changed wallets and clear expired sessions', async ({ page, context }, info) => {
  const origin = 'http://127.0.0.1:3110';
  const walletA = '11111111111111111111111111111111';
  const walletB = 'So11111111111111111111111111111111111111112';
  let account = walletA, signedIn = true, rejectSession = false, failRead = false;
  let saved = [], writes = 0, financialRequests = 0, holdNextRead = false;
  let releaseRead, readStarted, readFinished;
  const pageErrors = [], outsideRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(({ walletA }) => {
    const listeners = {};
    window.solana = {
      publicKey: { toBase58: () => walletA, toString: () => walletA },
      connect: async () => ({ publicKey: window.solana.publicKey }),
      on: (event, listener) => (listeners[event] ||= []).push(listener),
      removeListener: (event, listener) => { listeners[event] = (listeners[event] || []).filter(item => item !== listener); },
    };
    // This fixture has neither signMessage nor signTransaction. Session verification is mocked separately.
    window.changeDraftFixtureWallet = wallet => {
      window.solana.publicKey = { toBase58: () => wallet, toString: () => wallet };
      (listeners.accountChanged || []).forEach(listener => listener());
    };
  }, { walletA });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { outsideRequests.push(url.origin + url.pathname); return route.abort('blockedbyclient'); }
    const data = value => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: value }) });
    const error = (status, code) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { code, message: `Fixture ${code}` } }) });
    if (url.pathname === '/api/runtime') return data({ mode: 'mainnet-readonly', cluster: 'mainnet-beta', origin, platformId: null, platformAdmin: null, walletEnabled: false, authConfigured: true, storageConfigured: true, actionsEnabled: false, feePolicy: { platformBps: 50, creatorBps: 50, shareBps: 0 }, blockers: ['READ_ONLY_MODE'] });
    if (url.pathname === '/api/auth/session') return data({ session: signedIn ? { userId: account === walletA ? 'fixture-user-a' : 'fixture-user-b', wallet: account } : null });
    if (url.pathname === '/api/auth/logout') { signedIn = false; return data({ signedOut: true }); }
    if (url.pathname === '/api/drafts') {
      if (rejectSession) return error(401, 'AUTH_REQUIRED');
      if (request.method() === 'POST') {
        expect(request.headers()['x-wallet-address']).toBe(account);
        const body = request.postDataJSON();
        saved = [{ draft_id: body.draftId, parameters: body, confirmed_signature: null, updated_at: '2026-10-19T00:00:00Z' }];
        writes++;
        return data({ draftId: body.draftId, saved: true });
      }
      if (failRead) { failRead = false; return error(503, 'DRAFT_READ_FAILED'); }
      const items = account === walletA ? saved : [];
      if (holdNextRead) {
        holdNextRead = false;
        readStarted();
        await new Promise(resolve => { releaseRead = resolve; });
        await data({ items });
        readFinished();
        return;
      }
      return data({ items });
    }
    if (url.pathname.includes('/prepare') || url.pathname.includes('/actions/')) financialRequests++;
    return route.continue();
  });
  async function connect() {
    await page.locator('.workflow-page').getByRole('button', { name: 'Connect wallet', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Connect Solana wallet', exact: true }).click();
    await expect(page.getByLabel('Private draft name')).toBeVisible();
  }
  async function capture(name) {
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(dimensions.viewport).toBe(info.project.use.viewport.width);
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
    await info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  }
  await page.goto('/drafts');
  await connect();
  await page.getByLabel('Private draft name').fill('Fixture A private draft');
  await page.getByLabel('Private draft symbol').fill('FIXA');
  await page.getByLabel('Private draft description').fill('Non-sensitive mock text only.');
  await page.getByRole('button', { name: 'Save private draft', exact: true }).click();
  await expect(page.getByText('Private draft saved to the server.')).toBeVisible();
  expect(writes).toBe(1);
  await page.getByRole('button', { name: 'New draft', exact: true }).click();
  await page.getByRole('button', { name: 'Open draft', exact: true }).click();
  await expect(page.getByLabel('Private draft name')).toHaveValue('Fixture A private draft');
  await capture('private-draft-fixture-a');
  failRead = true;
  await page.getByRole('button', { name: 'Reload private drafts', exact: true }).click();
  await expect(page.getByText('Fixture DRAFT_READ_FAILED', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Private draft name')).toHaveValue('Fixture A private draft');
  const started = new Promise(resolve => { readStarted = resolve; });
  const finished = new Promise(resolve => { readFinished = resolve; });
  holdNextRead = true;
  await page.getByRole('button', { name: 'Reload private drafts', exact: true }).click();
  await started;
  account = walletB;
  await page.evaluate(wallet => window.changeDraftFixtureWallet(wallet), walletB);
  await expect(page.getByLabel('Private draft name')).toHaveCount(0);
  releaseRead();
  await finished;
  await connect();
  await expect(page.getByLabel('Private draft name')).toHaveValue('');
  await expect(page.getByText('No private drafts for this wallet and network.')).toBeVisible();
  await expect(page.getByText('Fixture A private draft', { exact: false })).toHaveCount(0);
  await capture('private-draft-fixture-b-isolated');
  rejectSession = true;
  await page.getByRole('button', { name: 'Reload private drafts', exact: true }).click();
  await expect(page.getByText('Fixture AUTH_REQUIRED', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Private draft name')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Saved on the server' })).toHaveCount(0);
  rejectSession = false;
  await page.getByRole('button', { name: 'Sign in with wallet', exact: true }).click();
  await expect(page.getByLabel('Private draft name')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Private draft name')).toHaveCount(0);
  expect(financialRequests).toBe(0);
  expect(pageErrors).toEqual([]);
  expect(outsideRequests).toEqual([]);
  await info.attach('private-draft-mock-scope', { body: JSON.stringify({ scope: 'Mock API/session/provider only; not actual wallet login, Supabase or Storage evidence', writes, financialRequests, pageErrors, outsideRequests }), contentType: 'application/json' });
});
