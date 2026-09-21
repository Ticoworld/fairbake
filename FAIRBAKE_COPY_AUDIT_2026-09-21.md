# FAIRBAKE COPY AUDIT — 2026-09-21

Scope: product-language audit only. No TSX, CSS, Rust, README, deployment, or transaction changes were made. This report inspects the current frontend, metadata, wallet/error strings, root documentation, and security/deployment wording.

Counting note: the verdict count is based on 86 de-duplicated meaningful copy items. Repeated labels used in several screens are counted once and their repeated locations are grouped. Dynamic token names, addresses, purely internal developer identifiers, loading skeletons, and raw exception payloads are excluded from the count.

## A. Product Positioning Truth

FairBake is currently a fixed-window token sale and distribution protocol. It is not a complete token-launch lifecycle: it does not create liquidity, provide trading, perform price discovery after the sale, integrate CookieSwap/Cookiebox, provide token metadata infrastructure, or resist Sybil identities.

| Candidate description | Classification | Audit result |
|---|---|---|
| `token launchpad` | NEEDS QUALIFICATION | Defensible only if qualified as a launchpad for fixed-window token sales. “Launchpad” commonly implies a broader launch, market, and liquidity lifecycle than FairBake currently provides. |
| `fair launchpad` | MISLEADING | “Fair” is broad and the launchpad label overstates lifecycle coverage. The product does not provide Sybil resistance, one-person-one-allocation, liquidity, or post-sale trading. |
| `token sale platform` | CURRENTLY DEFENSIBLE | Accurate at a high level, but generic and weak at communicating the differentiator. |
| `fixed-window token sale` | CURRENTLY DEFENSIBLE | Precise, understandable, and faithful to the core user action. |
| `token distribution protocol` | CURRENTLY DEFENSIBLE | Accurate for the full-supply escrow and claim stage, but incomplete because it hides the contribution, cap, and refund mechanics. |
| `fixed-window sale and distribution protocol` | CURRENTLY DEFENSIBLE | The most technically complete category, though too long for the primary homepage headline. |
| `fair token sale` | NEEDS QUALIFICATION | Usable only when “fair” is immediately defined as fixed-window participation plus deterministic pro-rata settlement and excess refunds. It must not imply universal economic or philosophical fairness. |

Recommended public category: **fixed-window token sale and distribution protocol**.

Recommended short category: **fixed-window token sale**.

Use “launch” as a familiar product/navigation term only when the underlying action is clearly described as creating or joining a sale. Avoid “launchpad” as the unqualified category.

## B. Core FairBake Message

The current product does not explain the mechanism prominently enough. The strongest mechanism sentence is currently hidden in `launch-page.tsx:204-207`, and the homepage has no equivalent visible explanation. A judge can see “Live now,” “Committed,” and “Participants” without quickly learning why FairBake differs from an ordinary token sale.

Recommended one-sentence explanation:

> Everyone contributes during the same fixed window; if total contributions exceed the hard cap, the sale accepts a deterministic pro-rata amount from each contribution and refunds the excess COOK after finalization.

This is accurate without claiming Sybil resistance or universal fairness. It explains the fixed window, hard cap, oversubscription, pro-rata settlement, and refund. “Each contribution” is more precise than “each person”: the protocol limits public-key wallets, not human identities.

Recommended shorter homepage variant:

> One fixed window, one hard cap: oversubscription settles pro-rata and excess COOK is refunded after finalization.

Do not use “fair” as the mechanism explanation. If the brand uses “fair,” define the mechanism next to it.

## C. Terminology System

| Concept | Preferred term | Terms to avoid as primary UI language | Why |
|---|---|---|---|
| Buyer action and amount | `contribute` / `contribution` | `commit`, `deposit`, `buy`, `purchase` | COOK is transferred into a sale, but the buyer does not know a final token amount at contribution time. “Buy” implies a guaranteed quantity; “deposit” implies a generic custody account; “commit” sounds like an abstract promise. |
| Total buyer amount | `total contributed` | `total committed` | The on-chain field is `total_committed`, but the user-facing meaning is the amount actually contributed to the sale. |
| Cap | `hard cap` | `raise cap` | “Hard cap” is short, recognizable, and describes the enforced maximum accepted COOK. Explain it once as the maximum accepted amount. |
| Minimum success condition | `minimum raise` with helper text | bare `minimum`, `target` | “Minimum raise” is standard creator terminology. Always state that the sale fails below it and buyers can claim full refunds. |
| Amount counted toward the cap | `accepted COOK` or `accepted contribution` | bare `accepted` | “Accepted” without an object is ambiguous. It is the final COOK amount counted toward the hard cap. |
| Amount returned | `COOK refund` / `excess COOK refunded` | `refund` alone when the screen also shows token output | Name the asset so the user knows what is being returned. Failed sales return the full contribution; successful oversubscribed sales return only the excess. |
| Token amount owed | `token allocation` or `tokens to claim` | bare `allocation` | “Allocation” is protocol language. “Tokens to claim” is clearer in action surfaces; “token allocation” is suitable for facts. |
| Post-close calculation | `sale result` as primary; `settlement` as secondary | bare `settlement` in headings | “Settlement” is accurate but technical. Use it in supporting copy after saying that results are calculated after the window closes. |
| Close operation | `close and settle sale` | bare `finalize` | `Finalize` is the contract instruction, but a normal user needs to know that the window is closed and results are calculated. |
| Buyer action after close | `claim tokens + COOK refund` | `claim allocation`, bare `claim` | A successful claim can include both token output and a COOK refund. The current label underdescribes the result. |
| Sale lifecycle | `sale` | `launch` as the only noun | Use “sale” for terms, contribution, close, result, and claims. “Launch” may remain in brand/navigation copy. |
| Token delivery stage | `distribution` | `launch` | Distribution describes what happens after settlement without implying a market exists. |
| Creator output | `accepted COOK proceeds` | `raise`, bare `proceeds` | The creator receives the accepted amount, not necessarily total contributions. |
| Tokens returned to creator | `remaining sale tokens` | `inventory`, `remaining inventory` in primary UI | “Inventory” is understandable to a creator but sounds like internal accounting. Keep it as a secondary technical term only. |
| Sale account | `sale account` or `sale record` | `treasury`, `PDA`, `BuyerPosition` | These are implementation concepts. Expose them only in technical details or transaction links. |
| One-wallet rule | `one contribution per wallet` | `one person`, `one allocation`, `one participant per person` | The rule is keyed by public key and does not provide Sybil resistance. |

## D. High-Risk / Overclaim Language

