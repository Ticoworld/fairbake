# Funding Verification

## Current build/provenance note

The Cookie-compatible build command is `anchor build --arch v0`. Deployment
requires `--no-auto-extend`. The recorded deployment environment is Anchor
1.2.0, Solana 4.1.2, platform-tools v1.57, and Rust/Cargo 1.98.1. These
records document the compatible workflow; they do not claim deterministic
binary reproducibility.

- Deployer: `Eyp6QgYij5Pe4ngcxe9yxttsQzUCMCvBGHrn97p9pSAc`.
- Cookie RPC: `https://rpc.cookiescan.io`.
- Cookie balance before operations: `10.000000000 COOK` (`10,000,000,000` lamports).
- Funding check passed; the balance exceeded the 4.0 COOK deployment gate.
- Pre-deploy balance context slot: `25715054`; current slot observed: `25715056`.
- The configured signer resolved to the verified deployer. Private key material was not printed or read into the report.

# Native COOK Smoke Test

- Result: PASS.
- A controlled transfer of `0.001 COOK` reached temporary recipient
  `6VsqtQo6fwxrotuJNMjm738UZTDfKvsqw9JGrxAhZae7`.
- The transaction was finalized with no error; recipient balance was
  `1,000,000` lamports and the transaction was queryable through Cookie RPC.

# Standard SPL Smoke Test

- Result: PASS using the legacy SPL Token Program only:
  `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`.
- Test mint: `3SpbQwPhYP7bULWnqFgP5S2C98njBrV1WiKMMXmTj3U9` (6 decimals).
- Source token account: `FYYpdP8sNd8d7qL7MeFLXW46itEbrSqv1G9ghTja3v7S`.
- Controlled recipient token account: `6GAb8BbLM5En6C4oQDU7BQ4YyKVFFaXGGhWrhrtueFbj`.
- Minted 100 test tokens, transferred 1 token, and observed source `99` and
  recipient `1`.
- Final mint query proved mint authority `None` and freeze authority `None`.
- Token-2022 was not used.

# Local Regression Gate

- `cargo fmt --all -- --check`: PASS.
- `anchor build`: PASS.
- `cargo test --workspace --all-targets`: PASS, 21 passed, 0 failed
  (10 math/property tests and 11 LiteSVM integration tests).

# Program Identity

- Expected FairBake program ID:
  `8ZxnPLAfaSja6MrS6z21QZsohrW515v3cjXA3dMucnuX`.
- Source `declare_id!`, `Anchor.toml`, `anchor keys list`, existing deploy
  keypair public address, and generated IDL address all matched exactly.
- No program keypair was generated and no program ID was changed.

# Deployment

- Artifact: `target/deploy/fairbake.so`.
- Artifact size: `280,712` bytes.
- Attempted with the existing FairBake program identity and existing signer
  against `https://rpc.cookiescan.io`.
- Result: FAIL before transaction submission. Cookie rejected the artifact
  with: `ELF error: Detected sbpf_version required by the executable which are not enabled`.
- No feature-verification bypass was used.
- No deployment signature was produced and no deployment funds were consumed.

# On-Chain Verification

- FairBake address checked: `8ZxnPLAfaSja6MrS6z21QZsohrW515v3cjXA3dMucnuX`.
- Result: no program account exists on Cookie after the failed attempt;
  therefore executable, loader ownership, and deployed-code verification are
  not applicable.

# Successful Sale E2E

NOT RUN. Deployment was blocked by Cookie loader compatibility before a sale
could be created. No sale, escrow, buyer, finalize, claim, refund, or creator
withdrawal transactions were submitted.

# Failed Sale E2E

NOT RUN. Deployment was blocked before the real-network FairBake lifecycle.

# Transaction Signatures

Native COOK smoke:

- `aixuMfgmorwPuFQwHZ6pbNVmb2JTyCPMZPSoM9CDzCLKUqnGKcvzAwjT52fq5zq7FnqzFL1qk65Mar472uhBvfo`

Standard SPL smoke:

