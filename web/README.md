# FairBake web

The FairBake frontend is a Next.js App Router application for creating, discovering, and interacting with fixed-window FairBake sales on Cookie Chain.

## Run locally

```powershell
cd web
npm install
npm run dev
```

Open `http://localhost:3000`.

Default configuration:

- Cookie RPC: `https://rpc.cookiescan.io`
- FairBake program: `8ZxnPLAfaSja6MrS6z21QZsohrW515v3cjXA3dMucnuX`
- Explorer: `https://cookiescan.io`

No private key or server signer is used by the web app. Wallet signing is handled through Nightly Wallet / Wallet Standard.

## IDL synchronization

`npm run sync-idl` copies the authoritative generated FairBake IDL into `src/idl/fairbake.json` after a program rebuild.

## Verification

```powershell
npm test
npx tsc --noEmit
npm run build
```