| Location | Current copy | Classification | Why | Recommended copy |
|---|---|---|---|---|
| `web/src/components/create-flow.tsx:776` | “Set the immutable window.” | NEEDS QUALIFICATION | The sale parameters are recorded and there is no current FairBake edit instruction, but the deployed program has an active upgrade authority. “Immutable” describes more than the current account surface proves. | “Set the sale window and limits.” Add: “These parameters are recorded on-chain when the sale is created. The deployed FairBake program remains upgradeable.” |
| `web/src/components/create-flow.tsx:872` and `launch-page.tsx:703` | “Terms locked” / “LOCKED” | NEEDS QUALIFICATION | Accurate only as a statement about the current sale account and current instruction set. It is not program immutability. | “Parameters recorded on-chain” in primary UI. Technical detail: “No FairBake edit action exists after creation; the deployed program is upgradeable.” |
| `web/src/components/create-flow.tsx:432` | “The terms are now immutable.” | NEEDS QUALIFICATION | Same program-upgrade limitation; also uses “terms” without saying which parameters are meant. | “Sale parameters are recorded on-chain. No edit action is available in FairBake; the deployed program remains upgradeable.” |
| `web/src/components/dashboard-page.tsx:25` | “Build a fixed-window sale and make its terms immutable.” | NEEDS QUALIFICATION | Empty-state copy repeats the strongest overclaim. | “Create a fixed-window sale and record its parameters on-chain.” |
| `web/src/components/app-shell.tsx:62` | “Fair launches, settled by the chain.” | NEEDS QUALIFICATION | “Fair” promises too much, and “settled by the chain” can imply automatic finalization. | “Fixed-window token sales with on-chain settlement.” |
| `web/app/layout.tsx:6` | “fair token launches without the race” | NEEDS QUALIFICATION | The race framing is a useful contrast, but “fair” is undefined and the product is not a full launchpad. | “FairBake — fixed-window token sales with pro-rata settlement.” |
| `web/src/components/launch-page.tsx:204-207` | “Fixed price · pro-rata settlement at close · excess demand is refunded.” | REMOVE | The sentence is hidden, so it does not perform its explanatory job. “Excess demand” is less direct than excess COOK. | Put the core mechanism visibly near the contribution surface: “If contributions exceed the hard cap, accepted COOK settles pro-rata and excess COOK is refunded after finalization.” |
| `web/src/components/launch-page.tsx:652` | “Verifiable trail” | REMOVE | The section shows state milestones, a sale account address, and a link to the account. It does not show a transaction-level activity trail for creation, contributions, claims, or withdrawals. | “On-chain status” or “Sale record.” |
| `web/src/components/create-flow.tsx:301` | “Verified fixed supply and revoked authorities…” | NEEDS QUALIFICATION | The frontend performed RPC checks; “verified” can sound like an external certification. | “Cookie checks passed: full supply present and minting/freezing permissions removed.” |
| `web/src/components/create-flow.tsx:159` | “It is safe to retry token creation.” | NEEDS QUALIFICATION | This is only safe after the current RPC has reconciled that no mint exists for the operation. A stale or ambiguous RPC result should not be treated as a blanket safety guarantee. | “No mint was found on Cookie after reconciliation. Retry token setup only if the network state is current.” |
| `README.md:3-6` | “fixed-window fair token launch proof… immutable sale window… permissionless finalization…” | NEEDS QUALIFICATION | The README combines a broad “fair” claim with an unqualified immutable claim and protocol language. | “FairBake is a fixed-window token sale and distribution protocol. Contributions close at a fixed time; if total contributions exceed the hard cap, accepted amounts settle pro-rata and excess COOK is refunded after finalization.” |

## E. Homepage Copy

### Current audit

The homepage (`web/src/components/home-page.tsx`) is operationally clear but product-light. It has “Live now,” “History,” “Create launch,” “Committed,” “Participants,” and a hidden/local preview surface. It does not visibly state the fixed-window, hard-cap, pro-rata, or refund mechanism.

| Location | Current copy | Classification | Why | Recommended copy |
|---|---|---|---|---|
| `home-page.tsx:49-53` | “Live now” / “History” / “Create launch” | KEEP for the first two; `Create launch` is covered by the global rewrite | The state and history actions are predictable. | “Live sales” / “Closed sales” may be used if the vocabulary is normalized. |
| `home-page.tsx:61` | “Other live sales” | KEEP | Clear and normal-user friendly. | No change required. |
| `home-page.tsx:62` | “Recent settlements” | REWRITE | “Settlement” is protocol language and does not tell a user whether claims are complete. | “Recently closed sales.” |
| `home-page.tsx:149-150` | “Nothing live. There is nothing to join right now.” | REWRITE | “Join” is vague; the user contributes to a sale. | “No sales are live right now.” |
| `home-page.tsx:152-153` | “History” / “Preview live state” | KEEP for `History`; REMOVE from production-facing surfaces | `Preview live state` is a developer QA affordance, not product copy. It is already non-production gated, but should not be part of public copy inventory. | “Closed sales” / no public preview action. |
| `layout.tsx:6` | Metadata title and description: “fair token launches without the race” / “Fixed-window token launches on Cookie Chain with transparent pro-rata settlement.” | REWRITE | “Fair” and “launches” are broad; the description omits the hard-cap/refund differentiator. | Title: “FairBake — fixed-window token sales with pro-rata settlement.” Description: “Contribute during one fixed window. If total contributions exceed the hard cap, accepted amounts settle pro-rata and excess COOK is refunded after finalization.” |

### Proposed homepage block

Headline: `Fixed-window token sales. Pro-rata when oversubscribed.`

Supporting line: `Everyone contributes during the same window. If total contributions exceed the hard cap, the sale accepts a pro-rata amount from each contribution and refunds the excess COOK after finalization.`

Primary actions: `Explore live sales` and `Create sale`.

This is enough explanation for the homepage. Do not add generic paragraphs about transparency, trust, or “the future of launches.” The mechanism and live numbers should do most of the work.

## F. Create Flow Copy

| Location | Current copy | Classification | Why | Recommended copy |
|---|---|---|---|---|
| `create-flow.tsx:478-481` | “Create launch” / “On-chain sale” | REWRITE | The heading and eyebrow use two nouns for the same object. | Heading: “Create sale.” Eyebrow: “Fixed-window sale.” |
| `create-flow.tsx:449-455` | “Launch created” / “Your launch is live on-chain.” | NEEDS QUALIFICATION | A created sale may be upcoming, so “live” is incorrect in the product’s own status model. | “Sale created on Cookie.” / “The sale page reads its status directly from Cookie. Share it with participants.” |
| `create-flow.tsx:454-455` | “Share the canonical page with participants.” | REWRITE | “Canonical” is technical and unnecessary. | “Share this sale page with participants.” |
| `create-flow.tsx:675-690` | “Step 1 · Token” / “Choose the launch asset.” / “Create new token” / “Use existing token” | REWRITE for the heading only; KEEP the two mode tabs | “Asset” is protocol language. | “Step 1 · Token” / “Choose or create your token.” |
| `create-flow.tsx:696-717` | “Token name,” “Symbol,” “Total supply,” “Decimals” | KEEP | These fields are standard and predictable. | No change required. |
| `create-flow.tsx:721` and `815` | “FairBake launches the entire fixed token supply.” | REWRITE | Accurate intent, but “launches” is ambiguous and does not say the supply enters this sale. | “100% of the fixed token supply enters this sale.” |
| `create-flow.tsx:723-725` | “Technical details” / “Creates a standard SPL mint and revokes both authorities in the creation flow.” | REWRITE | The disclosure pattern is useful, but “revokes” and “authorities” are developer-first. | “Technical details” / “For new tokens, FairBake creates a standard SPL token, mints the supply once, and removes minting and freezing permissions during setup.” |
| `create-flow.tsx:731-738` | “Mint address” / “We verify standard SPL ownership, revoked mint/freeze authorities, full supply, decimals, and creator inventory from Cookie RPC.” | NEEDS QUALIFICATION | “Verify” can imply certification; “inventory” and RPC are technical. | “Mint address” / “FairBake checks the token on Cookie: standard SPL ownership, full supply, minting/freezing permissions, decimals, and your token balance.” |
| `create-flow.tsx:744`, `759`, `763` | “Resuming mint” / “Preparing token…” / “Resume setup” / “Continue to terms” | REWRITE | “Mint” and “terms” are not the clearest primary actions. | “Resuming token setup…” / “Setting up token…” / “Continue token setup” / “Set sale parameters.” |
| `create-flow.tsx:774-776` | “Step 2 · Terms” / “Set the immutable window.” | NEEDS QUALIFICATION | See Section D. | “Step 2 · Sale parameters” / “Set the sale window and limits.” |
| `create-flow.tsx:780-811` | “Launch supply,” “Minimum raise,” “Hard cap,” “Max per wallet,” “Starts,” “Ends” | REWRITE | “Launch supply” and “per wallet” hide the exact meaning. | “Tokens in sale,” “Minimum raise,” “Hard cap,” “Max contribution per wallet,” “Starts,” “Ends.” |
| `create-flow.tsx:814-840` | “Fixed supply,” “Launch supply,” “Supply entering launch,” “100%” | REWRITE | The 100% fact is strong but “launch” is ambiguous. | “Fixed supply,” “Tokens in sale,” “Fixed supply entering sale,” “100%.” |
| `create-flow.tsx:852`, `863` | “Review terms” / “Review launch.” | REWRITE | Normalize to sale language. | “Review sale” in both places. |
| `create-flow.tsx:870-872` | “Mint authority — Removed,” “Freeze authority — Removed,” “Terms locked — Cannot be edited after launch” | NEEDS QUALIFICATION | The token controls are real facts; the labels are technical and the last one overstates program immutability. | “Minting — Disabled,” “Freezing — Disabled,” “Parameters — Recorded on-chain.” Add a technical disclosure that the deployed program is upgradeable. |
| `create-flow.tsx:894`, `890` | “Confirm & initialize” / “Initializing…” | REWRITE | “Initialize” names the instruction, not the result. | “Create sale and escrow tokens” / “Creating sale…” |
| `create-flow.tsx:381-382` | “Token supply is minted exactly once and both authorities are removed. FairBake launches the entire fixed token supply.” | REWRITE | Accurate for the new-token path but dense and repetitive. | “Token setup complete: the full fixed supply is minted, minting and freezing permissions are removed, and 100% of the supply is ready for this sale.” |
| `create-flow.tsx:431-433` | “Sale initialized and inventory escrowed. The terms are now immutable.” | NEEDS QUALIFICATION | “Inventory” and “initialized” are technical; “immutable” is not supportable as an absolute claim while the program is upgradeable. | “Sale created. 100% of the fixed supply is in the sale vault and the sale parameters are recorded on-chain.” |
| `create-flow.tsx:458-467` | “Open launch” / “View creation transaction” | REWRITE for `Open launch`; KEEP the transaction link | The transaction link is exact; “launch” is inconsistent with the sale object. | “Open sale” / “View creation transaction.” |
| `create-flow.tsx:137-179` | Recovery messages including “Mint created. Supply setup still needs to finish,” “Resume setup,” “safe to retry,” and “Mint recovery is blocked.” | NEEDS QUALIFICATION | The partial-mint warning is valuable. “Safe” must be scoped to a reconciled, missing mint; “blocked” should tell the user not to blindly retry. | “Token created; supply setup still needs to finish.” / “Checking token setup on Cookie…” / “No mint was found after reconciliation. Retry token setup.” / “Token setup needs review. Do not retry blindly.” |

