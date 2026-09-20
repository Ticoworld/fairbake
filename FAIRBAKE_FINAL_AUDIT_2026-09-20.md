# A. Executive Verdict

**STOP — CURRENT ARCHITECTURE HAS A MATERIAL BLOCKER.** The deployed program is upgradeable and its live ProgramData account names `Eyp6QgYij5Pe4ngcxe9yxttsQzUCMCvBGHrn97p9pSAc` as upgrade authority. That key can replace the program after deposits, so terms are not immutable against the deployer and funds are not trustless/non-custodial against that authority. This is a trust-model blocker for real user funds, not an implementation exploit in the reviewed bytecode.

The current bytecode's escrow, authority-revocation, settlement, refund reserve, and PDA checks are materially sound for the covered legacy-SPL model. However, the product is not frozen in version control, has no public deployment URL, lacks a browser-proven successful oversubscribed flow, and has a demonstrated two-transaction token-creation recovery failure. It is not ready to represent itself as a production fair launchpad.

Scope: source was authoritative. Cookie RPC queries were read-only. No transaction, deployment, mint, sale, or source/test/doc patch was made; this report is the explicitly requested audit artifact.

# B. Frozen Commit

No frozen commit exists. `git status`, `git rev-parse --show-toplevel`, ancestor inspection, and recursive `.git` discovery established that `C:\Users\timot\Desktop\2026\HACKATHON\fairbake` is not a Git worktree and has no Git ancestor. Creating a new repository would not be a snapshot of an existing repository and was not done.

`target/deploy/fairbake-keypair.json` is a private deploy keypair under the ignored `target/` directory. It was not opened or printed. It is not staging-eligible under `.gitignore`, but its presence means a future repository initialization must continue to exclude `target/`. Build output (`target/`, `web/node_modules/`, `web/.next/`, screenshots, and `*.tsbuildinfo`) was also present and must not be treated as legitimate source.

Result: **DEPLOYMENT/SNAPSHOT BLOCKED**. There is no commit hash, no inspectable history, and no trustworthy source revision identifier.

# C. Architecture Actually Implemented

FairBake is a legacy SPL Token, full-supply fixed-window distribution protocol:

* `initialize_sale` creates `Sale = ["sale", creator, mint]`, vault = `["sale-vault", sale]`, and native treasury = `["treasury", sale]`; transfers the whole mint supply to the vault; requires mint and freeze authority to be `None`.
* `buy` creates exactly one `BuyerPosition = ["buyer-position", sale, buyer]`, transfers native COOK to the treasury, and stores contribution plus its cumulative prefix and immutable token destination.
* After `clock > end_time`, any signer finalizes. A sale succeeds when `total_committed >= minimum_raise`.
* A successful claim transfers a deterministic token allocation plus any refund. Failed claims return full principal and no tokens. `claim_for` lets any fee-paying signer settle to the stored buyer and token account.
* The creator may withdraw exact accepted proceeds after a successful finalization. Inventory returns only after all successful-sale positions claim, or immediately after failure.

It does not create token metadata, liquidity, a market, Cookiebox/CookieSwap liquidity, price discovery after sale, Sybil resistance, account closure, relaunch support for a creator/mint, or a public deployment.

## Instruction/account review

