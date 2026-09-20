# Product UX Correction Pass

Date: 2026-09-18

## Scope

Focused correction pass on the existing FairBake frontend. The visual system was preserved: editorial layout, off-white surfaces, black/green accents, thin borders, strong typography, and restrained state indicators.

## Corrections

- **Branding:** Replaced the desktop navigation label “Launch desk” with “FairBake”. Removed the duplicate floating create button; Create remains in the primary header/navigation.
- **Table semantics:** Renamed the rightmost Explore/Home table column from “Timing” to “Participants”. Rows now show the actual buyer count consistently.
- **Token identity:** Metadata now preserves empty name/symbol fields instead of inventing “Unnamed token” or “TOKEN”. Display priority is metadata name, symbol, legitimate metadata image, then mint fallback. Mint remains secondary.
- **Create-flow copy:** Reduced the token-safety copy to the consequence-focused sentence requested. Added a collapsed Technical details disclosure.
- **Preview defaults:** Sale supply, hard cap, and wallet limit now render as “—” until the creator enters them. Live values update as fields are filled.
- **Create review:** Kept the four-step structure and replaced the explanatory guarantee cards with concise immutable facts: fixed supply, no freezing, terms locked, raise limits, wallet limit, start, and end.
- **Oversubscription:** Funding demand now shows committed amount, hard cap, participants, and subscription percentage. The visual bar caps at 100%, while oversubscription remains visible as `OVERSUBSCRIBED` with the pro-rata consequence line.
- **Launch state:** Finalized public sales now show `SUCCESS` or `FAILED`. Personal position details are separate and include committed, accepted, refund, allocation, and claim state when a connected wallet has a position.
- **Dashboard:** Connected views now expose only available actions: Claim allocation/refund, Finalize, Withdraw proceeds, Withdraw inventory, and View launch. No portfolio totals or fabricated metrics were added.
- **Responsive:** Mobile launch pages put the action/state surface before the activity trail; critical demand, subscription, timing, integrity, and activity data remain visible.

## Browser inspection

Playwright screenshots were captured and visually reviewed for:

- `/`
- `/explore`
- `/create`
- `/dashboard`
- `/launch/Cf7bcxjdcmy2Fm3zEfbaw6h3sLZKvnCp4PJypJC74erq`

Desktop and 390px mobile checks passed for layout, overflow, table labels, preview dashes, oversubscription presentation, and launch-state hierarchy. The real launch route rendered Cookie RPC-backed data, including `150.0%` subscription and `OVERSUBSCRIBED`.

## Validation

- TypeScript: passed with `npx tsc --noEmit`.
- Next.js production build: passed with `npm run build`.
- Frontend smoke: dev server returned HTTP 200 for all checked routes.
- `npm run lint`: not run to completion because this repository has no ESLint configuration and Next.js opened its interactive first-run configuration prompt; no configuration was created.

## Remaining real UX problems

- Several existing on-chain sales have no Metaplex name/symbol metadata, so they correctly fall back to mint identity instead of receiving invented names.
- Wallet extension behavior still depends on the installed provider exposing a valid account and Cookie network support.
- The disconnected Dashboard state remains intentionally unchanged per scope.

## Wallet Persistence

- Selected wallet persistence: stores only the selected wallet name and optional last public address in localStorage.
- Silent Nightly reconnect: restores the selected provider once on application load through its installed `standard:connect` feature with `{ silent: true }`.
- Account restoration: rehydrates the authorized public account and reruns Cookie genesis verification.
- Explicit disconnect: removes the persisted preference and public address.
- Event listener cleanup: Wallet Standard register/unregister listeners and wallet account/network subscriptions now clean up on unmount or wallet replacement.
- Cookie re-verification: account restoration and account/network changes use the existing genesis verification path.
- Nightly runtime correction: account and network changes use Nightly's exposed Wallet Standard `standard:events` feature; the incompatible direct `onAccountChange(callback)` fallback was removed.

## Wallet Persistence QA

- Source lifecycle audit: PASS.
- TypeScript: PASS.
- Production build: PASS with `npm run build`.
- Read-only route smoke: PASS for `/`, `/explore`, `/dashboard`, `/create`, and the finalized sale route; all returned HTTP 200.
- Browser automation: unavailable in this environment because no agent-browser executable or connected browser surface was present. Manual refresh/navigation and explicit-disconnect verification remain the next human QA step with Nightly installed.
- Lint: not completed because `next lint` opens the repository's first-run ESLint configuration prompt; no configuration was created.

## Finalized sale manual smoke — PASS

- Sale: `4sJNvm4c8hcdxte4P1Js3SmaNFiK1yKB5WmUxRGuxLHL`.
- Finalization signature: `352a45yLm9zSvkewqRzm7DqTJHpXXNkGpHjQ5n48eJJT9bGsEnv22LkGNL7ct7aEAZzQXQ6G54BacQpXrQ2tvN4G`.
- Nightly signing path: the user approved the frontend-built transaction in Nightly; the frontend then submitted the signed bytes through Cookie RPC and confirmed them.
- Cookie genesis verification: `9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2`.
- Cookie RPC submission: finalized with `err: null` at slot `25853039`.
- Final on-chain status: `FAILED`; `0.0006 COOK` committed against a `0.001 COOK` minimum raise, with `0` creator proceeds and `0` token allocation claimed.
- UI refetch result: manual browser observation confirmed the launch page refetched after confirmation and displayed the failed finalized state.