- Mint creation: `4jhAmGHKKfv7oRZCAHCxhqgkhzAtcfjD3RX1A2V2htau2jXaPV3GSbENEgtpu5GxjRTAbDkUwzQiV8DeidAQBNcB`
- Source account creation: `2K4cFCpf6GnrdCHPEV1YGTb8EApLYYk7aCVqZfyKZSMCnZuwSCHEQRtUCw8evKUKBf5kovZX9Yj4ud8g13jaUoM1`
- Destination account creation: `3ze5idjK4Y6ah8YsdXkbdy57yD2dRkM37hJ5V6pHLVvwoZQJhsTUq2mw1kJG9HfxgmZ9VC73ykQdvyxxvriPjHX`
- Mint: `ub877XzNkC152LaQrgXNqsv7eraYwKYNWd38TgxB2tu8FGZFzX37DScwQJv8PSqkzKTgPasMXPkrz8Ujc8PhSk4`
- Transfer: `3Ajnz9YVu2zsS1TZoGhQtD5yJfRUaqL3pzHnHiBxWaRvea6Ddtj5bWtTdjhZAGv4JemPsWDThFSeDtPFxWQSGEvo`
- Mint-authority revoke: `2U7QvBWQ3FujmJ5tZspgQFBPjsfc3pCGrR34q3K1ofhezQED6PSim5MXVebmmMf6zQYkqzEJSUPijhZLggGr839j`
- Freeze-authority revoke: `5sGQME77bCTCojmGhFweXLpJWu3gXihogB3LH3gG5UnoA8gQGQi4D75K9Y1J4vtQuxVyLzJ3co45FtoSyjbSEUuc`

FairBake deployment: none.

# Final Wallet Balance

- Deployer Cookie balance after smoke tests and failed pre-submission deploy:
  `9.993414840 COOK` (`9,993,414,840` lamports).
- No FairBake deployment rent was charged.

# Runtime Findings

- Native Cookie transfer and standard legacy SPL behavior passed on the live
  runtime.
- The compiled FairBake artifact was not accepted by Cookie's live loader:
  the required `sbpf_version` is not enabled.
- This is a deployment/runtime compatibility blocker, not a newly discovered
  FairBake economic or security finding.

# Remaining Risks

- FairBake is not deployed and has no real Cookie E2E evidence.
- A Cookie-compatible build/toolchain or confirmed Cookie loader support for
  the required sBPF version is needed.
- Do not bypass the verifier with `--skip-feature-verify` without confirmed
  runtime evidence and an independently verified compatible artifact.

# Final Verdict

FAIRBAKE COOKIE DEPLOYMENT FAIL

# Cookie sBPF Compatibility

The original rejected artifact was preserved at
`target/deploy/fairbake-sbpfv3-rejected.so` before rebuilding.

- Rejected artifact size: `280,712` bytes.
- Rejected SHA-256: `C777B4A8E713F07EE0DC0539FC4ABD49A047CB40A499F0C1FEFBE462482A4BB8`.
- ELF inspection: Linux BPF/eBPF, `Flags: 0x3`, CPU Version `3`.
- Cookie rejection: `ELF error: Detected sbpf_version required by the executable which are not enabled`.
- `anchor build --help` confirmed `--arch <ARCH>` and `--tools-version <TOOLS_VERSION>`.
- Compatible command used: `anchor build --arch v0`.
- `--tools-version v1.57` was not separately required; Anchor 1.2.0 reported
  platform-tools `v1.57` as its default.
- Corrected artifact size: `297,016` bytes.
- Corrected SHA-256: `F8AF968DEC65A8591B5E2ACC3A453A2772534E3C4CEAD1ED476A6FA0E50C1464`.
- Corrected ELF inspection: unknown machine `0x107` (Cookie-compatible v0
  artifact), `Flags: 0x0`; it no longer carries the rejected SBPFv3 CPU flag.
- `--no-auto-extend` support was confirmed with `solana program deploy --help`
  and used because Cookie's loader rejects the newer auto-extension path.

# Current Deployment

- Exact command:
  `solana program deploy target/deploy/fairbake.so --url https://rpc.cookiescan.io --use-rpc --no-auto-extend --keypair /home/timot/.config/solana/agentproof-devnet.json --program-id target/deploy/fairbake-keypair.json --upgrade-authority /home/timot/.config/solana/agentproof-devnet.json --commitment finalized --output json`
- Balance before corrected deployment: `9.993414840 COOK`
  (`9,993,414,840` lamports).
- Peak v0 staging estimate from Cookie RPC: `4.136557680 COOK` plus fees.
- Final deployment signature:
  `473gKkMnnfUVdv4wCd6BU1DmPZctJftKMAXBuYBCBH1CLCDXDEyuKEmjDdwce7UgReZUyzs9qJ14QQx6LEg4xXz`
- Deployment transaction: confirmed with `err: null`, slot `25717062`.
- Deployment log: `Deployed program 8ZxnPLAfaSja6MrS6z21QZsohrW515v3cjXA3dMucnuX`.
- Program account: `8ZxnPLAfaSja6MrS6z21QZsohrW515v3cjXA3dMucnuX`.
- On-chain account: executable `true`, owner
  `BPFLoaderUpgradeab1e11111111111111111111111`, space `36` bytes.