## G. Launch Page Copy

| Location | Current copy | Classification | Why | Recommended copy |
|---|---|---|---|---|
| `launch-page.tsx:143-149` | “Launch unavailable” / “This sale could not be read.” / “No mock data is shown when the RPC cannot verify the address.” | KEEP for the first two; `No mock data…` is removed below | The failure state is clear; the mock-data sentence is internal QA language. | “Sale unavailable” / “This sale could not be read.” |
| `launch-page.tsx:204-207` | Hidden “Fixed price · pro-rata settlement at close · excess demand is refunded.” | REMOVE | Hidden explanatory copy is functionally absent. | Use the visible mechanism line in Section B. |
| `launch-page.tsx:169` | “Sale [short address]” | REWRITE | A short identifier is useful, but label it as an ID. | “Sale ID [short address].” |
| `launch-page.tsx:213-233` | “Demand,” “Committed,” “Subscription,” “Participants,” “hard cap” | REWRITE | “Demand” and “subscription” are abstract; “committed” is inconsistent with the preferred vocabulary. | “Contributions,” “Contributed,” “Cap used,” “Participants,” “Hard cap.” |
| `launch-page.tsx:235` | “Final allocations will settle pro-rata.” | REWRITE | Accurate but omits the buyer-facing refund consequence. | “If contributions exceed the hard cap, accepted COOK and token amounts settle pro-rata; excess COOK is refunded after finalization.” |
| `launch-page.tsx:238-247` | “Sale allocation,” “Minimum raise,” “Per wallet” | REWRITE | The token amount and wallet rule need explicit nouns. | “Tokens in sale,” “Minimum raise,” “Max contribution per wallet.” |
| `launch-page.tsx:253-274` | “Sale timing,” “Supply integrity,” “Mint authority — REMOVED,” “Freeze authority — REMOVED,” “Terms — LOCKED” | NEEDS QUALIFICATION | Timing is clear. The integrity heading is corporate and the three claims mix token state with program/parameter trust. | “Sale timing,” “Token controls,” “Minting — Disabled,” “Freezing — Disabled,” “Parameters — Recorded on-chain.” Add the upgradeability disclosure nearby. |
| `launch-page.tsx:418-423` | “My position,” “Participate,” “Settlement” | REWRITE | “My position” and “settlement” are protocol-first; the card needs a plain user purpose. | “Your contribution,” “Contribute,” “Sale result.” |
| `launch-page.tsx:436-441` | “Commit once.” / “One contribution per wallet. Your accepted amount and refund are estimated before you sign.” | NEEDS QUALIFICATION | The one-wallet rule is accurate at public-key level. The estimate can become stale as later buyers contribute and may look like a promise. | “One contribution per wallet.” / “Preview only: later contributions can change the final accepted amount and COOK refund. Final results are calculated after the window closes.” |
| `launch-page.tsx:459-467` | “Estimated accepted” / “Estimated refund” | NEEDS QUALIFICATION | The labels say estimated, but not why the estimate can change or that the preview is not guaranteed. | “Current preview — accepted COOK” / “Current preview — COOK refund” with “Later contributions can change this preview.” |
| `launch-page.tsx:483`, `480` | “Commit contribution” / “Confirming…” | REWRITE | The action is not a commitment promise; it transfers COOK and creates a one-wallet position. | “Contribute COOK” / “Submitting contribution…” |
| `launch-page.tsx:486-488` | “You will sign with your wallet. The final allocation is calculated after the sale closes.” | REWRITE | “Allocation” omits refunds and “sale closes” is less exact than finalization. | “You will sign with your wallet. Final tokens and any COOK refund are calculated after the window closes and the sale is finalized.” |
| `launch-page.tsx:493-498` | “Ready to settle.” / “Finalization is permissionless. Any connected Cookie wallet can execute it.” | REWRITE | The capability is real, but “permissionless” is protocol language and can sound automatic. | “Window closed. Ready to calculate results.” / “Any connected Cookie wallet can close and settle this sale.” |
| `launch-page.tsx:510`, `507` | “Finalize sale” / “Finalizing…” | REWRITE | The user should predict that the window is closed and results become available. | “Close and settle sale” / “Closing sale…” |
| `launch-page.tsx:516-519` | “SUCCESS” / “The sale settled successfully.” | REWRITE | Does not say that the minimum was met or that the buyer result is now claimable. | “SUCCESS — Minimum raise met. Your tokens and any COOK refund are ready to claim.” For a disconnected user: “SUCCESS — Minimum raise met. Final sale results are available.” |
| `launch-page.tsx:516-519` | “FAILED” / “The minimum raise was not met.” | REWRITE | Accurate but incomplete: buyers can recover full contributions and the creator can recover sale tokens. | “FAILED — Minimum raise not met. Buyers can claim a full COOK refund; the creator can withdraw the remaining sale tokens.” |
| `launch-page.tsx:518` | “Connect the contributing wallet to view its position.” | REWRITE | “Position” is implementation language. | “Connect the wallet that contributed to see its final result.” |
| `launch-page.tsx:523-527` | “Sale has not started.” / “Contributions open at the start time shown above.” | KEEP | Clear and accurately prevents an early action. | No change required. |

## H. Buyer State Copy

### Critical pre-finalization defect

`launch-page.tsx:553-560` currently renders, for any non-success status, `Accepted: 0`, `Refund: full contribution`, and `Allocation: 0`. Before finalization this is not a result. It is a misleading visual model, even though the adjacent note says the allocation is not knowable yet.

The correct model is:

- Before finalization: show `Contribution: X COOK` and `Final result: Pending finalization`. Do not display numeric accepted, refund, or token allocation values.
- After successful finalization: show `Accepted COOK`, `COOK refund`, and `Tokens to claim` as final values.
- After failed finalization: show `COOK refund: full contribution` and `Tokens to claim: 0`; label the failed status explicitly.
- After claim: show `Claim complete — tokens and any COOK refund sent`.

