# FOODSHI — Claude Code Context

## Project Overview

Web3 food donation platform on **Polygon Amoy testnet**. Users donate food, earn Karma Points, exchange them for `$SHARE` ERC-20 tokens, and mint NFT medals.

**Monorepo layout:**
```
contracts/   — Solidity + Hardhat
backend/     — Express + TypeScript + PostgreSQL
frontend/    — Next.js 14 + wagmi/RainbowKit
```

## Tech Stack

| Layer      | Tech                                                  |
|------------|-------------------------------------------------------|
| Contracts  | Solidity ^0.8.20, Hardhat, OpenZeppelin, Chainlink CRE|
| Backend    | Node.js, Express, TypeScript, PostgreSQL, ethers.js v6|
| Frontend   | Next.js 14, TailwindCSS, wagmi/viem, RainbowKit       |
| Auth       | JWT (7-day), optional Firebase                        |
| Testing    | Vitest, supertest (backend); Hardhat tests (contracts)|
| IPFS       | Pinata (medal NFT metadata)                           |

## Key Business Rules

- **Karma rate**: 10 points per confirmed donation
- **Exchange rate**: 10 karma = 1 $SHARE (min 100 karma per exchange)
- **GPS geofencing**: 100m radius Haversine check
- **Challenge period**: 3 days for disputes
- **Fraud strikes**: 3 strikes → 50% stake slashed to Treasury
- **Medal tiers** (mirror `MedalNFT.sol` constructor exactly):
  | Tier     | Days | Donations | $SHARE Burn |
  |----------|------|-----------|-------------|
  | Bronze   | 30   | 20        | 50          |
  | Silver   | 90   | 70        | 150         |
  | Gold     | 180  | 150       | 300         |
  | Platinum | 365  | 320       | 500         |
- **Staking**: min 10 $SHARE to withdraw; 500 $SHARE = Super Donor (1.5× multiplier)
- **Daily emission**: 1,000 $SHARE/day distributed via EmissionPool

## Important File Paths

### Backend
- `backend/src/db/index.ts` — `query`, `queryOne`, `transaction` DB helpers; pool config
- `backend/src/lib/blockchain.ts` — ethers.js v6 wrappers (note: `lib/`, not `services/`)
- `backend/src/lib/pinata.ts` — IPFS medal metadata upload
- `backend/src/middleware/auth.ts` — `verifyJWT` middleware; reads `JWT_SECRET`
- `backend/src/services/karma.ts` — `addPendingKarma`, `confirmKarma`, `cancelKarma`, `recordKarma`, `getKarmaHistory`, `getPendingEmissionPoints`, `markDaySynced`
- `backend/src/routes/rewards.ts` — Karma balance, medal eligibility, karma exchange
- `backend/src/routes/invitations.ts` — Invite flow with TOCTOU-safe `SELECT FOR UPDATE`
- `backend/src/routes/internal.ts` — Internal API for Chainlink CRE DON nodes (Bearer token auth)
- `backend/src/jobs/scheduler.ts` — Midnight emission finalization, hourly challenge expiry, 6h chain sync
- `backend/src/__tests__/rewards.test.ts` — Vitest tests; mocks `../db/index` and `../services/karma`

### Contracts
- `contracts/contracts/EmissionPool.sol` — `recordPointsBatch()`, `finalizeDay()`, `claim()`, `exchangePoints()`
- `contracts/contracts/EmissionPoolReceiver.sol` — Chainlink CRE consumer; only callable by immutable `forwarder`
- `contracts/contracts/MedalNFT.sol` — ERC-721; `canMintMedal()`, `mint()`, `setTokenMetadataURI()`
- `contracts/contracts/ShareToken.sol` — ERC-20; 10M initial, 100M max, `EMISSION_ROLE` mint gate
- `contracts/contracts/Staking.sol` — `getMultiplier()`, `isWithdrawalEligible()`, `addFraudStrike()`
- `contracts/contracts/Treasury.sol` — Daily withdrawal limits, `GOVERNOR_ROLE`

