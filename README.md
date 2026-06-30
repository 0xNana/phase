# Phase

Phase is a fullstack confidential token distribution app for the Zama Developer Program Season 3 TokenOps bounty.

The product goal is simple: teams can distribute ERC-7984 confidential tokens while recipients privately reveal their own allocation and observers verify activity without seeing who received what.

## What is scaffolded

- `frontend/` - Next.js app with admin, recipient, observer, and cUSDC faucet flows.
- `frontend/app/api/` - campaign and claim-payload API routes for the demo backend.
- `contracts/` - Hardhat package kept for legacy contract experiments; the main app flow does not require it.
- `internal-docs/special-bounty.md` - bounty requirements and submission notes.
- `index.html` - earlier static UX prototype kept as a design artifact.

## Core claim flow

1. Admin creates a private claim distribution backed by a TokenOps confidential airdrop clone on Sepolia.
2. Admin uploads a CSV with `address,amount`.
3. Phase encrypts each amount with TokenOps `encryptUint64`, binding the proof to the recipient address.
4. Admin signs each claim authorization using TokenOps EIP-712 helpers.
5. Recipient opens `/claim/[campaignId]`, receives only their payload, calls `getClaimAmount`, signs Zama user decrypt, sees their amount, then claims.
6. Observer opens `/observer/[campaignId]` and sees campaign activity, proof status, and sealed amounts.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Sepolia setup

Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_RPC_URL=
NEXT_PUBLIC_DEFAULT_CONFIDENTIAL_TOKEN=
NEXT_PUBLIC_CUSDC_TOKEN_ADDRESS=
NEXT_PUBLIC_CUSDC_FAUCET_ADDRESS=
```

The app defaults to the deployed Sepolia cUSDC demo token and `Get cUSDC` faucet. Override `NEXT_PUBLIC_CUSDC_TOKEN_ADDRESS` or `NEXT_PUBLIC_CUSDC_FAUCET_ADDRESS` only if you redeploy them. The TokenOps SDK resolves the Sepolia confidential airdrop factory automatically. Set `NEXT_PUBLIC_TOKENOPS_FACTORY_ADDRESS` only if using a custom factory.

## Supabase setup

Campaign metadata, claim payloads, and vesting records are stored in Supabase (server-side only).

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Add env vars locally in `frontend/.env.local` and on Vercel:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

The frontend also accepts `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for local/demo projects. Prefer `SUPABASE_SERVICE_ROLE_KEY` on deployed server runtimes when Row Level Security is enabled.

## Contracts

The main app flow does not depend on a registry contract. TokenOps handles the confidential claim-distribution lifecycle on Sepolia.

The `contracts/` package is retained for legacy/reference work, but it is not part of the recommended bounty path.

## Hackathon checklist

- Working dApp deployed on a website.
- TokenOps SDK used for confidential claim distribution setup, encrypted claim payloads, reveal, and claim.
- ERC-7984 confidential token address configured for Sepolia.
- Recipient reveal flow shows a real user-decrypt lifecycle, not a fake read.
- Observer view demonstrates proof activity without plaintext allocations.
- 3-minute real-person demo video.
- X article or thread introducing Phase.