| Location | Current copy | Classification | Why | Recommended copy |
|---|---|---|---|---|
| `launch-page.tsx:557-560` | “Committed,” “Accepted,” “Refund,” “Allocation” | REWRITE | The labels are not all understandable and are wrong when populated with pre-finalization placeholder values. | Pending: “Contribution,” “Final result,” “Pending finalization.” Final: “Contribution,” “Accepted COOK,” “COOK refund,” “Tokens to claim.” |
| `launch-page.tsx:563-566` | “Estimated allocation will be knowable after finalization. Your contribution is stored with its position prefix.” | REWRITE | “Position prefix” is developer language and the sentence omits refunds. | “Final tokens and any COOK refund are calculated after finalization.” |
| `launch-page.tsx:570` | “Claimed.” / “Claim available.” | REWRITE | It is unclear whether the claim includes tokens, a refund, or both. | “Claim complete — tokens and any COOK refund sent.” / “Tokens and any COOK refund ready to claim.” |
| `launch-page.tsx:582`, `dashboard-page.tsx:58` | “Claim refund” / “Claim allocation” | REWRITE | `Claim allocation` underdescribes a successful claim; failed claims should state full refund. | “Claim full COOK refund” / “Claim tokens + COOK refund.” |
| `launch-page.tsx:579` | “Settling…” | REWRITE | The buyer is claiming the result; “settling” may suggest the whole sale is being finalized. | “Claiming tokens and refund…” |
| `dashboard-page.tsx:39` | “Committed X COOK · Claimed / Unclaimed” | REWRITE | “Unclaimed” is not an action state and “committed” is inconsistent. | “Contributed X COOK · Claim complete” or “Contributed X COOK · Claim ready.” |
| `dashboard-page.tsx:39,45` | “View launch” | REWRITE | Normalize the sale noun. | “View sale.” |

The frontend has no visible `claim_for` recovery action. The protocol capability exists, but a normal user is not told that another fee-paying Cookie wallet can settle a stored position while the refund and tokens still go to the recorded buyer destinations. If a recovery surface is later approved, its copy should be:

> This claim can be completed by any Cookie wallet. Tokens and any COOK refund go to the wallet and token account recorded for this contribution.

Do not describe `claim_for` as a transfer to the helper or as a guarantee that every position is recoverable in every external account state.

## I. Creator State Copy

| Location | Current copy | Classification | Why | Recommended copy |
|---|---|---|---|---|
| `launch-page.tsx:605` | “Creator view” | REWRITE | Clear enough for developers but not descriptive for a creator. | “Creator actions.” |
| `launch-page.tsx:608-613` | “Accepted proceeds” / “Claims” | REWRITE | “Accepted proceeds” is accurate but the claims counter is ambiguous about what is claimed. | “COOK proceeds available” / “Buyer claims complete.” |
| `launch-page.tsx:622` | “Withdraw proceeds” | REWRITE | It does not say the amount is accepted COOK and may imply all contributions. | “Withdraw accepted COOK.” |
| `launch-page.tsx:626` | “Proceeds withdrawn.” | REWRITE | It is accurate but can be more specific. | “Accepted COOK withdrawn.” |
| `launch-page.tsx:636` and `dashboard-page.tsx:58` | “Withdraw remaining inventory” / “Withdraw inventory” | REWRITE | “Inventory” is internal language and the action is actually returning remaining sale tokens. | “Withdraw remaining sale tokens.” |
| `launch-page.tsx:635` | “Cleaning up…” | REWRITE | Generic and does not describe the asset movement. | “Returning remaining sale tokens…” |
| `launch-page.tsx:640` | “Remaining inventory withdrawn.” | REWRITE | Same terminology issue. | “Remaining sale tokens withdrawn.” |
| creator state after success | No explicit current one-line explanation of the amount | REWRITE | A creator needs to know proceeds are the accepted amount, not total committed demand. | “Minimum met. Accepted COOK proceeds are available to withdraw.” |
| creator state after failure | No explicit current one-line explanation of inventory recovery | REWRITE | The inventory button appears, but the reason and failed-sale outcome are not stated. | “Minimum not met. Buyer contributions are refundable and the creator can recover the sale tokens.” |

## J. Success / Failure / Settlement Copy

### Recommended state language

| State | Recommended primary copy | What it communicates |
|---|---|---|
| `SUCCESS` | `SUCCESS — Minimum raise met.` | The actual success condition, not merely “settled successfully.” |
| Successful buyer | `Your final result is ready: tokens and any COOK refund can be claimed.` | Settlement is complete, claim is still a separate action. |
| Successful creator | `Accepted COOK proceeds are available to withdraw.` | Creator receives the accepted amount, not total demand. |
| `FAILED` | `FAILED — Minimum raise not met.` | Failure is the sale condition, not a failed transaction. |
| Failed buyer | `Your full COOK contribution is ready to claim back. No tokens are distributed.` | Refund and zero allocation are explicit. |
| Failed creator | `You can withdraw the remaining sale tokens. No sale proceeds are available.` | Creator recovery is explicit. |
| `ENDED_AWAITING_FINALIZATION` | `Window closed — results are waiting to be calculated.` | The sale is not yet successful or failed in the user-facing sense until finalized. |

The current “SUCCESS” and “FAILED” labels may remain as compact status tokens only if the explanatory line is always present. Do not show them as if they describe wallet transaction success/failure.

## K. Recovery Copy

There are two distinct recovery concepts and they should not share one vague “safe” message.

1. Token creation recovery: a multi-transaction creator flow can stop after the mint account exists but before supply setup and authority removal. The user must resume the existing operation, not create another mint.
2. Buyer claim recovery: the program exposes `claim_for`, allowing another signer to submit the claim for the recorded buyer. The current frontend does not expose or explain this path.

Recommended token recovery state map:

| Current situation | Status label | One-line explanation | Primary action | Must not imply |
|---|---|---|---|---|
| No local operation | `New token setup` | “Create a token or use an existing token.” | `Create token` / `Use existing token` | A sale already exists. |
| TX1 confirmed, TX2 not complete | `Token setup incomplete` | “The token exists, but the full supply and authority changes still need to finish.” | `Resume token setup` | It is safe to create another token. |
| Reconciliation running | `Checking token setup` | “Checking the mint and transaction state on Cookie.” | Wait; then present the next safe action | That a timeout proves failure. |
| Mint absent after reconciliation | `No mint found` | “No mint for this operation was found on Cookie.” | `Retry token setup` | An RPC observation is an absolute global guarantee. |
| Unexpected/unsafe mint state | `Token setup needs review` | “The mint state does not match the expected setup. Do not retry blindly.” | `View technical details` / stop | That the user can safely continue. |
| Complete token setup | `Token ready` | “Full supply is present and minting/freezing permissions are removed.” | `Set sale parameters` | The sale is live. |

Recommended buyer recovery language if the recovery action is later surfaced:

> This position has a stored buyer and token destination. Any Cookie wallet can submit the claim; the result still goes to the recorded destinations.

The current transaction error “Refresh to reconcile safely” is technically responsible but reads like developer guidance. Prefer “Refresh before retrying so FairBake can check whether the transaction completed.”

## L. Button Labels

