# FairBake V1 web

The FairBake frontend is a Next.js App Router app that reads Sale and BuyerPosition accounts directly from Cookie Chain.

## Run locally

```powershell
cd web
npm install
npm run sync-idl
npm run dev
```

Open `http://localhost:3000`.

The default configuration uses:

- Cookie RPC: `https://rpc.cookiescan.io`
- FairBake program: `8ZxnPLAfaSja6MrS6z21QZsohrW515v3cjXA3dMucnuX`
- Explorer: `https://cookiescan.io`

Override these with the variables in `.env.example` if required. No private key or server signer is used by the web app.

## IDL synchronization

`npm run sync-idl` copies the authoritative `target/idl/fairbake.json` into `src/idl/fairbake.json`. Run it after rebuilding the Anchor program so the client cannot silently drift from the deployed interface.

## Verification

```powershell
npx tsc --noEmit
npm run build
```
