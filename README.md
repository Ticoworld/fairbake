# FairBake

FairBake is a fixed-window fair token launch proof. A creator deposits a fixed
SPL-token supply into a canonical FairBake vault; buyers commit native
lamports during an immutable sale window; permissionless finalization settles
either a successful fixed-price sale or a full-principal refund.

## Local prerequisites

The supported development environment for this spike is WSL2 Ubuntu on
Windows (Anchor development should run under Linux/WSL):

- Rust and Cargo 1.98.1 (deployment report environment)
- Solana CLI 4.1.2
- Anchor CLI 1.2.0
- Node.js 18.19.1 and npm 9.2.0

The program uses the standard SPL Token Program and local lamports. No
frontend or production integrations are included.

## Build and test

From WSL, in this directory:

```bash
export HOME=/home/timot
export PATH=/home/timot/.avm/bin:/home/timot/.cargo/bin:/home/timot/.local/share/solana/install/active_release/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
anchor build --arch v0
anchor test
```

Cookie deployment requires the v0-compatible build above and the deployment
flag `--no-auto-extend`. The recorded deployment environment is Anchor 1.2.0,
Solana 4.1.2, platform-tools v1.57, and Rust/Cargo 1.98.1. The repository
does not claim deterministic binary reproducibility; use the recorded source
commit and toolchain when reproducing the artifact.

Tests use LiteSVM clock controls, so sale deadlines are advanced without
waiting in real time.

## Architecture overview

Each sale has an immutable `Sale` PDA, a canonical token vault PDA owned by
the sale PDA, and a canonical native treasury PDA. Each buyer has one
`BuyerPosition` PDA keyed by sale and buyer; one deposit per buyer is used in
this proof, and the wallet cap is enforced on that deposit. Finalization is
permissionless after the deadline. Buyers claim from their stored position;
creator proceeds and remaining inventory have separate post-settlement
withdrawals.