| Current label | Classification | Recommended label | Can a normal user predict the result? |
|---|---|---|---|
| `Create` / `Create launch` | REWRITE | `Create sale` | Yes, after the noun is normalized. |
| `Open launch` | REWRITE | `Open sale` | Yes. |
| `Continue to terms` | REWRITE | `Set sale parameters` | Yes; tells the user what the next screen contains. |
| `Resume setup` | REWRITE | `Resume token setup` | Yes; distinguishes token setup from sale setup. |
| `Review terms` / `Review launch` | REWRITE | `Review sale` | Yes. |
| `Confirm & initialize` | REWRITE | `Create sale and escrow tokens` | Yes; states the irreversible economic effect. |
| `Commit contribution` | REWRITE | `Contribute COOK` | Yes; states the asset and action. |
| `Finalize sale` | REWRITE | `Close and settle sale` | Yes; states that the window is closed and results are calculated. |
| `Claim allocation` | REWRITE | `Claim tokens + COOK refund` | Yes; includes both possible outputs. |
| `Claim refund` | REWRITE | `Claim full COOK refund` | Yes; distinguishes failed-sale recovery from an oversubscription refund. |
| `Withdraw proceeds` | REWRITE | `Withdraw accepted COOK` | Yes; prevents the user from assuming total contributions are withdrawable. |
| `Withdraw remaining inventory` / `Withdraw inventory` | REWRITE | `Withdraw remaining sale tokens` | Yes; identifies the asset. |
| `View creation transaction` | KEEP | `View creation transaction` | Yes. |
| `Retry connection` | REWRITE | `Retry` | Yes; shorter and still clear in the error context. |
| `Switch wallet to Cookie` | KEEP | `Switch wallet to Cookie` | Yes. |
| `Disconnect` | KEEP | `Disconnect` | Yes. |
| `Create another token` | KEEP if ever introduced, but it is not present in the current source | Keep only after a completed or explicitly abandoned operation | The action must not appear while a partial mint is recoverable. |

Busy labels should preserve the same object: `Submitting contribution…`, `Closing sale…`, `Claiming tokens and refund…`, `Withdrawing accepted COOK…`, and `Returning remaining sale tokens…`.

## M. Footer / Navigation / Supporting Copy

| Location | Current copy | Classification | Why | Recommended copy |
|---|---|---|---|---|
| `app-shell.tsx:48-58` | “Home,” “Explore,” “Dashboard,” “CookieScan,” “Search launches…” | KEEP for the navigation labels; rewrite search as covered above | The navigation hierarchy is understandable. | `Search sales by name, symbol, or address…` |
| `app-shell.tsx:62` | “Fair launches, settled by the chain.” | NEEDS QUALIFICATION | Broad fairness and implied automatic settlement. | “Fixed-window token sales with on-chain settlement.” |
| `launch-list.tsx:10` | “Launch,” “Status,” “Raise,” “Participants” | REWRITE | “Raise” does not match the displayed committed total. | “Sale,” “Status,” “Contributed / cap,” “Participants.” |
| `status-pill.tsx` | Raw labels such as `ENDED AWAITING FINALIZATION` | REWRITE | Machine-readable enum text is not normal-user state language. | `Upcoming`, `Live`, `Window closed`, `Success`, `Failed`. Add an explanatory line for each. |
| `launch-list.tsx:19` | “Cookie Chain could not verify the launch accounts. No placeholder activity is shown.” | REWRITE for first sentence; REMOVE second | “Accounts” and “placeholder activity” are internal terms. | “Could not read sale data from Cookie Chain. We are not showing unverified results.” |
| `not-found.tsx:2` | “That launch does not exist. Check the sale address or return to explore.” | REWRITE | The route is a sale page, not necessarily a “launch.” | “That sale does not exist. Check the sale address or return to Explore.” |
| `error.tsx:4` | “FairBake could not load this view. The chain may be temporarily unavailable. Nothing was signed by your wallet.” | KEEP | Clear, reassuring, and accurate for this error boundary. | No change required. |
| `home-page.tsx:62` | “Recent settlements” | REWRITE | Covered above; use “Recently closed sales.” | “Recently closed sales.” |
| `web/README.md:3` | “reads Sale and BuyerPosition accounts directly from Cookie Chain” | KEEP in technical documentation | This is a factual implementation description, not primary product copy. | No change required. |

Generic or AI-like wording to remove or avoid:

- “No placeholder activity is shown.” It explains an internal QA policy, not a user decision.
- “Verifiable trail” when no transaction trail is displayed.
- “Canonical page” when “this sale page” is enough.
- “Supply integrity” when the panel contains three concrete token/parameter facts.
- “Choose the launch asset.” It sounds like generated crypto marketing rather than a direct action.
- “Your launch is live on-chain.” It sounds promotional and is false for an upcoming sale.
- Repeated “fair,” “immutable,” and “settled by the chain” without mechanism or trust-model qualification.

## N. Security & Trust Language

### Claim-level audit

| Current or likely claim | Status | Correct boundary |
|---|---|---|
| Mint authority removed before launch | SUPPORTED | An initialized sale requires the mint authority to be absent; this is a token-level invariant of the current sale path. Say “minting disabled” for normal users. |
| Freeze authority removed before launch | SUPPORTED | An initialized sale requires the freeze authority to be absent; say “freezing disabled” in primary UI. |
| 100% of the fixed supply enters the sale vault | SUPPORTED | The current sale initialization path requires the sale supply to equal the full mint supply and transfers it into the program-controlled vault. |
| Sale parameters are stored on-chain | SUPPORTED | Parameters are recorded in the Sale account at initialization. This is not the same as immutable deployed code. |
| One contribution per wallet | SUPPORTED WITH LIMIT | The BuyerPosition is keyed by sale and public key. It is not one person, one identity, or Sybil-resistant. |
| Minimum raise, hard cap, and max contribution per wallet are enforced | SUPPORTED | These are sale-level rules in the current program. “Per wallet” must remain explicit. |
| Deterministic pro-rata settlement and excess COOK refund | SUPPORTED WITH LIMIT | The current math is deterministic for recorded contributions. It is not a universal fairness guarantee and should be described with the fixed window and hard cap. |
| Failed sales return full buyer contributions | SUPPORTED WITH LIMIT | The buyer must claim after finalization; refunds are not automatic. A solvent/available chain and valid destination account are still operational assumptions. |
| Finalization is permissionless | SUPPORTED | Any signer can call the current contract-level finalization instruction after the window. Say “Any Cookie wallet can close and settle the sale.” It is not automatic or keeper-run. |
| `claim_for` is permissionless | SUPPORTED | Another signer can submit a stored buyer claim; the signer does not receive the buyer’s value. The current UI does not expose this recovery path. |
| Terms are locked | NEEDS QUALIFICATION | Use only to mean that no current FairBake edit instruction exists. Pair it with the active upgrade-authority disclosure. Prefer “Parameters recorded on-chain.” |
| Immutable sale window / immutable protocol | UNSUPPORTED AS AN ABSOLUTE | The deployed FairBake program has an active upgrade authority. Program code and future behavior are not immutable. |
| Secure / safe | UNSUPPORTED AS STANDALONE MARKETING | These words are vague and can imply a safety guarantee. Replace with the specific invariant or limitation. |
| Trustless | UNSUPPORTED | The active upgrade authority is a deployment trust assumption that can change program behavior and control escrowed assets. |
| Non-custodial | UNSUPPORTED IN THE STRONG SENSE | Assets are held in program-controlled accounts, but the upgrade authority means the deployment cannot be marketed as trustless/non-custodial without qualification. |
| Completely decentralized | UNSUPPORTED | Permissionless finalization is one permissionless action, not complete decentralization of deployment, upgrades, wallet, RPC, or market lifecycle. |
| Audited | UNSUPPORTED | The repository contains an internal adversarial/security review and tests, not an independent external security audit. |
| Verified | NEEDS QUALIFICATION | Use “Cookie checks passed” for a specific RPC observation. Do not use “verified” as a security or certification label. |
| Verifiable trail | UNSUPPORTED BY CURRENT UI | The UI exposes state milestones and an account link, not a transaction-level trail. |
| Fair / guaranteed fair | NEEDS QUALIFICATION / UNSUPPORTED | “Fair” may describe the fixed-window pro-rata mechanism only. “Guaranteed fair” must not appear. |
| Cannot ever be changed | UNSUPPORTED | Contradicted by active upgrade authority. |

### Three trust layers

**On-chain sale invariants** are the specific rules the current program enforces: full fixed supply into the sale vault, revoked mint/freeze authorities at initialization, stored sale parameters, one public-key position, min raise, hard cap, max contribution per wallet, deterministic pro-rata acceptance, refunds, failed-sale refunds, creator accepted proceeds, permissionless finalization, claims, and terminal inventory rules.

