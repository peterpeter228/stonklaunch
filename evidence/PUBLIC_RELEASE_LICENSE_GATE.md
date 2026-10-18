# Public browser release license gate

2026-10-18 source review. Installed Raydium SDK0.2.74-alpha declares GPL-3.0 and ships GPLv3. client-transactions.ts and transaction-guard.ts import it into browser code. Lazy loading does not remove distribution.

Public deployment is pending user decision: distribute corresponding covered application source under GPLv3 via a sanitized version-matched archive while keeping development repository private, or change the client integration before release. LICENSE alone and an upstream link do not supply application corresponding source. No source archive published and no repo visibility changed.

A source archive must include preferred editable covered code and build/install scripts, notices, applicable dependency sources or compliant equivalent access; no secrets or private history. The boundary of a combined work is a legal judgment, not an assertion that only two files or necessarily all backend code must be released. Do not promise legal clearance.

Primary references:
https://github.com/raydium-io/raydium-sdk-V2/blob/master/LICENSE
https://www.gnu.org/licenses/gpl-faq.en.html#UnreleasedMods
