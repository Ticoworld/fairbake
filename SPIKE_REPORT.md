# Environment

- Windows host with WSL2 Ubuntu.
- WSL Rust 1.98.1, Solana CLI 4.1.2, Anchor CLI 1.2.0, Node.js 18.19.1.
- No Cookie deployment was performed.

# Implemented Instructions

- `initialize_sale` validates a fixed, authority-revoked SPL mint, creates the
  canonical vault and treasury, and escrows the exact sale supply.
- `buy` accepts one contribution per buyer during the immutable sale window.
  It records the contribution, its cumulative committed prefix, and the
  buyer's established sale-mint token account.
- `finalize_sale` is permissionless after the deadline. It stores terminal
  status, creator proceeds, refund reserve, and native dust exactly once.
- `claim` remains the buyer-signed path. `claim_for` is permissionless and
  economically identical, with destinations fixed by BuyerPosition.
- `withdraw_proceeds` is creator-only and success-only. It pays exactly stored
  creator proceeds immediately after finalization and preserves all remaining
  refund liability.
- `withdraw_inventory` remains terminal cleanup and cannot remove tokens still
  reserved for unclaimed successful-sale allocations.

# Account Model

- Sale PDA: `[b"sale", creator, mint]`.
- BuyerPosition PDA: `[b"buyer-position", sale, buyer]`; stores sale, buyer,
  buyer token account, contribution, cumulative prefix, and claimed flag.
- Sale token vault: `[b"sale-vault", sale]`, owned by the Sale PDA.
- Native treasury: `[b"treasury", sale]`; raw unsolicited lamports are not
  included in settlement math.

The one-deposit-per-buyer model is deliberate for this spike. Supporting
multiple deposits requires a separate accounting design.

# Economic Formulas

Let `c_i` be a tracked contribution, `T` total committed, `H` hard cap, and
`S` sale supply.

- Success iff `T >= minimum_raise`; otherwise the sale fails.
- On success: `creator_proceeds = min(T, H)` and
  `refund_reserve = T - creator_proceeds`.
- If `T <= H`: `accepted_i = c_i`, `refund_i = 0`.
- If `T > H`, with `p_i` the stored total before contribution `i`:
  `accepted_i = floor((p_i + c_i) * H / T) - floor(p_i * H / T)` and
  `refund_i = c_i - accepted_i`.
- Cumulative floors telescope to exactly `H`, so creator proceeds do not wait
  for claims and do not depend on claim order.
- `allocation_i = floor(accepted_i * S / H)` on success.
- On failure: creator proceeds and allocations are zero; refund is full
  contribution.

# Rounding and Liability Policy

Native refund dust is explicitly separate from creator proceeds. The
cumulative-floor policy makes its maximum possible value 0 lamports, within
the usual less-than-buyer-count floor bound. The stored `native_refund_dust`
is zero and cannot increase creator proceeds. Any future replacement with
independent per-buyer floors must reserve and prove its dust bound separately.

Token allocation floors can leave less than one base unit per buyer in the
vault. This token rounding dust, unsold inventory, and donated sale-mint
tokens remain separate from native proceeds and are returned only by terminal
inventory cleanup after successful buyer claims. The current version has no
claim deadline and does not forfeit any buyer entitlement.

After finalization, the native invariant is:

```text
treasury balance - rent >= remaining refund reserve
```

Creator withdrawal and every buyer claim enforce this invariant. Donations do
not change proceeds, refunds, sale success, or allocations.

# Tests

`cargo fmt --all`, `anchor build`, and
`cargo test --workspace --all-targets` passed.

- 10 pure math/property tests passed.
- 11 LiteSVM adversarial integration tests passed.
- 21 total tests passed, 0 failed.
- Randomized campaigns cover 19,800 deterministic settlement cases across
  2-100 buyers, with claim-order invariance and native-dust bound checks.
- Integration coverage includes missing buyers, immediate creator withdrawal,
  claim-for success/failure, refund and token destination substitution,
  duplicate withdrawal/claim-for, reserve solvency, unsolicited lamports,
  cross-sale substitution, and donated token cleanup.

# Resolved Finding

The previous MEDIUM liveness finding, creator proceeds being gated on every
buyer claim, is resolved. A missing buyer retains a permanent entitlement and
cannot block creator withdrawal or other buyer claims. No claim forfeiture or
deadline was added.

# Remaining Risks and Deployment Notes

- No formal verification or independent audit has been performed.
- The one-deposit-per-buyer limitation remains.
- Account cleanup and abandoned-position garbage collection remain separate
  future work.
- Cookie runtime compatibility and the local deploy-keypair warning must be
  validated before any deployment.

# Verdict

LIVENESS PATCH PASS