- Intermediate CLI progress signature observed during deployment:
  `2PYP15kXiGBWePwYB2jZ22xqwFDadRh6Gn2c99Xw26PbWU6G`.

# On-Chain Verification

The deployed program address exactly matches the source declaration,
`Anchor.toml`, existing deploy keypair, `anchor keys list`, IDL address, and
the RPC program account. Cookie RPC retrieved the finalized deployment
transaction and executable program account successfully.

# Successful Sale E2E

PASS on Cookie with the v0 deployment and standard legacy SPL Token Program.

- Sale: `Cf7bcxjdcmy2Fm3zEfbaw6h3sLZKvnCp4PJypJC74erq`.
- Mint: `8iyNSg5BRo3q4SLWngWLiPd3i7jWgeEM7QaYrMHMh5Yq`.
- Vault: `A3Jctxm5KWpGdVvSUH3xAngZQaEi3xtcBHKHyj7RMtb5`.
- Treasury: `AcbaNYrcRM9MJcbkVLdCpfzqd1TT1VEs6dga6WAW5XUS`.
- Buyers: `94VfoirJwfms5iU8HQc6Da7fwLGxBZYFHcgyQThAdzY7`,
  `J8UukBNukPzjMAFCpfBvckvba5gBnJFMbyZGbrKEfDNh`,
  `GtSD6HyG9jWnAYbcHxJNpbHw9tvXxHa7momBYsDk5xKV`.
- Positions: `8cvujQ5CxXZKKukjfAXfH7mwzWGoTgRLMUjHef7p67jN`,
  `FiM21jSe1PQ7QvNobXUi9Hobgq5eNYoDhuj4AuMHZeo3`,
  `qeyKMDZES97Yz27fJBagLfysy6TmVKQ4qcdQnEL8pTt`.
- Total committed `1,500,000`; hard cap `1,000,000`; final accepted raise and
  creator proceeds `1,000,000`; refund reserve and refunds `500,000`.
- Buyer token balances after claims: `400`, `333`, `266`; vault remainder `1`.
- `native_refund_dust=0`, `claimed_buyer_count=3`, proceeds withdrawn, and no
  inventory withdrawal was attempted.

# Failed Sale E2E

PASS on Cookie.

- Sale: `DqYxG6MNuRrJLskW4yaF3RK4K1SBJWc2GH2FB1siPeEs`.
- Mint: `2FwKAmtjYs6vXFek2gwSNtFX92QxeTNkaPm2RScXDXxx`.
- Vault: `BhEri4K7vk5d6UGaRCzPXnvd5VERXrV3VbnB8JubNr6e`.
- Treasury: `3jZywxtzR93138x7W5z42hD6HSrVdCz92XJTpCkPbtJQ`.
- Total committed `100,000` below minimum `1,000,000`; creator proceeds and
  final accepted raise `0`; refund reserve/claimed `100,000`; token allocation
  `0`; vault retained all `1,000` tokens.

# Transaction Signatures — Corrected Deployment and E2E

