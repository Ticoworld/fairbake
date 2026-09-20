# Scope

This adversarial review covers the FairBake Anchor program under
`programs/fairbake`, including account constraints, PDA derivations,
lamport/token transfers, settlement arithmetic, terminal transitions, and the
full test suite. It does not cover frontend code, deployment infrastructure,
Cookie runtime behavior, or an independent formal audit.

# Architecture Reviewed

- Anchor 1.2.0 program using the standard SPL Token Program.
- Sale PDA: `[b"sale", creator, mint]`.
- Sale vault PDA: `[b"sale-vault", sale]`, controlled by the Sale PDA.
- Native treasury PDA: `[b"treasury", sale]`, with tracked-state accounting.
- BuyerPosition PDA: `[b"buyer-position", sale, buyer]`, one contribution per buyer.
- `claim_for` is permissionless, but destinations come only from BuyerPosition.

# Threat Model

Attackers may be buyers, arbitrary finalizers, token holders, or wallets
constructing instructions with substituted accounts. A creator may disappear.
Attackers may donate lamports or sale-mint tokens, replay instructions, choose
claim order, and cross-wire accounts from different sales. They cannot forge a
signer or make the Sale PDA sign an arbitrary token transfer.

# Findings

## M-01 - Creator proceeds delayed by an unclaimed buyer (FIXED)

- Severity: MEDIUM
- Status: FIXED
- Affected code: `finalize_sale.rs`, `withdraw_proceeds.rs`, and `claim.rs`.
- Previous impact: `withdraw_proceeds` required every BuyerPosition to be
  claimed, so one missing buyer could lock creator proceeds indefinitely.
- Fix: finalization stores `creator_proceeds` and `refund_reserve` once.
  Successful creator withdrawal pays exactly stored proceeds and preserves
  rent plus every remaining refund liability. It does not inspect claim
  counters. Buyer claims remain permanent and independent.
- Permissionless recovery: `claim_for` pays native value to the stored buyer
  and tokens to the stored buyer token account. It accepts no destination
  supplied by the caller.
- Regression tests: `one_unclaimed_buyer_does_not_block_creator_or_other_claims`
  and `claim_for_rejects_refund_and_token_destination_substitution`.

## M-02 - Donated sale-mint tokens stranded after cleanup (FIXED)

- Severity: MEDIUM
- Status: FIXED
- Terminal inventory cleanup checks the expected reserved balance and returns
  the entire actual vault balance, including donated sale-mint tokens, to the
  predefined creator token account.
- Regression test: `donated_sale_tokens_are_not_stranded_at_terminal_cleanup`.

## INFO-01 - Native rounding policy (DOCUMENTED)

Oversubscribed accepted native amounts use cumulative floors:
`floor((prefix + contribution) * H / T) - floor(prefix * H / T)`. The prefix
differences telescope to exactly `H`; refunds are exact complements. The
maximum native refund dust is therefore 0 lamports for this implementation,
within the general less-than-buyer-count floor bound. `native_refund_dust` is
stored separately and is zero. It is never creator proceeds.

Token allocations still floor each buyer's quotient. Token rounding dust is
bounded by buyer count and remains in the vault until terminal inventory
cleanup. It is not native buyer principal.

## LOW-01 - Local deploy keypair warning remains OPEN

Before deployment, reconcile the generated deploy keypair with the source
program ID and Anchor.toml, then independently verify the deployed address.
This is operational and no local economic-path exploit was found.

# Invariants Re-tested

- Mint and freeze authorities must both be revoked at initialization.
- Sale, vault, treasury, position, mint, token-account, and token-program
  substitutions are rejected by Anchor constraints.
- Tracked totals, not unsolicited treasury lamports, drive settlement.
- For every position, accepted plus refund equals contribution.
- Successful creator proceeds equal `min(total_committed, hard_cap)` and are
  invariant to claim order.
- After creator withdrawal and after every claim, treasury balance is at least
  rent plus remaining maximum tracked refund liability.
- Creator withdrawal has no effect on reserved token inventory.
- `claim_for` cannot redirect native value or tokens and duplicate claims fail.
- Failed sales refund full tracked contributions, distribute no tokens, and
  have no creator proceeds.