**Deployment trust assumptions** are outside those sale invariants: the deployed bytecode remains the reviewed code; the active upgrade authority does not change the program; the user is on the expected Cookie network; RPC data is available and current; the wallet signs the intended transaction; and no independent audit has certified the deployment.

**Marketing language** should name the invariant, not convert it into a stronger promise. “Excess COOK is refunded after finalization” is marketing-safe. “Trustless, immutable, rug-proof, guaranteed fair” is not.

## O. Remove / Rewrite List

### Counted inventory and verdicts

| # | Location | Current copy | Classification | Why | Recommended copy |
|---:|---|---|---|---|---|
| 1 | `app-shell.tsx:48-58` | Home / Explore / Dashboard / CookieScan | KEEP | Clear navigation. | No change. |
| 2 | `app-shell.tsx:55`, `explore-page.tsx:35` | Search launches… / Search name, mint, creator… | REWRITE | “Mint” and “creator” are technical; “launches” is inconsistent. | Search sales by name, symbol, or address… |
| 3 | `app-shell.tsx:56,58`, `home-page.tsx:53` | Create / Create launch | REWRITE | Inconsistent noun; the object is a sale. | Create sale |
| 4 | `app-shell.tsx:62` | Fair launches, settled by the chain. | NEEDS QUALIFICATION | Broad fairness; implies automatic settlement. | Fixed-window token sales with on-chain settlement. |
| 5 | `home-page.tsx:52,61` | Live now / History / View all / View history | KEEP | Predictable actions. | No change required. |
| 6 | `home-page.tsx:61` | Other live sales | KEEP | Clear. | No change required. |
| 7 | `home-page.tsx:62` | Recent settlements | REWRITE | Protocol language; does not mean claims are complete. | Recently closed sales. |
| 8 | `home-page.tsx:149-150` | Nothing live. There is nothing to join right now. | REWRITE | “Join” is vague. | No sales are live right now. |
| 9 | `explore-page.tsx:35` | ALL / LIVE / UPCOMING / COMPLETED | REWRITE | “Completed” includes awaiting finalization in current filtering. | All / Live / Upcoming / Closed. |
| 10 | `explore-page.tsx:35` | Sort / Ending soon / Newest / Most committed / Most participants | REWRITE | “Committed” conflicts with preferred user vocabulary. | Sort / Ending soon / Newest / Most contributed / Most participants. |
| 11 | `launch-list.tsx:10` | Launch / Status / Raise / Participants | REWRITE | “Raise” labels total committed demand. | Sale / Status / Contributed / cap / Participants. |
| 12 | `launch-list.tsx:10,19` | No launches match these filters. | KEEP | Clear empty state. | No change required, or “No sales match these filters.” |
| 13 | `launch-list.tsx:19` | Cookie Chain could not verify the launch accounts. Retry connection. | REWRITE | Accounts/verify/connection are technical. | Could not read sale data from Cookie Chain. Retry. |
| 14 | `launch-list.tsx:19` | No placeholder activity is shown. | REMOVE | Internal QA explanation. | Remove. |
| 15 | `dashboard-page.tsx:22` | Wallet required / Connect wallet / Browse launches | KEEP | Clear and actionable. | No change required. |
| 16 | `dashboard-page.tsx:25` | Your positions / Participated / Created | REWRITE | “Position” is protocol language; “Participated” is awkward. | Your activity / Your contributions / Your sales. |
| 17 | `dashboard-page.tsx:25` | No participant positions yet. When you commit… BuyerPosition account… | REWRITE | Exposes developer account terminology. | No contributions yet. Your contribution will appear here after you join a sale. |
| 18 | `dashboard-page.tsx:25` | Build a fixed-window sale and make its terms immutable. | NEEDS QUALIFICATION | Unqualified immutable claim. | Create a fixed-window sale and record its parameters on-chain. |
| 19 | `dashboard-page.tsx:39,45` | Committed X COOK · Claimed / Unclaimed / View launch | REWRITE | Inconsistent terminology and unclear claim state. | Contributed X COOK · Claim complete / Claim ready · View sale. |
| 20 | `dashboard-page.tsx:25` | Could not read buyer positions / creator launches from Cookie RPC. | REWRITE | Developer-first wording. | Could not load your contributions / sales from Cookie. |
| 21 | `create-flow.tsx:478-481` | Create launch / On-chain sale | REWRITE | Two nouns for the same object. | Create sale / Fixed-window sale. |
| 22 | `create-flow.tsx:449-452` | Launch created / Your launch is live on-chain. | NEEDS QUALIFICATION | An upcoming sale is not live. | Sale created on Cookie. |
| 23 | `create-flow.tsx:454-455` | Share the canonical page with participants. | REWRITE | “Canonical” is unnecessary. | Share this sale page with participants. |
| 24 | `create-flow.tsx:677` | Choose the launch asset. | REWRITE | “Asset” is protocol language. | Choose or create your token. |
| 25 | `create-flow.tsx:684-690` | Create new token / Use existing token | KEEP | Direct and predictable. | No change. |
| 26 | `create-flow.tsx:696-717` | Token name / Symbol / Total supply / Decimals | KEEP | Standard field labels. | No change. |
| 27 | `create-flow.tsx:721,815` | FairBake launches the entire fixed token supply. | REWRITE | “Launches” is ambiguous; vault-entry mechanism is stronger. | 100% of the fixed token supply enters this sale. |
| 28 | `create-flow.tsx:723-725` | Technical details / Creates a standard SPL mint and revokes both authorities… | REWRITE | Technical verb-first phrasing. | Creates a standard SPL token, mints the supply once, and removes minting and freezing permissions during setup. |
| 29 | `create-flow.tsx:736-738` | We verify standard SPL ownership… from Cookie RPC. | NEEDS QUALIFICATION | “Verify” sounds like certification; “inventory” is internal. | FairBake checks the token on Cookie: standard SPL ownership, full supply, minting/freezing permissions, decimals, and your token balance. |
| 30 | `create-flow.tsx:744,759` | Resuming mint / Preparing token… | REWRITE | Primary copy should say token setup. | Resuming token setup / Setting up token… |
| 31 | `create-flow.tsx:763`, `852` | Resume setup / Continue to terms / Review terms | REWRITE | “Terms” and “setup” are vague. | Resume token setup / Set sale parameters / Review sale. |
| 32 | `create-flow.tsx:774-776` | Step 2 · Terms / Set the immutable window. | NEEDS QUALIFICATION | Immutability overclaim. | Step 2 · Sale parameters / Set the sale window and limits. |
| 33 | `create-flow.tsx:780-811` | Launch supply / Minimum raise / Hard cap / Max per wallet | REWRITE | “Launch supply” and “per wallet” hide exact meaning. | Tokens in sale / Minimum raise / Hard cap / Max contribution per wallet. |
| 34 | `create-flow.tsx:838-840` | Supply entering launch / 100% | REWRITE | “Launch” is ambiguous. | Fixed supply entering sale / 100%. |
| 35 | `create-flow.tsx:852,863` | Review terms / Review launch. | REWRITE | Normalize to sale. | Review sale. |
| 36 | `create-flow.tsx:870-871`, `launch-page.tsx:703` | Mint authority Removed / Freeze authority Removed | NEEDS QUALIFICATION | Accurate token facts but jargon-first. | Minting disabled / Freezing disabled; retain technical authority names in details. |
| 37 | `create-flow.tsx:872`, `launch-page.tsx:703` | Terms locked / Cannot be edited after launch | NEEDS QUALIFICATION | Does not disclose active program upgrade authority. | Parameters recorded on-chain; no FairBake edit action exists after creation; deployed program is upgradeable. |
| 38 | `create-flow.tsx:894,890` | Confirm & initialize / Initializing… | REWRITE | Instruction name does not describe the effect. | Create sale and escrow tokens / Creating sale… |
| 39 | `create-flow.tsx:381-382` | Token supply is minted exactly once… FairBake launches the entire fixed token supply. | REWRITE | Dense and repetitive. | Token setup complete: full supply minted, minting/freezing disabled, and 100% ready for this sale. |
| 40 | `create-flow.tsx:431-433` | Sale initialized and inventory escrowed. The terms are now immutable. | NEEDS QUALIFICATION | “Inventory,” “initialized,” and “immutable” are all poor primary language. | Sale created. 100% of the fixed supply is in the sale vault and parameters are recorded on-chain. |
| 41 | `create-flow.tsx:459` | Open launch | REWRITE | Normalize object noun. | Open sale. |
| 42 | `create-flow.tsx:467` | View creation transaction | KEEP | Exact result of clicking. | No change. |
| 43 | `create-flow.tsx:137-179` | Safe to retry / Mint recovery is blocked / Resume setup | NEEDS QUALIFICATION | Retry safety depends on reconciled chain state. | No mint found after reconciliation. Retry token setup. / Token setup needs review; do not retry blindly. |
| 44 | `launch-page.tsx:143-149` | Launch unavailable / This sale could not be read. | KEEP | Clear error state. | Use “Sale unavailable” if desired; otherwise no change. |
| 45 | `launch-page.tsx:148` | No mock data is shown when the RPC cannot verify the address. | REMOVE | Internal QA language. | Remove. |
| 46 | `launch-page.tsx:169` | Sale [short address] | REWRITE | Identifier should be labeled explicitly. | Sale ID [short address]. |
| 47 | `launch-page.tsx:204-207` | Hidden fixed-price/pro-rata/refund sentence | REMOVE | Hidden copy is not user-facing. | Move a concise mechanism line into the visible sale header/action surface. |
| 48 | `launch-page.tsx:213-233` | Demand / Committed / Subscription | REWRITE | Abstract and inconsistent. | Contributions / Contributed / Cap used. |
| 49 | `launch-page.tsx:235` | Final allocations will settle pro-rata. | REWRITE | Omits the excess COOK refund. | If contributions exceed the hard cap, accepted COOK and token amounts settle pro-rata; excess COOK is refunded after finalization. |
| 50 | `launch-page.tsx:238-247` | Sale allocation / Minimum raise / Per wallet | REWRITE | Bare “allocation” and “per wallet” are ambiguous. | Tokens in sale / Minimum raise / Max contribution per wallet. |
| 51 | `launch-page.tsx:253-264` | Sale timing / Starts in / Ends in | KEEP | Normal-user language. | No change. |
| 52 | `launch-page.tsx:269-274` | Supply integrity / Terms LOCKED | NEEDS QUALIFICATION | Mixes concrete token facts with an overclaim. | Token controls / Parameters recorded on-chain. |
| 53 | `launch-page.tsx:418-423` | My position / Participate / Settlement | REWRITE | Protocol-first headings. | Your contribution / Contribute / Sale result. |
| 54 | `launch-page.tsx:436-441` | Commit once. One contribution per wallet. Accepted/refund estimated before signing. | NEEDS QUALIFICATION | Estimate can change after later contributions; “commit” is awkward. | One contribution per wallet. Preview only: later contributions can change the final accepted COOK and refund. |
| 55 | `launch-page.tsx:459-467` | Estimated accepted / Estimated refund | NEEDS QUALIFICATION | Needs explicit non-guarantee and asset names. | Current preview — accepted COOK / Current preview — COOK refund. |
| 56 | `launch-page.tsx:483,480` | Commit contribution / Confirming… | REWRITE | Does not state asset or action. | Contribute COOK / Submitting contribution… |
| 57 | `launch-page.tsx:486-488` | Final allocation is calculated after the sale closes. | REWRITE | Omits refunds and uses “allocation” alone. | Final tokens and any COOK refund are calculated after the window closes and the sale is finalized. |
| 58 | `launch-page.tsx:493-498` | Ready to settle. Finalization is permissionless. | REWRITE | Technical and can sound automatic. | Window closed. Ready to calculate results. Any Cookie wallet can close and settle this sale. |
| 59 | `launch-page.tsx:510,507` | Finalize sale / Finalizing… | REWRITE | Does not describe outcome. | Close and settle sale / Closing sale… |
| 60 | `launch-page.tsx:516-519` | SUCCESS / The sale settled successfully. | REWRITE | Omits minimum condition and claim readiness. | SUCCESS — Minimum raise met. Your tokens and any COOK refund are ready to claim. |
| 61 | `launch-page.tsx:516-519` | FAILED / The minimum raise was not met. | REWRITE | Does not state buyer refund or creator recovery. | FAILED — Minimum raise not met. Buyers can claim a full COOK refund; the creator can withdraw remaining sale tokens. |
| 62 | `launch-page.tsx:518` | Connect the contributing wallet to view its position. | REWRITE | “Position” is developer language. | Connect the wallet that contributed to see its final result. |
| 63 | `status-pill.tsx` | Raw `SUCCESS`, `FAILED`, `ENDED AWAITING FINALIZATION` | REWRITE | Enum text is terse and machine-like. | Success · minimum met / Failed · minimum not met / Window closed. |
| 64 | `launch-page.tsx:523-527` | Sale has not started. Contributions open at the start time shown above. | KEEP | Clear and accurate. | No change. |
| 65 | `launch-page.tsx:553-566` | Accepted 0 / Refund full contribution / Allocation 0 before finalization; position prefix note | REMOVE | The values look final but are placeholders. | Pending: Contribution X COOK / Final result pending finalization. Do not show numeric accepted/refund/allocation until finalization. |
| 66 | `launch-page.tsx:557-560` | Accepted / Refund / Allocation after finalization | REWRITE | Labels need assets and plain language. | Accepted COOK / COOK refund / Tokens to claim. |
| 67 | `launch-page.tsx:570` | Claimed. / Claim available. | REWRITE | Output is not named. | Claim complete — tokens and any COOK refund sent. / Tokens and any COOK refund ready to claim. |
| 68 | `launch-page.tsx:582`, `dashboard-page.tsx:58` | Claim refund / Claim allocation / Settling… | REWRITE | Claim allocation underdescribes refund; settling can imply sale finalization. | Claim full COOK refund / Claim tokens + COOK refund / Claiming tokens and refund… |
| 69 | `launch-page.tsx:605-613` | Creator view / Accepted proceeds / Claims | REWRITE | Needs creator outcome, not protocol fields. | Creator actions / COOK proceeds available / Buyer claims complete. |
| 70 | `launch-page.tsx:622,626` | Withdraw proceeds / Proceeds withdrawn. | REWRITE | Does not say accepted COOK. | Withdraw accepted COOK / Accepted COOK withdrawn. |
| 71 | `launch-page.tsx:635-640`, `dashboard-page.tsx:58` | Cleaning up… / Withdraw remaining inventory / Remaining inventory withdrawn. | REWRITE | Internal “inventory/cleanup” language. | Returning remaining sale tokens… / Withdraw remaining sale tokens / Remaining sale tokens withdrawn. |
| 72 | `launch-page.tsx:648-660` | Activity / Verifiable trail / Open account | REWRITE | Not a transaction-level trail; account label is vague. | On-chain status / Sale record / Open sale account. |
| 73 | `launch-page.tsx:665-682` | Sale created / Contributions tracked / Finalized | KEEP | These are understandable state milestones. | Keep, but replace “positions” with “contributors” if displayed. |
| 74 | `launch-page.tsx:347` | Confirmed on Cookie · View transaction | KEEP | Accurate after confirmed transaction. | No change. |
| 75 | `web/src/lib/errors.ts:5-23` | Sale inactive, outside window, wallet cap, invalid contribution, not ended, already finalized, supply/authority errors | REWRITE | Most are accurate; several are technical or omit what the user should do. | Keep specific rules but use “sale,” “contribution,” and plain next steps. Example: “This sale is no longer accepting contributions.” |
| 76 | `web/src/lib/errors.ts:13-16` | Already claimed / Every participant must settle before inventory cleanup | REWRITE | “Settled” and cleanup are not normal-user terms. | This contribution has already been claimed. / All buyer claims must complete before remaining sale tokens can be withdrawn. |
| 77 | `web/src/lib/errors.ts:61-87` | Switch Nightly… / transaction rejected / refresh to reconcile safely | REWRITE | Accurate stage detail, but “reconcile” is technical and retry guidance is not explicit enough. | Switch Nightly to Cookie Chain before signing. / Transaction submitted; refresh before retrying so FairBake can check the result. |
| 78 | `wallet-button.tsx`, `wallet.tsx` | Connect wallet / Switch to Cookie / Disconnect / wallet connection failed | REWRITE | Core labels are clear; generic errors should say what the user can do. | Keep buttons; use “No compatible Cookie wallet found. Install Nightly or connect a supported Wallet Standard wallet.” |
| 79 | `layout.tsx:6` | Fair token launches without the race / transparent pro-rata settlement | NEEDS QUALIFICATION | Brand promise lacks the hard cap/refund mechanism and can imply broad fairness. | Fixed-window token sales with pro-rata settlement and excess COOK refunds. |
| 80 | `README.md:3-6` | Fixed-window fair token launch proof; immutable window; permissionless finalization; full-principal refund | REWRITE | Stale/broad public positioning; successful oversubscription can include partial refund, while full refund is the failed-sale path. | Use the mechanism paragraph from Section B. |
| 81 | `README.md:8-15` | “No frontend or production integrations are included.” | REMOVE | This is stale relative to the current frontend and real Cookie/Nightly flow. | Remove from public product documentation or move to historical spike notes. |
| 82 | `README.md:43-48` | “immutable Sale PDA,” “one deposit per buyer,” “permissionless,” “post-settlement withdrawals” | NEEDS QUALIFICATION | Implementation vocabulary and the immutable-PDA phrase can be misread as immutable program code. | “Each sale records its parameters in a Sale account. Each wallet has one contribution position. Any wallet can close the sale after the window; buyers and creators then claim or withdraw their recorded outcomes.” |
| 83 | `SECURITY_REVIEW.md:121-123` | “SECURITY GATE PASS” | NEEDS QUALIFICATION | A public reader may mistake an internal engineering gate for an external audit or safety certification. | “Internal security review passed for the reviewed source and test scope. This is not an independent audit.” |
| 84 | `SECURITY_REVIEW.md:111-117` | Deliberate one-contribution limitation; no independent security audit; residual risks | KEEP | These limitations prevent overclaiming and should remain in technical documentation. | No change; keep prominent if the document is public. |
| 85 | `DEPLOYMENT_REPORT.md`, `COOKIE_RUNTIME_REPORT.md` | “FAIRBAKE COOKIE DEPLOYMENT PASS” / “COOKIE RUNTIME PASS — READY TO DEPLOY” | REMOVE from product-facing docs | These are operational verdicts, not product copy, and “ready to deploy” conflicts with the requested no-release posture. | Keep only as dated internal evidence, clearly labeled non-marketing and non-release documentation. |
| 86 | `web/README.md:3` | Frontend reads Sale and BuyerPosition accounts directly from Cookie Chain. | KEEP in technical docs | Accurate implementation description; not a public marketing claim. | No change. |