- Deployment: `473gKkMnnfUVdv4wCd6BU1DmPZctJftKMAXBuYBCBH1CLCDXDEyuKEmjDdwce7UgReZUyzs9qJ14QQx6LEg4xXz`.
- Funding buyers: `5WWL5MSfDnM2YYf79hXi3WdJyA8cMFRoNCyngUrt5UJYMk83RgAeeRR78JFHGNsXaf7nh89UgweanFBquynfDnQV`.
- Successful mint setup: `SaJA9PLyo3JY5x8bkxVvXzaDaLCELY3FJmDXyBxS2tpSEFF9tURRR6PEQFAZocW7erUkLD8FHvm9oPLunbBWTD3`, `ntmZwQHpKjHnj2fjBEB4oBQHmnUU3JYPvJ6J9ChVJKc6BLRyfDEvi2NLya4JmajbVZRMk8RFvsFkTzXvSXrzsxB`, `55ryznGMgGwRfcPxSFEhDnB4qVZtaxmiBaFJsSRRGbSVNddGkiAhbfqFAHhi8hjXKmERhLR7V9N6yEVXnvkvKDMK`.
- Successful initialize: `Tmh7ePbkdvRZ3gMMUDkzJ996QjiJyXSUpXcRVB8VuwkaAk6dHRY6wW3B5t4FPpnfBTEZE7toeB2J3S3TE7A2kwE`.
- Successful buys: `5zt3DztgQ9EXMfkuZXMgwoVyLTcEiVBtDmXvTGVN6T9Whcg1fN7q5zf3eRDmTzuvesQcR8NJz29c45mEintrxMgQ`, `45csHBWUd6xQHjJQ1NDVm9tLRJY6EadJr1qVGvjgK8a2tT4wn4cyDVM2bQC6X2mtJCuU26PJ8BZNYijbpCrBR287`, `NeciMQ1mLcDbSybBBCg9rk5UbySSZwRFvqVqZtqzUTSZkWpufLHDfAZCiZYezxwqmp2KpWnPh84RMDcEnJHjqQU`.
- Successful finalize: `QDZugaKvxeugKeFdVhPwwq25swF3VDJxNKdtn8Hdgux2okzet7BjfEbxokWncY6eo8csjcUN73aM5DQXUhhJGgr`.
- Creator withdrawal: `5ynAQeaQ3op1FW4RL91Bjg1i1tKtyy6ZJSuoa8WkgFRbsEmwTZkwBUU1U7BQnXQNRHv3qSc3oVgsBg42PC4XyAVh`.
- `claim_for`: `53w3zPUNHsTJJYsPKbmAuz2G8PzdQiYgYzWPuNBdjGmBLFLK5W5kW2Gvij4QH8sk2nTDHHaa9bHoZ1sAiP9N1ndu`.
- Normal claims: `2o8JVNpivbnqRCzxyeFmVxybje5JAWRVQAPh6xqqkEn2U1WnbVvHbQXNrnpB6m5GFfWyKDuekeGcDjft6GJ4PZPG`, `3gCj2ogEJVmS8Z3dSycuLnPGtJxoy7RNwi9pSVBEsDRpoRps7BY8VcCW3NDVLxu49iyfPUg6wWnLnUKZiPidZnNM`.
- Failed mint setup: `4g4J77sy9xgqV8wckLgNgeMeEZyTVf8kmhsdKWxAiLeneNy4b4TtzhmzCziNqAfU2rKNkDrpcSzba5DgL6ismmC1`, `AwrtAnnr91yRjpMGN9QbNC3QaYrkEof1xUGRXBNC88FWmUsmEvBYQvZ29FGGfUYnpQd5JizNtiMhgE7rgnyfcnX`, `oJcvz1CqPeXpzrMtZRykjnkaq5qcrVrNTB7xFBaNLJa1DfQFjhDHJM8vyXr9fEW2cxb2TaLwEfJKBquMDuSj1Zk`.
- Failed initialize: `3kx3LiD9pFv13b8p3fNSoMyxNHNW3bnMFi8P8iEzcY4wW7rdrE6pwkwQuma9Zb7uA96jYsctGQBFEz4fetojq8bz`.
- Failed buy: `3PFWfABchzuVKCgR8rBbZ51TLM1x7xuRy4w73Dd4ANeRoE6e59YWV6hrUeVLcd7DjSca7Cy4ZvW7gJHhWSsyReCM`.
- Failed finalize: `3GSh6YG34UG7yuaQikLtAvmHztRNjihQaD7D2Y2MiFZHogd5wkYq1abbdGn9VEfWWoRv9ZxcQkUzDmopBNym2xEx`.
- Failed refund via `claim_for`: `2uQ1EqMDGPohDMBXLMgArsCvLXYg2SYP6oUVyMeuEp9dJbnZe2iPytoHz4HpPc1Lb1dYLCyLCZpDR8jYaBuWPiei`.

# Final Wallet Balance

- Final deployer balance: `7.686698840 COOK` (`7,686,698,840` lamports).
- The temporary buyer keypairs were in-memory controlled test wallets; no key
  material was printed or persisted.

# Runtime Findings

- Cookie rejected the original SBPFv3 artifact before any deployment
  transaction; the preserved evidence remains above.
- Cookie accepted and executed the rebuilt v0 artifact.
- No new CRITICAL, HIGH, or MEDIUM runtime/security issue was found.
- One discarded harness attempt used an invalid short window and received the
  expected `OutsideSaleWindow` error; the final rerun used chain-aligned time
  and a controlled 120-second window.

# Remaining Risks

- The final successful sale left one lamport-equivalent token unit in the
  vault because cumulative-floor allocation is intentionally conservative;
  inventory cleanup remains governed by the existing terminal-state rules.
- The historical Cookie WebSocket handshake caveat from the runtime report
  remains operationally relevant; the HTTP RPC path passed all checks.

# Final Verdict

FAIRBAKE COOKIE DEPLOYMENT PASS