| Instruction | Signer(s); writable accounts | PDA/identity constraints | Assets and preconditions | State/replay/failure; beneficiary if wrong |
|---|---|---|---|---|
| `initialize_sale` | creator; creator, sale, creator token account, vault, treasury | sale `[sale, creator, mint]`; vault `[sale-vault, sale]`; treasury `[treasury, sale]`; legacy `Program<Token>` | Transfers `sale_supply`; supply > 0, minimum > 0, cap >= minimum, wallet cap > 0, start < end, `mint.supply == sale_supply`, authorities None, creator owns/account has supply | Initializes once because sale PDA uses `init`; failures roll back CPI/state. Wrong mint/owner/authority check would benefit a creator by minting/freezing or using non-full inventory. |
| `buy` | buyer; buyer, sale, position, treasury | unique position `[buyer-position, sale, buyer]`; sale `has_one = mint`; treasury seed/bump; buyer token account mint/owner | Native `contribution` to treasury; active status; `start <= now <= end`; positive; <= per-wallet cap | Position PDA makes repeat execution fail; checked totals. Wrong position/treasury constraint could divert principal; wrong destination check could lock buyer's token entitlement. |
| `finalize_sale` | arbitrary keeper; sale | No seed assertion, but `Account<Sale>` requires program ownership; no external destinations | No transfer; active and `now > end` | Status makes it one-shot. Failure before end/duplicate is atomic. Wrong condition could set terminal status early; keeper has no direct economic destination. |
| `claim` | buyer; sale, position, treasury, vault, destination token account | position seed includes buyer and stored sale/buyer; treasury/vault seeds; vault mint/authority/token-program; destination is stored account, mint, buyer-owned | Refund native and allocation token; only terminal; unclaimed | `claimed` is one-shot; state updated only if transfers succeed. Wrong destination constraints divert buyer assets. |
| `claim_for` | arbitrary caller; sale, position, treasury, vault, stored buyer account/token account | Same position/vault/treasury checks; buyer address and token account locked to position | Same as claim; caller pays fee and receives nothing | `claimed` prevents replay. Wrong stored-destination check lets caller steal refunds/tokens. |
| `withdraw_proceeds` | creator; sale, creator, treasury | `has_one = creator`; treasury seed/bump | Native creator proceeds only on success; reserve keeps rent + every unclaimed refund | bool blocks replay; failed/zero/double fails. Wrong reserve math benefits creator at refund claimants' expense. |
| `withdraw_inventory` | creator; sale, creator token account, vault | `has_one creator,mint`; creator account is stored account and owner/mint checked; vault canonical, legacy token program | All actual vault tokens to creator; terminal; success requires all positions claimed; vault >= tracked remainder | bool blocks replay. Wrong claim/remaining check lets creator steal unclaimed allocations. No close/admin/helper instructions exist. |

On-chain identity checked: `declare_id!`, `Anchor.toml`, target IDL and web IDL all name `8ZxnPLAfaSja6MrS6z21QZsohrW515v3cjXA3dMucnuX`. The target deploy keypair's public address was reported as matching, but was not opened during this audit.

# D. On-Chain Trust Model

| Claim | Classification | Evidence/qualification |
|---|---|---|
| Fixed total supply | PROVEN ON-CHAIN | initialization requires legacy mint supply equal sale supply and both authorities None (`initialize_sale.rs:22-25,72-79`). |
| Freeze authority removed | PROVEN ON-CHAIN | initialization rejects a non-None freeze authority. |
| 100% supply enters vault | PROVEN ON-CHAIN | creator balance must be at least mint supply, which equals sale supply; transfer runs in same transaction. |
| Launch terms immutable | NOT TRUE | State has no mutator in current source, but the live upgrade authority can change bytecode and state rules. |
| Creator cannot remove inventory early | PROVEN ON-CHAIN, conditional on current bytecode | terminal status and successful-sale all-claims gate (`withdraw_inventory.rs:38-57`). |
| Creator cannot receive more than accepted raise | PROVEN ON-CHAIN, conditional on current bytecode | stored `min(T,H)` and refund-reserve checks. |
| Buyer cannot receive more than deterministic allocation | PROVEN ON-CHAIN, conditional on current bytecode | stored prefix and unique claimed position. |
| Failed buyers recover principal | PROVEN ON-CHAIN, conditional on current bytecode | full contribution returned by claim/claim_for; requires a settlement transaction and a solvent chain. |
| Failed creator recovers inventory | PROVEN ON-CHAIN, conditional on current bytecode | creator may use terminal withdrawal after failure. |
| Successful claims persist indefinitely | PROVEN ON-CHAIN, conditional on current bytecode | no claim expiry; this also can indefinitely prevent inventory cleanup. |
| Fair per person | NOT TRUE | cap is one contribution per public key only; Sybil identities are unrestricted. |
| Trustless/non-custodial | NOT TRUE | upgrade key can install arbitrary code; current code is non-custodial only relative to the upgrade controller. |

