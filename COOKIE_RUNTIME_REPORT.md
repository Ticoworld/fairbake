# Local Environment

- Review date: 2026-09-17 (Africa/Lagos).
- Anchor CLI: `anchor-cli 1.2.0`.
- Solana CLI: `solana-cli 4.1.2`.
- Rust: `rustc 1.98.1`.
- Cargo: `cargo 1.98.1`.
- Node: `v24.10.0`.
- WSL2 Ubuntu was used for the Anchor/Rust gate.
- Formatter: `cargo fmt --all` and `cargo fmt --all -- --check` passed.
- Anchor build: `anchor build` passed.
- Test command: `cargo test --workspace --all-targets` passed.
- Test result: 10 math/property tests + 11 LiteSVM integration tests = 21 passed, 0 failed.
- No frontend or product features were built.
- No economic semantics or program identity were changed in this review.

# Post-Liveness Security Review

Fresh source review covered `finalize_sale`, creator proceeds, refund reserve,
creator withdrawal, buyer claim, `claim_for`, token liability, inventory
withdrawal, cumulative-floor settlement, terminal states, account constraints,
and the regression suite.

| Check | Result | Evidence |
|---|---|---|
| A. Creator proceeds cannot exceed accepted raise | PASS | Finalization stores `min(total_committed, hard_cap)`; withdrawal pays only the stored value. |
| B. Creator withdrawal cannot consume refund liability | PASS | Withdrawal reserves rent plus `refund_reserve - refund_claimed_total`. |
| C. Creator withdrawal is independent of claim order | PASS | Withdrawal does not inspect buyer positions or claim counters. |
| D. Buyer disappearance cannot block creator proceeds | PASS | `claim_for` is permissionless and proceeds are snapshotted at finalization. |
| E. Buyer entitlement does not expire or transfer to creator | PASS | Buyer positions have no deadline or creator fallback; claims are permanent. |
| F. `claim_for` cannot redirect native refund | PASS | `buyer` is constrained to `buyer_position.buyer`; refund destination is that account. |
| G. `claim_for` cannot redirect token allocation | PASS | Token destination is constrained to the stored `buyer_token_account`. |
| H. `claim_for` caller receives no participant value | PASS | Caller is only a signer; no caller-supplied economic destination exists. |
| I. Successful allocations remain token-backed after creator actions | PASS | Creator inventory withdrawal is blocked until all buyer positions claim; remaining vault balance is checked. |
| J. Failed sale creator proceeds are zero | PASS | Failed finalization explicitly stores zero proceeds and zero accepted raise. |
| K. Terminal inventory withdrawal cannot remove reserved inventory | PASS | Successful cleanup requires all positions claimed and checks `sale_supply - token_allocation_claimed`. |
| L. Unsolicited lamports do not affect sale math | PASS | Settlement and liabilities use tracked state; treasury balance is only checked for solvency. |
| M. Double creator withdrawal is impossible | PASS | `proceeds_withdrawn` is checked and set in the same instruction. |
| N. Double claim / `claim_for` is impossible | PASS | Buyer position PDA is unique and `claimed` is checked and set. |
| O. Claim order cannot change economic results | PASS | `committed_before` is stored at buy time and cumulative-floor settlement telescopes to the target accepted raise. |

The existing liveness regressions passed, including
`one_unclaimed_buyer_does_not_block_creator_or_other_claims` and
`claim_for_rejects_refund_and_token_destination_substitution`. No new
implementation bug was found, so no regression test or economic code change
was required.

Previous finding M-01 remains resolved. Previous M-02 remains resolved. The
prior operational keypair warning was independently rechecked and is resolved:
the deploy keypair public address, source ID, Anchor ID, and IDL ID all match.
No new CRITICAL, HIGH, or MEDIUM finding was identified.

# Program Identity

- Source `declare_id!`: `8ZxnPLAfaSja6MrS6z21QZsohrW515v3cjXA3dMucnuX`.
- `Anchor.toml` localnet ID: `8ZxnPLAfaSja6MrS6z21QZsohrW515v3cjXA3dMucnuX`.
- `anchor keys list`: same address.
- `target/deploy/fairbake-keypair.json` public address: same address (private key not inspected or printed).
- Generated IDL address: same address.
- Program identity result: PASS.
- No `anchor keys sync`, key generation, or ID change was performed.

# Cookie RPC Evidence

Official endpoints used:

- HTTP RPC: `https://rpc.cookiescan.io`
- Published WebSocket endpoint: `https://wss.cookiescan.io` in the official developer guide; the standard WebSocket scheme probe was `wss://wss.cookiescan.io`.

Read-only HTTP RPC evidence from the live Cookie endpoint:

- `getVersion`: Solana core `4.1.2`, feature set `3345198602`.
- Current slot at query: `25632365` (latest blockhash context slot `25632366`).
- Recent blockhash: `QCutuohDoqqPdGMvwa5ncL3ASfeFFeZGKi6GQxUWiVh`.
- Genesis hash: `9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2`.
- RPC result: PASS.

The WebSocket handshake did not complete (`non-101` / network error) for
`wss://wss.cookiescan.io`. FairBake uses ordinary HTTP RPC for its transaction
workflow and does not depend on subscriptions. This is recorded as an
operational endpoint risk, not as a FairBake runtime dependency.

# Cookie Runtime Version

Cookie reports Solana-compatible runtime version `4.1.2`, matching the local
Solana CLI expectation `4.1.2`. Official Cookie documentation describes the
network as SVM-compatible and supports standard Solana CLI, Anchor, and SDK
workflows. COOK uses 9-decimal lamport-style precision.

# Required Runtime Features

FairBake uses only:

- program-owned accounts and PDAs;
- native lamport transfers;
- the `Clock` sysvar;
- the standard SPL Token Program;
- PDA signing for token transfers; and
- checked integer arithmetic.

FairBake does not use the Associated Token Account program directly. It uses
explicit SPL token accounts. No Token-2022 CPI, custom sysvar, address lookup,
or newer runtime-specific feature is required.

The artifact is a valid ELF eBPF shared object with BPF machine type and CPU
version 3. Cookie’s live executable genesis programs are owned by
`BPFLoader2111111111111111111111111111111111`, and the Solana 4.1.2 CLI exposes
the standard upgradeable program deployment workflow. Loader acceptance was
not submitted as a write transaction because this task stops before deployment.

Compatibility result for FairBake’s declared surface: PASS, subject to the
funding gate and the WebSocket operational caveat above.

# Canonical Program Verification

Read-only `getAccountInfo` checks against the live Cookie RPC:

- SPL Token `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`: account exists, executable, owner `BPFLoader2111111111111111111111111111111111`.
- Associated Token Account `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`: account exists, executable, owner `BPFLoader2111111111111111111111111111111111`.
- Canonical verification result: PASS.

# SPL Smoke Test

Not run. The wallet has zero native COOK, so no mint, token account, minting,
transfer, or authority-revocation transaction was authorized. This is a clean
funding-gate stop; Token-2022 was not used as a workaround.

# Native COOK Smoke Test

Not run. The wallet has zero native COOK, so no native transfer was authorized.
The read-only balance query succeeded and Cookie's official documentation
confirms 9-decimal lamport-style precision.

# Program Artifact

- `.so`: `C:\\Users\\timot\\Desktop\\2026\\HACKATHON\\fairbake\\target\\deploy\\fairbake.so`
- `.so` size: `280,712` bytes.
- IDL: `C:\\Users\\timot\\Desktop\\2026\\HACKATHON\\fairbake\\target\\idl\\fairbake.json`
- IDL address matches the program ID above.

# Deployment Cost Estimate

Cookie RPC rent queries returned:

- Program account: 36 bytes, `1,141,440` lamports = `0.001141440` COOK.
- Program-data account: artifact size + 45 bytes = 280,757 bytes,
  `1,954,959,600` lamports = `1.954959600` COOK.
- Temporary write buffer at artifact size: 280,712 bytes,
  `1,954,646,400` lamports = `1.954646400` COOK.
- Persistent post-deploy rent: `1.956101040` COOK.
- Conservative peak staging requirement before temporary buffer reclaim:
  `3.910747440` COOK plus transaction fees. A practical target is about
  `4.0 COOK` to leave fee headroom.

This is an RPC-derived rent estimate, not the bounty's advertised price. No
FairBake deployment command was run.

# Wallet Funding Status

- Wallet: `Eyp6QgYij5Pe4ngcxe9yxttsQzUCMCvBGHrn97p9pSAc`.
- Current balance: `0` lamports = `0.000000000 COOK`.
- Estimated peak requirement: at least `3.910747440 COOK` plus fees.
- Approximate shortfall to the conservative target: `4.0 COOK`.
- Remaining balance after deployment: not applicable because deployment was
  not attempted; with the peak target funded, temporary buffer rent would be
  reclaimed and approximately `1.954646400 COOK` would remain before fees.
- No bridge or automatic funding action was taken.

# Compatibility Risks

- The live HTTP RPC, runtime version, canonical programs, loader evidence, and
  artifact format support the declared FairBake surface.
- The published Cookie WebSocket endpoint did not complete a standard
  WebSocket handshake in this environment. FairBake does not require WebSocket
  subscriptions for its on-chain instructions, but deployment tooling should
  retain an HTTP-only fallback or recheck the endpoint before use.