- Inventory cleanup remains blocked until successful-sale token liabilities are
  claimed; donated sale-mint tokens are not stranded at cleanup.

# Test Results

Commands executed in WSL2 Ubuntu:

```text
cargo fmt --all
anchor build
cargo test --workspace --all-targets
```

- 10 pure math/property tests passed.
- 11 LiteSVM adversarial integration tests passed.
- 21 tests passed, 0 failed.
- The two deterministic randomized math campaigns cover 19,800 settlement
  cases across 2-100 buyers, plus exact-cap, one-over-cap, claim-order, and
  max-width cases.
- No unresolved CRITICAL or HIGH finding was introduced.

# Residual Risks

- One contribution per buyer remains a deliberate spike limitation.
- There is intentionally no claim deadline or abandoned-position policy;
  buyer claims are permanent in this version.
- There is no account-close/recovery workflow for rent or terminal cleanup.
- This remains an engineering spike, not a formal verification or independent
  security audit.
- Cookie runtime compatibility and the local deploy-keypair warning required
  validation before deployment at the time of this review; current follow-up
  status is recorded below.

# Security Gate Verdict

SECURITY GATE PASS

# Independent Post-Liveness Review (2026-09-17)

This is an independent reread of the current source after the liveness patch,
not a restatement of the prior review. The review covered finalization,
creator proceeds, refund reserves, creator withdrawal, buyer claims,
permissionless `claim_for`, token liabilities, inventory cleanup, cumulative
floor settlement, terminal states, account constraints, and the complete
regression suite.

## M-01 Recheck - RESOLVED

`finalize_sale` snapshots `creator_proceeds` and `refund_reserve` exactly once.
`withdraw_proceeds` pays only stored accepted principal, requires rent plus all
remaining tracked refund liability, and does not inspect buyer claim order.
`claim_for` is permissionless but derives both value destinations from the
stored BuyerPosition. The liveness regression passed with one buyer left
unclaimed while the creator withdrew and another buyer claimed.

## Independent invariant results

- Creator proceeds are `min(total_committed, hard_cap)` on success and zero on
  failure; no actual treasury balance is used to calculate them.
- Creator withdrawal cannot consume tracked refund liability and cannot be
  repeated because `proceeds_withdrawn` is checked and set atomically.
- Buyer native refunds and token allocations cannot be redirected through
  `claim_for`; the stored buyer and stored buyer token account are constrained
  in the account context and checked again in `process_claim`.
- The caller of `claim_for` supplies no economic destination and pays the
  transaction fee. A buyer's own entitlement remains payable to that buyer.
- Successful token inventory remains reserved until every BuyerPosition is
  claimed. Cleanup checks the remaining tracked allocation against the actual
  vault balance before transferring the terminal balance.
- Failed sales store zero creator proceeds and distribute no tokens.
- Duplicate claims and duplicate `claim_for` calls fail through the persistent
  `claimed` flag; duplicate creator withdrawal fails through its persistent
  withdrawal flag.
- Stored `committed_before` values make claim order irrelevant. Cumulative
  floors telescope to the exact accepted native raise, so native refund dust is
  zero lamports.
- Unsolicited treasury lamports can create excess balance, but cannot change
  success/failure, creator proceeds, tracked refund reserve, or buyer payout
  math.

## Findings

No new CRITICAL, HIGH, or MEDIUM issue was identified. No implementation bug
was found, so no regression test or economic code change was required.

The prior M-02 donated-token cleanup finding remains FIXED. The prior LOW-01
deploy-keypair warning is operationally resolved: the deploy keypair public
address, `declare_id!`, `Anchor.toml`, `anchor keys list`, and IDL address all
match. The earlier finding is retained above for history; this section records
its current status.

## Fresh gate evidence

- `cargo fmt --all` and formatter check passed.
- `anchor build` passed.
- `cargo test --workspace --all-targets` passed: 21/21.
- Cookie HTTP RPC read-only preflight passed at runtime `4.1.2`.
- No FairBake deployment was attempted.