The live program is executable, owned by `BPFLoaderUpgradeab1e11111111111111111111111`, ProgramData `5o5tLKFmG2SvXtJunuUyQq26CCvLHZwVyJraYd6vC2Uv`, deployment slot `25717062`, and has active authority `Eyp6QgYij5Pe4ngcxe9yxttsQzUCMCvBGHrn97p9pSAc`. An upgrade could add a transfer from vault/treasury, bypass terminal gates, or change settlement; it cannot retroactively change SPL mint authorities, but it can control escrowed assets held by the program. No claim of immutable terms, trustlessness, or strong creator/buyer protection is supportable while that authority remains.

# E. Security Findings

| ID | Type | Evidence / affected files | Concrete scenario and tests | Fix before submission? |
|---|---|---|---|---|
| FB-01 | TRUST MODEL | Live Cookie ProgramData authority above; `DEPLOYMENT_REPORT.md:141` deployed with `--upgrade-authority` | Authority upgrades program after deposits and drains treasury/vault. Existing tests cannot prove absence of a future upgrade. | **Yes for claims of trustlessness/immutable terms or real public funds.** |
| FB-02 | SECURITY LOW | No source-level direct asset theft found; all asset instructions/constraints table above | Current-code arbitrary account substitution, token-program substitution, replay, and redirection attempts are guarded. This is a bounded positive finding, not an audit certification. | No. |
| FB-03 | LIVENESS | `withdraw_inventory.rs:45-50`; `state.rs:24-25` | One successful-sale buyer can retain claim forever. Their allocation is correctly protected, but all unsold/token-floor dust and donated vault tokens remain locked until that buyer settles. `claim_for` can help only when the stored token account remains usable. | No for demo; document. |
| FB-04 | PRODUCT LIMITATION | `buy.rs:14-29`; `launch-page.tsx:440` | “Per wallet” is technically correct but not anti-Sybil. A participant splits across wallets to exceed the intended person-level allocation. | No; qualify everywhere. |
| FB-05 | DOCUMENTATION | `SECURITY_REVIEW.md` calls itself a security review and says gate pass; source lacks external audit | A reader may mistake internal testing/review for an external audit. No formal external audit occurred. | Yes if public language uses “audited” or implies certification. |
| FB-13 | DEPLOYMENT BLOCKER | No `.git` worktree or history exists; `rust-toolchain.toml` is `stable`; README says `anchor build` rather than required v0 | The required source snapshot cannot be made and a third party cannot identify/reproduce the deployed artifact from a source revision. | **Yes.** |
| FB-14 | BOUNTY COMPLIANCE | No public URL/repository URL/X thread/Telegram evidence anywhere in tracked-readable project materials | Core operational bounty requirements cannot be verified or submitted from the current state. | **Yes.** |
| FB-15 | PRODUCT BLOCKER | `web/MANUAL_QA.md` proves a failed finalization only; supplied facts expressly say successful oversubscribed web flow is not proven | The intended buyer/creator value proposition has not been demonstrated through the actual product. | **Yes before claiming completion.** |
| FB-16 | PRODUCT LIMITATION | No pool, swap, DEX, Cookiebox, or CookieSwap call in `web/` or program; see Architecture | A successful buyer receives a token with no FairBake-provided path to use/trade it. | No if scope is explicitly distribution. |
| FB-17 | COMPETITIVE WEAKNESS | `launch-page.tsx:204-207` hides the settlement explanation; no successful web demo/public URL | Judges may see an Anchor primitive rather than an end-to-end Cookie cApp. | No for safety; yes for a winner case. |