## Architecture Patterns

### DB access
Always use the typed helpers from `backend/src/db/index.ts`:
- `query<T>(sql, params)` → `T[]`
- `queryOne<T>(sql, params)` → `T | null`
- `transaction(async (client) => ...)` — wraps BEGIN/COMMIT/ROLLBACK automatically

For concurrent-safe operations, use `SELECT ... FOR UPDATE` inside `transaction()` (see invitations `/accept` route).

### Blockchain (ethers.js v6)
- Provider/signer are lazy-initialised singletons
- Contract instances are created per-call (not cached) — fine for read operations
- `mintMedal` holds `MINTER_ROLE`; Pinata upload failure throws but includes `{ txHash, tokenId }` for retry
- `listenForDayFinalized` subscribes to `DayFinalized` event and calls `markDaySynced(dayDate)`

### Chainlink CRE flow
DON nodes → `GET /api/internal/daily-points?date=YYYY-MM-DD` (INTERNAL_API_KEY bearer) → `EmissionPoolReceiver.onReport()` → `EmissionPool.recordPointsBatch()` + `finalizeDay()` → `DayFinalized` event → `markDaySynced` in DB

### Input validation
Use **Zod** for all route body/query validation. First error message is returned as `{ error: string }`.

### Security patterns already in place
- `timingSafeEqual` for internal API key comparison (`routes/internal.ts`)
- TOCTOU guard via `SELECT FOR UPDATE` in invitation accept
- Atomic karma deduction + exchange record via `transaction()`
- Constant-time auth, no timing oracle on API keys

## Environment Variables

```env
# Backend
DATABASE_URL=
JWT_SECRET=
INTERNAL_API_KEY=
AMOY_RPC_URL=
PRIVATE_KEY=                    # Backend wallet holding MINTER_ROLE
EMISSION_POOL_ADDRESS=
SHARE_TOKEN_ADDRESS=
MEDAL_NFT_ADDRESS=
STAKING_ADDRESS=
TREASURY_ADDRESS=
PINATA_JWT=

# Frontend (NEXT_PUBLIC_*)
NEXT_PUBLIC_SHARE_TOKEN_ADDRESS=
NEXT_PUBLIC_STAKING_ADDRESS=
NEXT_PUBLIC_MEDAL_NFT_ADDRESS=
NEXT_PUBLIC_EMISSION_POOL_ADDRESS=
NEXT_PUBLIC_TREASURY_ADDRESS=
```

## Development Workflow

```bash
# Install all workspaces
npm install

# Run backend tests
cd backend && npx vitest

# Compile contracts
cd contracts && npx hardhat compile

# Run contract tests
cd contracts && npx hardhat test

# Deploy to Amoy
cd contracts && npx hardhat run scripts/deploy.ts --network amoy

# Start dev servers (backend :3001, frontend :3000)
npm run dev
```

## Development Phase Status

Progress tracked in `foodshi.md`. Currently at **Phase 6 complete** (all backend + tests done).

Remaining:
- **Phase 7** — Frontend shell (layout, auth, wagmi/RainbowKit wallet)
- **Phase 8** — Frontend core features (donate, rewards, feed, leaderboard)
- **Phase 9** — Polish & submission

## Notes & Gotchas

- `blockchain.ts` lives in `lib/`, not `services/` — the README is wrong on this
- Medal eligibility check in `rewards.ts` is **off-chain only** (time + donation count). The on-chain burn cost is enforced by `MedalNFT.sol` when the user calls `mint()` from their wallet
- The backend does NOT call `EmissionPool.finalizeDay()` directly — that is done by `EmissionPoolReceiver.onReport()` triggered by Chainlink CRE
- `recordKarma` inside `transaction()` takes a `PoolClient` as first arg, not the pool helpers
- Exchange minimum is **100 karma** (enforced by Zod in `routes/rewards.ts`)
