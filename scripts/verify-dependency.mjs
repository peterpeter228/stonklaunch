/** Offline deployment gate. No RPC, secrets, wallet signing or network requests. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync, realpathSync, readdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const expectedSourceHash = 'b536bb4aad1f59646c54e612c19eb498f31c0d79903276a0ae9acf6d2e6e8693';
const splRequire = createRequire(require.resolve('@solana/spl-token'));
const layoutRequire = createRequire(splRequire.resolve('@solana/buffer-layout-utils'));
const bigintPath = realpathSync(layoutRequire.resolve('bigint-buffer'));
const source = readFileSync(bigintPath, 'utf8');
assert.equal(createHash('sha256').update(source).digest('hex'), expectedSourceHash,
  'Required bigint-buffer native-disable patch is absent or changed. Refuse release.');

// Simulate a resolvable stale native binding without creating or executing a .node file.
// Any require() attempt fails the gate, even if upstream code catches its exception.
let nativeLoadAttempts = 0;
const sandbox = {exports: {}, Buffer, BigInt, console,
  require() { nativeLoadAttempts++; throw new Error('Native loader attempted'); }};
vm.runInNewContext(source, sandbox, {filename: bigintPath, timeout: 1000});
assert.equal(nativeLoadAttempts, 0);
const actual = layoutRequire('bigint-buffer');
const cases = [];
for (const bytes of [8, 16]) {
  for (const value of [0n, 1n, 0x0102030405060708n, (1n << BigInt(bytes * 8)) - 1n]) {
    for (const endian of ['LE', 'BE']) {
      const expected = Buffer.from(value.toString(16).padStart(bytes * 2, '0'), 'hex');
      if (endian === 'LE') expected.reverse();
      for (const api of [actual, sandbox.exports]) {
        assert.deepEqual(api['toBuffer' + endian](value, bytes), expected);
        assert.equal(api['toBigInt' + endian](expected), value);
      }
      cases.push(`${bytes * 8}-${endian}-${value}`);
    }
  }
}
for (const api of [actual, sandbox.exports]) {
  assert.equal(api.toBigIntLE(Buffer.alloc(0)), 0n);
  assert.equal(api.toBigIntBE(Buffer.alloc(0)), 0n);
  assert.throws(() => api.toBigIntLE(null));
  assert.throws(() => api.toBigIntBE(null));
}
assert.equal(nativeLoadAttempts, 0);

// Independent fixed-layout SPL fixtures, not a self-round-trip assertion.
const spl = require('@solana/spl-token');
const mint = Buffer.alloc(spl.MintLayout.span);
mint.writeBigUInt64LE(0xffffffffffffffffn, 36);
mint[44] = 9; mint[45] = 1;
const decodedMint = spl.MintLayout.decode(mint);
assert.equal(decodedMint.supply, 0xffffffffffffffffn);
assert.equal(decodedMint.decimals, 9);
assert.equal(decodedMint.isInitialized, true);
const tokenAccount = Buffer.alloc(spl.AccountLayout.span);
tokenAccount.writeBigUInt64LE(0x0102030405060708n, 64);
tokenAccount[108] = 1;
assert.equal(spl.AccountLayout.decode(tokenAccount).amount, 0x0102030405060708n);
const layouts = splRequire('@solana/buffer-layout-utils');
for (const name of ['u64', 'u128']) {
  const width = name === 'u64' ? 8 : 16;
  assert.equal(layouts[name]().decode(Buffer.alloc(width, 255)), (1n << BigInt(width * 8)) - 1n);
  assert.throws(() => layouts[name]().encode('not-a-bigint', Buffer.alloc(width)));
}

// Use the exact dependency resolution used by web3, with a local mock transport.
const web3Require = createRequire(require.resolve('@solana/web3.js'));
const jaysonPath = web3Require.resolve('jayson/lib/client/browser');
const jaysonRequire = createRequire(jaysonPath);
assert.equal(jaysonRequire('uuid/package.json').version, '11.1.1');
const Client = web3Require('jayson/lib/client/browser');
const client = new Client((wire, callback) => {
  const request = JSON.parse(wire);
  assert.match(request.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  callback(null, JSON.stringify({jsonrpc: '2.0', id: request.id, result: 42}));
});
await new Promise((resolve, reject) => client.request('offlineCheck', [], (err, response) => {
  if (err) return reject(err);
  try { assert.equal(response.result, 42); resolve(); } catch (error) { reject(error); }
}));
require('@raydium-io/raydium-sdk-v2');
assert.equal(Object.keys(require.cache).filter(path => /[/\\]stream-json[/\\]/.test(path)).length, 0,
  'stream-json became reachable through inspected runtime imports; review before release.');

// Check every installed pnpm copy, including copies introduced by future dependency changes.
const store = join(dirname(require.resolve('../package.json')), 'node_modules/.pnpm');
let copies = 0;
for (const entry of readdirSync(store)) {
  if (!entry.startsWith('bigint-buffer@')) continue;
  const file = join(store, entry, 'node_modules/bigint-buffer/dist/node.js');
  const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
  assert.equal(digest, expectedSourceHash, `Unpatched bigint-buffer copy: ${entry}`);
  copies++;
}
assert.ok(copies > 0);
console.log(JSON.stringify({status: 'PASS', bigintSourceSha256: expectedSourceHash,
  checkedCopies: copies, integerCases: cases.length, nativeLoadAttempts,
  splFixtures: 2, uuidVersion: '11.1.1', streamJsonLoaded: false,
  scope: 'Offline resolved dependencies only. Audit advisories remain; deployment and financial acceptance are separate.'}, null, 2));