No integer overflow/underflow was found in the current economic path: state additions/subtractions use checked arithmetic and multiplication uses `u128`. Clock boundaries are asymmetric by design: buy accepts `now == end_time`; finalization requires `now > end_time`. Treasury donations cannot alter settlement and are not recoverable by the donor; token donations are returnable only at cleanup. Legacy `Program<Token>` rejects Token-2022 and prevents transfer-fee/hooks semantics.

# F. Economic Invariants

Let `c_i` be a contribution, `p_i` its stored total before contribution, `T = sum c_i`, `H = hard_cap`, and `S = sale_supply`.

* Failure: `T < minimum_raise`; accepted/proceeds/allocation = 0; refund_i = c_i.
* Success with `T <= H`: accepted_i = c_i, refund_i = 0, allocation_i = floor(c_i*S/H).
* Success with `T > H`: `accepted_i = floor((p_i+c_i)H/T) - floor(p_iH/T)`; refund_i = `c_i - accepted_i`; allocation_i = `floor(accepted_i*S/H)`.
* `sum accepted_i = H` in oversubscription because prefix terms telescope; otherwise `sum accepted_i = T`. Therefore `sum refunds = T - min(T,H)` and equals the stored refund reserve.
* `creator_proceeds = min(T,H)`. Hence, for tracked funds, `sum contributions = creator_proceeds + sum refunds` exactly. Native refund dust is zero.
* `sum allocations <= S`; `S - sum allocations` is unsold inventory plus integer token dust. Token dust is bounded by less than one base unit per buyer for the per-position floor, but total remaining inventory can also include the deliberately unsold portion below cap and donated sale-mint tokens.

Claim order cannot alter results because each position stores `committed_before`; creator withdrawal does not alter settlement. Buyer **contribution order**, however, affects which individual receives a rounding unit under the prefix formula. It is deterministic but not anonymous/order-independent at base-unit granularity. Exact cap has no native refund; one lamport over cap returns exactly one lamport collectively. `u64` state and `u128` products cover maximum arithmetic widths.

Rust and JS implement the same prefix formulas (`math.rs:57-114`, `web/src/lib/settlement.ts:3-22`) with arbitrary precision `bigint` in JS. UI estimates deliberately model the new contribution as last; transactions ordered differently or followed by additional buys can make that preview stale. There is no programmatic maximum buyer count beyond account/rent/compute/network practical limits; the 2–100-buyer randomized tests do not establish production scale.

# G. Lifecycle / Liveness Findings

State machine: initialization -> upcoming -> active/funding -> ended/unfinalized -> permissionless success or failure -> claims -> successful creator proceeds (independent) -> inventory cleanup -> terminal flags. Zero-buyer sales fail after permissionless finalization; a missing creator cannot block buyer claims/finalization; a missing buyer cannot block proceeds but blocks successful inventory cleanup; a missing finalizer leaves value locked until any wallet calls finalization.

`claim_for` improves recovery but requires the stored destination token account. A closed, frozen-by-an-external-actor (not possible under accepted mint configuration), or otherwise unavailable stored token account can make a position unclaimable; legacy owners normally control whether their token account stays open. Donated lamports remain in the treasury with no withdrawal path; donated sale-mint tokens return to the creator only at inventory cleanup. The full inventory of the observed failed sale was successfully withdrawn, which is good failed-path evidence only.

# H. Frontend / Wallet Findings

