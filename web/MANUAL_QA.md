# FairBake Manual QA

## Finalized sale smoke — PASS

Date: 2026-09-18

- Sale: `4sJNvm4c8hcdxte4P1Js3SmaNFiK1yKB5WmUxRGuxLHL`
- Mint: `G8Gx3wkErKH8bWoBfzdFM7JfJB2GNxsofRhSciB2Fg2z`
- Nightly signing path: manual Nightly approval through FairBake's Cookie-specific sign-then-submit flow.
- Cookie genesis: `9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2`
- Finalization signature: `352a45yLm9zSvkewqRzm7DqTJHpXXNkGpHjQ5n48eJJT9bGsEnv22LkGNL7ct7aEAZzQXQ6G54BacQpXrQ2tvN4G`
- Cookie RPC submission: finalized, `err: null`, slot `25853039`.
- On-chain result: `FAILED`; total committed `0.0006 COOK`, minimum raise `0.001 COOK`, creator proceeds `0`, final accepted raise `0`, token allocation claimed `0`.
- UI refetch: manual browser observation confirmed the frontend refetched after confirmation and displayed the finalized failed state.

### Participant found for the refund follow-up

- BuyerPosition PDA: `EAspfHZ7SajHXW41Vfd9pTJTjSBLhK9MYgBWuchBfD4v`
- Buyer: `Fza5PEzz1JxqGFnMGJJcatf7jfk7QdAXZ5kBkTjDHPRh`
- Contribution: `0.0006 COOK`
- Claimed: `false`
- Stored token destination: `GzFh4czCeqKQ1bYBURmE3PmpnDdYPbPoiNemm845bvZU`
- Native refund destination: the buyer account constrained by the program (`Fza5PEzz1JxqGFnMGJJcatf7jfk7QdAXZ5kBkTjDHPRh`); there is no separate stored native-refund field.

No refund or claim transaction was executed during this audit.

## Wallet Persistence

- Selected wallet persistence: `selectedWallet` and `lastPublicAddress` are the only stored values; no keys, phrases, provider objects, or signed transactions are persisted.
- Silent Nightly reconnect: on a fresh app load, FairBake finds the persisted wallet by name and calls the installed `standard:connect` feature with `{ silent: true }` once.
- Account restoration: the returned authorized account is restored and Cookie genesis verification runs again before the connected state is shown.
- Explicit disconnect: clears the persisted wallet preference and address, preventing an immediate silent reconnect.
- Event listener cleanup: Wallet Standard registration listeners and wallet account/network listeners are removed on effect cleanup.
- Cookie re-verification: restored and changed accounts remain subject to the existing Cookie genesis check.
- Nightly runtime correction: FairBake uses Nightly's exposed Wallet Standard `standard:events` feature; the incompatible direct `onAccountChange(callback)` fallback was removed after browser verification showed Nightly rejected that argument shape.
