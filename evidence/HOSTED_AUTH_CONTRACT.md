# Hosted Auth contract review

2026-10-18. Source review and current official documentation, not a hosted login test.

- Solana Web3 provider must be enabled separately. Database migration does not enable it.
- Auth Redirect URLs must cover the actual signed URI/domain: the installed SDK signs window.location.href. Use exact permitted paths or the dedicated application origin followed by /**, not a broad cross-origin wildcard.
- Current client supplies chain=solana, connected wallet and explicit statement. This is off-chain sign-in, not a financial transaction.
- If hosted CAPTCHA is enabled, the current client needs captchaToken integration; do not disable a security feature just to pass a test.
- Server requires provider=web3 and identity_data.sub prefix web3:solana:. Official docs do not fully specify these fields. Verify the actual Auth-server getUser identity response before declaring compatibility; never replace verified identity with editable user_metadata.
- Next16 await cookies and getAll/setAll are appropriate in Route Handlers. Missing Proxy is not demonstrated failure because Server Components do not consume sessions; refresh persistence remains untested.

Required hosted acceptance: verify provider/domain settings, authorized off-chain wallet login, inspect only public identity fields (no tokens), reload/session persistence, logout, wallet mismatch denial, then two-wallet draft isolation and storage upload. No actual hosted login or signature performed by this review.

Sources:
- https://supabase.com/docs/guides/auth/auth-web3
- https://supabase.com/docs/guides/auth/identities
- https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs
