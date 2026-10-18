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

## Upstream source resolution

Pinned official Auth commit ce9a8eee0cc042be8c7a42981a7ddae631e41d91 confirms provider='web3', signature-verified Solana Subject='web3:solana:'+address, Claims JSON sub mapping and persisted identity_data. The earlier documentation uncertainty is resolved at upstream source level; no application identity-format change required. Hosted deployed version and actual login remain untested.

https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/api/web3.go#L117-L135
https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/api/provider_constants.go#L31
https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/api/provider/provider.go#L86-L90
https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/api/external.go#L302-L323

Domain refinement: upstream accepts configured Site URL matching scheme/hostname/port without every path listed. Other origins require both signed URI and https://domain/ validation. Set the actual production Site URL; a single exact login path can be insufficient for another origin. Test hosted behavior rather than weakening allowlist.
https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/utilities/request.go#L94-L138