- No actual loader acceptance or SPL/native smoke transaction was performed;
  both require funded write access and are intentionally deferred.

# Pre-Deploy Security Checkpoint

- LOCAL SECURITY: PASS
- COOKIE RPC: PASS for the HTTP transaction/read path; WebSocket endpoint caveat recorded above.
- SPL TOKEN: PASS for canonical live-program verification; behavioral smoke deferred at the funding gate.
- NATIVE COOK: PASS for live balance/precision preflight; transfer smoke deferred at the funding gate.
- VERSION COMPATIBILITY: PASS
- PROGRAM ID: PASS
- DEPLOYMENT FUNDING: FAIL (wallet balance is zero)

# Transaction Signatures

None. This review produced no write transactions. Read-only RPC calls do not
have transaction signatures.

# Previous Preflight Verdict

# Funded Deployment Compatibility Recheck

The funded deployment workflow was rerun on 2026-09-17.

- Cookie funding gate: PASS. Initial balance was `10.000000000 COOK`.
- Native COOK smoke: PASS. A controlled `0.001 COOK` transfer finalized.
- Standard SPL smoke: PASS. Legacy Token Program mint, account creation,
  mint, transfer, mint-authority revoke, freeze-authority revoke, and final
  authority queries all passed. Token-2022 was not used.
- Local regression gate: PASS. Formatter, Anchor build, and all 21 tests
  passed with 0 failures.
- Program identity: PASS. Source, Anchor configuration, existing deploy
  keypair, and IDL all resolve to
  `8ZxnPLAfaSja6MrS6z21QZsohrW515v3cjXA3dMucnuX`.
- Artifact: `target/deploy/fairbake.so`, `280,712` bytes.

Deployment was attempted with the existing identity and signer, but Cookie
rejected the artifact before transaction submission:

`ELF error: Detected sbpf_version required by the executable which are not enabled`

No verifier bypass was used. No deployment signature was produced. A direct
post-failure RPC query confirmed that the FairBake program account does not
exist, and the deployer retained `9.993414840 COOK`.

This changes the deployment status from funding-ready to runtime-blocked. The
next required action is to produce or obtain a FairBake artifact compatible
with a Cookie-enabled sBPF version, then rerun the deployment gate. No real
FairBake E2E test was run and no security finding was added.

# Final Runtime Verdict

COOKIE RUNTIME FAIL

# Current v0 Compatibility and Runtime Validation

The previous SBPFv3 failure is historical evidence, not the current runtime
state. The rejected artifact was preserved as
`target/deploy/fairbake-sbpfv3-rejected.so` with SHA-256
`C777B4A8E713F07EE0DC0539FC4ABD49A047CB40A499F0C1FEFBE462482A4BB8`, ELF
CPU Version `3`, and size `280,712` bytes. Cookie rejected it before any
deployment transaction.

`anchor build --help` confirmed `--arch v0`; Anchor 1.2.0 reported
platform-tools `v1.57` as the default, so no separate tools pin was required.
The corrected command was `anchor build --arch v0`. The resulting artifact is
`297,016` bytes with SHA-256
`F8AF968DEC65A8591B5E2ACC3A453A2772534E3C4CEAD1ED476A6FA0E50C1464` and no
SBPFv3 CPU flag. `--no-auto-extend` was confirmed by CLI help and used for
deployment.

Cookie accepted the corrected artifact. Deployment signature:
`473gKkMnnfUVdv4wCd6BU1DmPZctJftKMAXBuYBCBH1CLCDXDEyuKEmjDdwce7UgReZUyzs9qJ14QQx6LEg4xXz`.
The exact program account
`8ZxnPLAfaSja6MrS6z21QZsohrW515v3cjXA3dMucnuX` exists, is executable, and
is owned by `BPFLoaderUpgradeab1e11111111111111111111111`.

Live Cookie E2E validation passed:

- Successful oversubscribed sale: `1,500,000` committed against a
  `1,000,000` cap; proceeds `1,000,000`; refunds `500,000`; native dust `0`;
  three claims completed; token allocations `400/333/266`; one token remained
  in the vault.
- Failed sale: `100,000` committed below the `1,000,000` minimum; proceeds `0`;
  full `100,000` refund completed through `claim_for`; no token allocation;
  all `1,000` tokens remained in escrow.

The final deployer balance was `7.686698840 COOK`. No new runtime security
finding was identified. The historical WebSocket handshake caveat remains an
operational note; the HTTP RPC path passed deployment and E2E validation.

# Final Runtime Verdict

COOKIE RUNTIME PASS — READY TO DEPLOY

Historical pre-v0 verdict: COOKIE PREFLIGHT PASS — FUNDING REQUIRED

# Current Final Runtime Verdict

COOKIE RUNTIME PASS — READY TO DEPLOY