| ID | Type | Evidence / consequence | Covered? | Fix before submission? |
|---|---|---|---|---|
| FB-06 | UX BLOCKER | `wallet.tsx:319-356,575-612`; legacy non-Nightly wallets are accepted when they report no genesis, and Nightly integration relies on undocumented/variable injected shapes (`any`). Network verification is strong for Nightly, weaker for other wallets. | Manual failed-sale path only. | Yes for advertised multi-wallet support; otherwise restrict copy to verified Nightly. |
| FB-07 | UX DEBT | `transactions.ts:26-67`; confirm uses `confirmed`, errors after RPC submission do not retain/re-query a signature | A slow confirmation/blockhash expiry can show error after a broadcast transaction; retry may hit an already-created position or duplicate intent. | No automated browser recovery test. | Yes before a public funds demo. |
| FB-08 | DEMO WEAKNESS | `launch-page.tsx:204-207` hides core “fixed price / pro-rata / refund” text; activity is state counters, not transaction history | Mechanism exists but judge sees it weakly. | Screenshot/manual only. | No. |
| FB-09 | UX DEBT | `launch-page.tsx:698-705` shows “Mint authority REMOVED / Freeze authority REMOVED / Terms LOCKED” as unconditional presentation | It is valid for initialized legacy sales under current program, but fails to disclose upgradeability and does not independently inspect mint at render time. | No. | Yes for truthful security language. |

Wallet state is persisted by wallet name/address, not keys. Explicit disconnect clears those keys. Account changes use Wallet Standard events. The reported refresh, Nightly network, direct listener, and hidden saleSupply bugs appear addressed in source, but manual browser verification after refresh/navigation with Nightly was explicitly not completed. No duplicate-click global mutex exists beyond per-page `busy` state.

# I. Token Creation Reliability

`createMintAccount` is transaction 1. It generates an in-memory keypair and creates/initializes a mint with the wallet as both authorities (`transactions.ts:61-69`). Transaction 2 creates the ATA if needed, mints the full supply, then revokes mint and freeze authority atomically (`transactions.ts:71-84`). The second transaction is internally atomic; the overall flow is not.

| ID | Type | Evidence / scenario | Covered? | Fix before another E2E? |
|---|---|---|---|---|
| FB-10 | CORRECTNESS BLOCKER | `create-flow.tsx:59-79,198-220` persists recovery state only after React state effects; mint keypair is never persisted. A refresh/crash/RPC ambiguity after transaction 1 can leave a real mint with active authorities but no durable mint address/signature visible to the user. QA2's missing mint/signature is consistent with failure before submission or lost client state; source cannot distinguish them. | No E2E recovery test. | **Yes.** |
| FB-11 | UX BLOCKER | `send()` returns only after confirmation and discards transaction/signature state on a post-submit confirmation error | Wallet approval then RPC timeout/slow confirmation gives no recovery screen. A retry can safely fail atomically in many cases, but users cannot know the actual state. | No. | **Yes.** |
| FB-12 | PRODUCT LIMITATION | Name/symbol inputs (`create-flow.tsx:529-559`) never produce token metadata | New tokens have no on-chain name/symbol/image; UI may display mint fallback and external venues have no reliable identity. | No. | No for contract E2E; yes for a polished launch claim. |

The flow can leave a partial mint lifecycle (transaction 1 succeeded, transaction 2 did not). It cannot leave transaction-2 half-revoked because all its instructions are one transaction. Existing-mint validation correctly requires legacy SPL, authorities None, and full connected-owner balance. A user can safely retry only if the durable local operation record survives and corresponds to the right mint; it has no chain reconciliation or transaction-status recovery.

# J. Deployment / Reproducibility

Live evidence: the deployed address is correct and the v0 artifact currently at `target/deploy/fairbake.so` is 297,016 bytes, SHA-256 `F8AF968DEC65A8591B5E2ACC3A453A2772534E3C4CEAD1ED476A6FA0E50C1464`. Reported environment: WSL Rust/Cargo 1.98.1, Solana 4.1.2, Anchor 1.2.0, platform tools v1.57; build `anchor build --arch v0`; deploy used `--no-auto-extend`. `rust-toolchain.toml` instead says unpinned `stable`, while Cargo declares rust-version 1.89.0. The artifact was not reproducibly rebuilt/byte-compared here.

