Here is the independent review of the read-only token fee inspection implementation. 

### 1. [Medium · Confirmed] Raw network/RPC failures leak as unhandled 500s instead of structured `AppError`s
* **Evidence:** In `src/lib/raydium/token-inspection.ts`:
  ```ts
  const genesis = await rpc.getGenesisHash();
  ...
  const before = await rpc.getEpochInfo({ commitment: 'confirmed' });
  const snapshot = await rpc.getAccountInfoAndContext(address, { commitment: 'confirmed', minContextSlot: before.absoluteSlot });
  ...
  const after = await rpc.getEpochInfo({ commitment: 'confirmed', minContextSlot: snapshot.context.slot });
  ```
* **Impact:** All four RPC calls sit outside the `try / catch` block. If the upstream RPC times out (`AbortSignal.timeout(10_000)` throws `TimeoutError`/`AbortError`), rejects the connection, returns HTTP 429/502/503 (causing `@solana/web3.js` to throw a generic `Error` with raw upstream response text), or hits `minContextSlot` not reached on a lagging load-balanced node, `inspectToken` throws an unwrapped `Error`. Depending on `api()`, this either triggers a generic 500 error or leaks internal RPC URLs/messages to the client instead of returning `AppError('INSPECTION_RPC_UNAVAILABLE', ..., 503)`.
* **Fix:** Wrap the RPC sequence (`getGenesisHash`, `getEpochInfo`, `getAccountInfoAndContext`) in a `try / catch` that preserves `AppError` instances and normalizes any other thrown network/RPC error into `new AppError('INSPECTION_RPC_UNAVAILABLE', '代币读取暂时不可用', 503)`.

---

### 2. [Low · Confirmed] Token-2022 account type discriminator (`data[82]`) is only indirectly checked when extensions exist
* **Evidence:** In `src/lib/raydium/token-inspection.ts`:
  ```ts
  const parsed = unpackMint(address, account, account.owner);
  if (account.data.readUInt32LE(0) > 1 || account.data.readUInt32LE(46) > 1 || account.data[45] > 1) throw new Error('Invalid mint options');
  validateExtensions(parsed.tlvData);
  ```
* **Impact:** You explicitly harden `unpackMint` by validating `COption` tags (`0` and `46`) and the `isInitialized` boolean byte (`45`). However, for a `TOKEN_2022_PROGRAM_ID` account that is padded to `>= 166` bytes where the TLV region happens to be all zeros (`parsed.tlvData.every(b => b === 0)`), `@solana/spl-token`'s `unpackMint` only enforces `data[82] === AccountType.Mint (1)` when non-zero TLV entries are parsed. If `data[82]` is malformed (e.g., `0` Uninitialized or `> 1`), `validateExtensions` returns early on the all-zero check and accepts the account.
* **Fix:** Explicitly check the Token-2022 `AccountType.Mint` discriminator when `account.data.length > 82`:
  ```ts
  if (account.owner.equals(TOKEN_2022_PROGRAM_ID) && account.data.length > 82 && account.data[82] !== 1) {
    throw new Error('Invalid Token-2022 account type');
  }
  ```

---

### 3. [Low · Confirmed] Catalog search filter in `ExternalDiscovery` does not match by token `mint`
* **Evidence:** In `src/components/external-discovery.tsx`:
  ```tsx
  const items=(req.data?.items||[]).filter(i=>(i.name+' '+i.symbol).toLowerCase().includes(query.toLowerCase()));
  ```
* **Impact:** Each catalog row renders `<CopyAddress label="Mint" value={token.mint}/>`, and users inspecting tokens routinely paste a mint address into the catalog search box (`Search external tokens`). Filtering only by `name` and `symbol` yields an empty state (`No external catalog entries available`) even when that exact mint is present in the catalog.
* **Fix:** Include `i.mint` in the filter target:
  ```tsx
  const items=(req.data?.items||[]).filter(i=>(i.name+' '+i.symbol+' '+i.mint).toLowerCase().includes(query.trim().toLowerCase()));
  ```

---

### 4. [Low · Confirmed] `external-row` React key can collide when two tokens share a `poolId` or both have `poolId: null`
* **Evidence:** In `src/components/external-discovery.tsx`:
  ```tsx
  {items.map((token,i)=><div className="external-row" key={token.poolId||token.mint}>
  ```
* **Impact:** If the external discovery feed contains multiple entries associated with the same pool or duplicate mint entries across different pools, `token.poolId || token.mint` is not guaranteed unique per row.
* **Fix:** Combine both identifiers for a deterministic composite key: `key={`${token.mint}-${token.poolId ?? i}`}`.

---

### 5. [Low · Hypothesis] `ExternalDiscovery` does not guard against `tokens` with non-matching `cluster` badges if `/api/discovery` mixes or lags behind runtime cluster changes
* **Evidence:** In `src/components/external-discovery.tsx`:
  ```tsx
  <strong>{token.name}{token.cluster==='demo'&&<em>DEMO</em>}</strong><small>${token.symbol} · {token.cluster}</small>
  ```
* **Impact:** (Hypothesis—depends on `/api/discovery` implementation). In `ExternalDiscovery`, clicking `Inspect costs` passes `token.mint` to `/api/tokens/[mint]/inspection`, which strictly enforces the server's `getRuntime().cluster` (rejecting non-demo mints in demo mode and checking genesis hashes in live mode). That part is safe. However, if `ExternalDiscovery` is rendered while the user/environment switches between `demo` and `devnet`/`mainnet-beta`, `selectedMint` remains open in state until manually closed. Nothing in `ExternalDiscovery` resets `selectedMint` if `req.data?.source` or cluster changes.
* **Fix:** No action needed if runtime cluster is process-static; if cluster can change at runtime, reset `selectedMint` when `req.data?.source` changes.