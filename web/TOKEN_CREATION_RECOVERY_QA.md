# Token Creation Recovery QA

These checks are browser/RPC observations only. Do not use real funds or create a QA token without explicit approval. Each test uses a disposable local/mock RPC setup where possible.

## TEST 1 — normal creation

- Action: complete the new-token wizard through both wallet approvals.
- Expected local operation state: `PREPARED` before submission, `MINT_SUBMITTED` immediately after TX1 signature, `MINT_CONFIRMED`, then `SUPPLY_SETUP_SUBMITTED`, then `COMPLETE` after TX2 confirmation.
- Expected chain state: mint exists; full expected supply is in the creator ATA; mint and freeze authorities are `None`.
- Expected UI: concise submitted/confirmation feedback, then “Token setup complete. Continue to terms.”
- Retry: no new mint; the completed operation resumes at Terms after refresh.

## TEST 2 — reject/cancel TX1

- Action: reject the first wallet signature.
- Expected local operation state: `PREPARED` may remain as a public intent; no TX1 signature or mint address is treated as submitted.
- Expected chain state: no mint account from this operation.
- Expected UI: cancellation error; retry is allowed because no mint exists.
- Retry: a new mint may be generated only after the absent mint is reconciled.

## TEST 3 — approve TX1, then refresh before TX2

- Action: approve TX1, persist its returned signature, refresh before starting supply setup.
- Expected local operation state: `MINT_SUBMITTED` or `MINT_CONFIRMED`, with public mint and TX1 signature.
- Expected chain state: mint exists with zero supply and creator authorities.
- Expected UI: “Mint created. Supply setup still needs to finish.” and one “Resume setup” action.
- Retry: resume TX2 only; never create another mint.

## TEST 4 — approve TX1, close tab, reopen

- Action: close the tab after TX1 submission, reopen `/create` with the same connected creator.
- Expected local operation state: durable record is restored by creator address.
- Expected chain state: reconciliation independently checks transaction status and the mint account.
- Expected UI: partial mint offers Resume setup; missing mint is explicitly safe to discard; unsafe state is blocked with technical detail.
- Retry: no duplicate mint while a real mint exists.

## TEST 5 — approve TX2, simulate confirmation timeout

- Action: make RPC submission return a signature, then make confirmation unavailable.
- Expected local operation state: `SUPPLY_SETUP_SUBMITTED` with TX2 signature and token account.
- Expected chain state: on reload, inspect supply, owner, decimals, mint authority, freeze authority, and creator balance independently of transaction-history availability.
- Expected UI: “Transaction was submitted, but confirmation is still being checked. Refresh to reconcile safely.”
- Retry: do not blindly resubmit. If the mint is complete, mark `COMPLETE`; if it is still the zero-supply pre-state, resume TX2; otherwise block.

## TEST 6 — completed token survives refresh and resumes Terms

- Action: refresh after both transactions are confirmed.
- Expected local operation state: `COMPLETE`, with mint, token account, public signatures, and intended config.
- Expected chain state: full supply, creator balance, legacy Token Program owner, and both authorities revoked.
- Expected UI: wizard opens at Terms with the existing mint; no token transaction is repeated.
- Retry: never create a new mint for a completed operation.

## Safety assertions for every test

- No private key, seed, serialized signer secret, or wallet session secret appears in local storage.
- A stale record for another creator is not resumed.
- An unexpected owner, decimals value, partial supply, or authority mismatch is never auto-continued.
