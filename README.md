# FairBake

FairBake is a fixed-window token sale and distribution protocol built for Cookie Chain.

Creators escrow a fixed token supply into a sale with a defined start time, end time, minimum raise, hard cap, and per-wallet contribution limit. Buyers contribute COOK during the sale window. If demand exceeds the hard cap, FairBake settles contributions pro-rata and refunds excess COOK. If the minimum raise is not met, buyers can reclaim their full contribution.

## Current deployment

- **Live app:** https://fairbake.vercel.app/
- **Network:** Cookie Chain
- **Program ID:** `8ZxnPLAfaSja6MrS6z21QZsohrW515v3cjXA3dMucnuX`
- **Cookie RPC:** `https://rpc.cookiescan.io`
- **Explorer:** `https://cookiescan.io`

The web app uses Nightly Wallet through Wallet Standard and submits signed transactions to Cookie RPC.

## What FairBake supports

- create a new fixed-supply legacy SPL token or use an existing compatible mint;
- escrow 100% of the selected fixed supply into a canonical FairBake sale vault;
- lock the sale's economic parameters after creation;
- one contribution per wallet with an enforced wallet cap;
- permissionless sale finalization after the contribution window closes;
- deterministic pro-rata settlement when demand exceeds the hard cap;
- excess COOK refunds on oversubscribed successful sales;
- full buyer refunds when the minimum raise is not met;
- buyer token claims and refunds after settlement;
- creator withdrawal of successful sale proceeds;
- terminal recovery of remaining sale tokens when liabilities allow it;
- durable browser recovery for interrupted token setup and sale creation.

## Sale lifecycle

1. **Create** — the creator chooses a token and sale parameters. Creating the sale escrows 100% of the configured token supply.
2. **Contribute** — buyers contribute COOK during the fixed window.
3. **Close and settle** — after the deadline, any compatible Cookie wallet may finalize the sale.
4. **Claim** — successful buyers claim tokens and any excess COOK refund; failed-sale buyers reclaim their full COOK contribution.
5. **Withdraw** — the creator can withdraw sale proceeds after successful settlement.

For an oversubscribed sale, settlement uses cumulative-floor arithmetic so the accepted COOK total and token allocations remain deterministic across buyers.

## Recovery

FairBake persists only public operation metadata in the browser for recovery. It does not persist private keys, seed phrases, wallet objects, or signed transaction bytes.

For sale creation, the expected Sale PDA is deterministic. If the browser reloads after submission, FairBake reconciles the expected PDA and transaction state before allowing another attempt, preventing blind duplicate submissions.

## Trust and security notes

FairBake has undergone internal adversarial review and automated testing, including real Cookie browser lifecycle testing. It has **not** received a formal external security audit.

The deployed FairBake program is currently **upgradeable**. Sale parameters are locked under the deployed program logic, but the program itself is not immutable.

V1 intentionally supports the standard legacy SPL Token Program only; Token-2022 is rejected.

## Known V1 constraints

- one canonical Sale PDA per creator + mint;
- one contribution per wallet;
- legacy SPL tokens only;
- no built-in liquidity provisioning or trading;
- no automatic keeper — finalization is permissionless but must be triggered by a transaction;
- token name/symbol entered during new-token setup are application labels; FairBake does not currently create a separate on-chain token metadata account.

## Repository layout

- `programs/fairbake/` — Anchor program
- `web/` — Next.js frontend
- `web/src/idl/fairbake.json` — frontend copy of the deployed program interface
- historical `*_REPORT.md` / audit files — engineering snapshots from earlier build and review stages; this README describes the current release state

## Frontend

```bash
cd web
npm install
npm run dev
```

The frontend defaults to the deployed Cookie RPC and FairBake program listed above.

Verification:

```bash
cd web
npm test
npx tsc --noEmit
npm run build
```

## Program build and test

The recorded deployment environment used:

- Anchor CLI 1.2.0
- Solana CLI 4.1.2
- Rust/Cargo 1.98.1
- v0 build target

From the repository root in the supported Linux/WSL environment:

```bash
anchor build --arch v0
anchor test
```

Cookie deployment required the v0-compatible build and `--no-auto-extend`. The repository does not claim deterministic byte-for-byte build reproducibility.

## License

MIT — see `LICENSE`.