Classification: **NOT REPRODUCIBLE** as deployed. There is no Git commit/history, toolchain is not fully pinned, the build command in root README says `anchor build` rather than required v0, the deploy key/signing environment is not in source, and no deterministic artifact comparison exists. The source/Anchor/IDL identities match; that is identity consistency, not binary provenance.

# K. Test Coverage Reality

| Risk / invariant | Evidence | Test type | Missing adversarial case |
|---|---|---|---|
| Prefix/pro-rata, widths, exact cap | `math.rs:117-269` | 10 pure deterministic/random tests | property generator beyond 100 buyers; individual rounding-order fairness analysis |
| Escrow, failed/success claims, reserve solvency | `test_initialize.rs:401-740` | LiteSVM | deployed v0 bytecode equivalence |
| boundaries, caps, substitution, duplicate/replay | `test_initialize.rs:741-1222,1418-1549` | LiteSVM | malicious wallet/RPC retry and program-upgrade threat |
| donation and missing buyer liveness | `test_initialize.rs:1223-1417` | LiteSVM | closed stored ATA / permanent token-dust recovery |
| Cookie successful full lifecycle | `DEPLOYMENT_REPORT.md:154-214` | controlled CLI runtime evidence | browser product path and latest deployed code binary provenance |
| browser Wallet/Nightly/finalize | `web/MANUAL_QA.md` | manual, failed sale only | success oversubscription, refresh mid-operation, rejection, timeout, QA2 recovery |

The test harness loads `target/deploy/fairbake.so` (`test_initialize.rs:17-21`), so it tests a local artifact, not a proof that the live v0 ProgramData bytes came from current source. This audit reran `cargo test --workspace --all-targets --offline` with the local Windows Rust 1.96 toolchain: all 10 math/property and 11 LiteSVM tests passed (21/21). That result is current-source evidence, but not deployed-v0 binary provenance; the reported WSL deployment environment was Rust 1.98.1.

# L. Product Completeness

A creator can make a legacy SPL mint, issue its full supply, revoke authorities, define a time/cap/minimum/per-wallet sale, escrow it, then withdraw proceeds or terminal inventory. A buyer can connect, make exactly one wallet-bound commitment, wait for finalization, and claim allocation/refund. After successful settlement, the product stops at token distribution. It does not create a liquidity pool, trading venue, price feed, market, Cookiebox/CookieSwap integration, or metadata.

“Fair token sale / distribution protocol” is accurate. “Launchpad” is qualified at best: it launches a distribution, not a tradeable market. Lack of liquidity can be a deliberate V1 boundary, but it leaves the user workflow economically incomplete and makes the product's post-sale value proposition weak.

# M. Bounty Compliance

| Requirement | Status | Evidence |
|---|---|---|
| Meaningful Cookie interaction / deployed program | TECHNICALLY COMPLETE | deployed v0 program and real failed lifecycle evidence |
| Nightly support / confirmation feedback | TECHNICALLY COMPLETE, narrowly | real Nightly failed-finalize path; source uses Cookie sign-then-submit |
| Application data/activity | TECHNICALLY COMPLETE | direct RPC reads and launch views |
| Successful oversubscribed web E2E | NOT YET DONE | explicitly unresolved; CLI report is not browser-product proof |
| Public web application / public URL | BROKEN | no URL in source/docs/config reports |
| Open-source repository / frozen commit | BROKEN | no `.git` repository exists |
| Comprehensive current README | BROKEN | root README says no frontend/production integrations and omits v0 deployment/public product use |
| Wallet address shown | TECHNICALLY COMPLETE | wallet UI exists, though live browser proof limited |
| X demo/thread / Cookie Telegram sharing | NOT YET DONE | no materials/evidence in repository |

# N. Demo Strength

The mathematical demonstration is a real strength: a 133.33% oversubscribed sale can show exact capped creator proceeds, deterministic allocation, and refunds. The contract and historical CLI runtime report evidence this mechanism. The current UX displays demand, subscription, participants, state, personal position and claim values, but does not make the full before/after accounting prominent; its pro-rata explanation is hidden, activity has no transaction-level narrative, and successful buyer browser evidence does not exist.