### Inventory count

- KEEP: **15**
- REWRITE: **50**
- REMOVE: **6**
- NEEDS QUALIFICATION: **15**

## P. Final Proposed Copy System

### Product line

`FairBake — fixed-window token sales with on-chain pro-rata settlement.`

### Mechanism line

`Everyone contributes during the same fixed window; if total contributions exceed the hard cap, the sale accepts a deterministic pro-rata amount from each contribution and refunds the excess COOK after finalization.`

### Core vocabulary

Use `sale`, `contribute`, `contribution`, `total contributed`, `hard cap`, `minimum raise`, `accepted COOK`, `COOK refund`, `tokens to claim`, `close and settle`, `accepted COOK proceeds`, and `remaining sale tokens`.

Use `launch` only as a familiar navigation/brand term. Use `settlement`, `finalization`, `mint authority`, `freeze authority`, `PDA`, `treasury`, and `inventory` in technical details or documentation, not as the only explanation in an action surface.

### Trust disclosure

Recommended concise disclosure:

> Sale parameters are recorded on-chain when the sale is created. FairBake has no edit action after creation; the deployed program remains upgradeable.

Recommended token-control copy:

> 100% of the fixed token supply enters the sale. Minting and freezing permissions are disabled before the sale opens.

Recommended limitation copy, where needed:

> One contribution per wallet is enforced; this does not provide one-person-one-allocation or Sybil resistance.

### Minimal public state vocabulary

| Current state | Status label | One-line explanation | Primary action | Must not imply |
|---|---|---|---|---|
| New token flow | New token setup | Create a token or use an existing token. | Create/use token | A sale exists. |
| Token preparation | Setting up token | The next wallet approval is preparing the full supply and token controls. | Sign next setup transaction | The sale is live. |
| Interrupted after TX1 | Token setup incomplete | The token exists; supply setup and authority removal still need to finish. | Resume token setup | Safe duplicate mint creation. |
| Recovery check | Checking token setup | FairBake is comparing local operation data with Cookie state. | Wait / review | A timeout equals failure. |
| Token complete | Token ready | Full supply is present and token controls are complete. | Set sale parameters | The sale has started. |
| Upcoming sale | Upcoming | Contributions open at the displayed start time. | View sale | Users can contribute now. |
| Live sale | Live | Contributions are open until the displayed end time. | Contribute COOK | The accepted amount or refund is final. |
| Live and over cap | Live · Over cap | Demand is above the hard cap; final accepted amounts and refunds are calculated after the window. | Contribute COOK | Earlier buyers are guaranteed a fixed final result or that all later contributions are rejected. |
| Window ended | Window closed | No new contributions are accepted; the sale still needs a close-and-settle transaction. | Close and settle sale | Settlement is automatic or already final. |
| Success | Success · Minimum met | The minimum raise was met; buyer results and creator accepted COOK are available. | Claim tokens + COOK refund / Withdraw accepted COOK | All buyers have already claimed. |
| Failed | Failed · Minimum not met | Buyers can claim full COOK refunds; no tokens are distributed; the creator can recover sale tokens. | Claim full COOK refund / Withdraw remaining sale tokens | The blockchain transaction failed. |
| Buyer not participated | No contribution yet | This wallet has no contribution in this sale. | Contribute COOK | The sale has no demand. |
| Buyer awaiting close | Contribution recorded · Result pending | Final accepted COOK, refund, and tokens are not known until finalization. | View sale | Accepted 0 and full refund are final values. |
| Buyer result ready | Result ready to claim | The final token amount and any COOK refund are available. | Claim tokens + COOK refund | Claim happens automatically. |
| Buyer claimed | Claim complete | Tokens and any COOK refund have been sent to the recorded destinations. | None | The token has liquidity, trading, or a market. |
| Creator live | Sale live | Contributions are open; proceeds are not known until the window closes. | View sale | A minimum raise or proceeds amount is guaranteed. |
| Creator awaiting finalization | Window closed · Ready to settle | The sale needs any Cookie wallet to close and calculate results. | Close and settle sale | Final result exists before finalization. |
| Creator proceeds available | Accepted COOK available | The accepted amount is available after a successful finalization. | Withdraw accepted COOK | Total contributed demand is withdrawable. |
| Creator proceeds withdrawn | Accepted COOK withdrawn | The creator has withdrawn the recorded accepted proceeds. | None | Buyer claims are complete. |
| Creator inventory cleanup available | Remaining sale tokens available | Sale tokens not reserved for outstanding buyer claims can be returned to the creator. | Withdraw remaining sale tokens | All remaining tokens are necessarily unsold rather than rounding or other terminal remainder. |

### Final readiness decision

Current UI wording is **NO — not ready for public release**.

The blockers are language truthfulness and comprehension, not a request for redesign: unqualified immutability/locked terms, broad fair/launchpad positioning, misleading pre-finalization numeric results, incomplete claim labels, missing refund explanation near oversubscription, a false “live” completion state for upcoming sales, and “verifiable trail” language that exceeds what the current activity section shows.

