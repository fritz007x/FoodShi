# FOODSHI — Deployment Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 18 | `node --version` |
| npm | ≥ 9 | bundled with Node 18 |
| PostgreSQL | ≥ 14 | local or hosted (e.g. Supabase) |
| Test MATIC | — | get from [faucet.polygon.technology](https://faucet.polygon.technology) |

---

## 1 — Clone & install

```bash
git clone <repo-url> foodshi
cd foodshi
npm install          # installs all three workspaces
```

---

## 2 — Environment variables

```bash
cp .env.example .env
cp frontend/.env.local.example frontend/.env.local
```

Fill in every blank value:

| Variable | Where to get it |
|----------|----------------|
| `DATABASE_URL` | Local Postgres or hosted provider |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `INTERNAL_API_KEY` | `openssl rand -hex 32` |
| `PRIVATE_KEY` | Export from MetaMask (testnet wallet only) |
| `AMOY_RPC_URL` | [rpc-amoy.polygon.technology](https://rpc-amoy.polygon.technology) or Alchemy |
| `PINATA_JWT` | [app.pinata.cloud](https://app.pinata.cloud) → API Keys |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | [cloud.walletconnect.com](https://cloud.walletconnect.com) (free) |
| Firebase vars | Optional — only needed for Google login |

---

## 3 — Database

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE foodshi;"

# Apply schema
psql $DATABASE_URL -f backend/src/db/schema.sql
```

---

## 4 — Deploy smart contracts (Polygon Amoy testnet)

```bash
cd contracts

# Compile
npx hardhat compile

# Run tests against local Hardhat node
npx hardhat test

# Deploy to Amoy (requires test MATIC in your deployer wallet)
npx hardhat run scripts/deploy.ts --network amoy
```

The deploy script prints the five contract addresses. Copy them into your root `.env`:

```env
SHARE_TOKEN_ADDRESS=0x…
STAKING_ADDRESS=0x…
TREASURY_ADDRESS=0x…
MEDAL_NFT_ADDRESS=0x…
EMISSION_POOL_ADDRESS=0x…
EMISSION_POOL_RECEIVER_ADDRESS=0x…
```

And into `frontend/.env.local`:

```env
NEXT_PUBLIC_SHARE_TOKEN_ADDRESS=0x…
NEXT_PUBLIC_STAKING_ADDRESS=0x…
NEXT_PUBLIC_MEDAL_NFT_ADDRESS=0x…
NEXT_PUBLIC_EMISSION_POOL_ADDRESS=0x…
NEXT_PUBLIC_TREASURY_ADDRESS=0x…
```

### Optional: verify on PolygonScan

```bash
# Add POLYGONSCAN_API_KEY to .env first
npx hardhat verify --network amoy <CONTRACT_ADDRESS> <constructor args…>
```

---

## 5 — Chainlink CRE setup

FOODSHI uses a Chainlink Functions / CRE DON workflow that nightly calls the
backend's internal endpoint and records emission points on-chain.

1. Set `CRE_FORWARDER_ADDRESS` in `.env` to the DON forwarder address provided
   when you register the workflow in the Chainlink platform.
2. The forwarder address is baked into `EmissionPoolReceiver` at deploy time —
   if you change it you must redeploy `EmissionPoolReceiver`.
3. The DON workflow should call:

   ```
   GET https://<your-backend>/api/internal/daily-points?date=YYYY-MM-DD
   Authorization: Bearer <INTERNAL_API_KEY>
   ```

4. The response is fed into `EmissionPoolReceiver.onReport()`.

---

## 6 — Run in development

```bash
# Root — starts backend (:3001) and frontend (:3000) concurrently
npm run dev
```

Or separately:

```bash
npm run backend:dev    # ts-node-dev, hot reload
npm run frontend:dev   # Next.js dev server
```

---

## 7 — Run tests

```bash
# Backend unit + integration tests
cd backend && npx vitest

# Contract tests (Hardhat in-process node)
cd contracts && npx hardhat test
```

---

## 8 — Production build

```bash
# Backend — compiles TypeScript to dist/
cd backend && npm run build
node dist/index.js

# Frontend — Next.js static/SSR build
cd frontend && npm run build
npm run start
```

### Recommended hosting

| Layer | Option |
|-------|--------|
| Backend | Railway, Render, Fly.io |
| Frontend | Vercel (auto-detects Next.js) |
| Database | Supabase, Neon, or Railway Postgres |
| Contracts | Already on-chain — no hosting needed |

Set all env vars in your hosting provider's dashboard. For Vercel, the
`NEXT_PUBLIC_*` vars go in **Project → Settings → Environment Variables**.

---

## Troubleshooting

**`Missing required environment variable: PRIVATE_KEY`**
Hardhat requires `PRIVATE_KEY` even when running tests. Set a dummy value
(`0x0000…0001`) in `.env` when running tests without deploying.

**`Error: connect ECONNREFUSED 127.0.0.1:5432`**
PostgreSQL is not running. Start it with `pg_ctl start` or `brew services start postgresql`.

**RainbowKit modal doesn't open**
`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is missing or empty in `frontend/.env.local`.

**Karma not appearing after donation confirmation**
The nightly Chainlink CRE job hasn't run yet. Karma is credited to the DB
immediately; the on-chain emission happens at midnight UTC.