# O. Competitive Weaknesses

| Dimension | Classification | Evidence |
|---|---|---|
| Immediate human motivation | UNPROVEN | no public app/demo URL; sale mechanics need explanation before felt benefit |
| Visible blockchain necessity | PROVEN STRENGTH | escrow, immutable-on-current-code accounting, public commitments, permissionless settlement are chain-native |
| Memorable demo moment | UNPROVEN | intended oversubscription/refund moment has not worked through the real web product |
| Depth beyond standard launcher | PROVEN STRENGTH | full-supply authority revocation plus prefix settlement/refund reserve is substantive |
| Intentional polish | UNPROVEN | screenshot/build reports exist, but public flow and error recovery are incomplete |
| Complete economic loop | MATERIAL WEAKNESS | no liquidity/trading/metadata outcome |
| Judge recall | MATERIAL WEAKNESS | without public URL, successful web E2E, and a crisp visible settlement, it resembles an engineering primitive more than a finished cApp |

# P. Remit / Sluice Test

**Are we repeating Remit? Yes, materially.** Evidence: the protocol primitive and local/CLI E2E are deeper than the creator/buyer end-to-end product workflow. The user cannot reliably recover token creation, a successful user flow is not browser-proven, no liquidity exists, and no public app is supplied.

**Are we repeating Sluice? Yes, in a narrower sense.** Evidence: extensive internal reports, screenshots, LiteSVM tests, and UI refinements coexist with unresolved competitive ceiling items: public deployment, successful browser demo, workflow recovery, and post-sale utility. The issue is not that engineering was wasted; it is that it has not yet become a defensible complete submission.

# Q. Must-Fix Before Another E2E

1. Establish an actual Git repository, validate ignores, and make the required immutable source snapshot without the deploy key/build artifacts.
2. Resolve the upgrade-authority trust decision before inviting any real user funds; do not claim immutable/trustless/non-custodial while it remains active.
3. Add a durable, chain-reconciled token-creation operation record and recovery UX for every transaction state; prove QA2 root cause.
4. Prove the full successful oversubscribed browser flow with Nightly: create -> two buyers -> finalize -> refund + allocations -> creator proceeds -> refetch/reload recovery.
5. Publish the actual application/repository and meet the bounty communication requirements.

# R. Can-Wait Until After Submission

* Multiple contribution support, sale/position close and rent reclamation, relaunch design, and a claim deadline/abandoned inventory policy.
* Token-2022 support. Rejecting it is correct V1 behavior.
* Liquidity/CookieSwap integration only if the submission narrows its label to distribution protocol; it remains a competitive limitation.
* Cosmetic changes, metadata display polish, and more screenshots.

# S. Kill Conditions

Stop accepting real buyer funds if any of these remain true: active upgrade authority is undisclosed; token creation cannot deterministically recover a submitted transaction; a successful oversubscribed browser flow is not actually confirmed; source cannot be frozen in version control; or public materials call the project audited, trustless, rug-proof, immutable, decentralized, per-person fair, or a complete launchpad without qualification.

# T. Final Recommendation

STOP — CURRENT ARCHITECTURE HAS A MATERIAL BLOCKER

MUST FIX BEFORE NEXT E2E:
active upgrade-authority trust decision/disclosure; Git snapshot; durable token-creation transaction recovery; successful oversubscribed Nightly browser E2E.

DO NOT SPEND TIME ON:
cosmetics, additional screenshots, Token-2022, multi-deposit support, relaunch/account-close work, or liquidity integrations before the blockers and product proof close.

THE SINGLE MOST IMPORTANT UNPROVEN THING:
that a real user can complete and recover the successful oversubscribed FairBake flow through the web product, end to end, without creating ambiguous or lost token state.
