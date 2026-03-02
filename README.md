# FOODSHI — Web3 Food Donation Platform

Turn surplus food into on-chain rewards. Donors list food, neighbours confirm
pickup via GPS, both earn **Karma Points** which exchange for **$SHARE** ERC-20
tokens. Hit donation milestones to mint **NFT medals** on Polygon Amoy.

---

## Project structure

```
foodshi/
├── contracts/          Solidity + Hardhat
│   ├── contracts/
│   │   ├── ShareToken.sol             ERC-20 (10 M initial, 100 M cap)
│   │   ├── EmissionPool.sol           Daily 1,000 $SHARE distribution
│   │   ├── EmissionPoolReceiver.sol   Chainlink CRE consumer
│   │   ├── MedalNFT.sol               ERC-721 Bronze/Silver/Gold/Platinum
│   │   ├── Staking.sol                Min-stake gate + fraud strikes
│   │   └── Treasury.sol               Daily withdrawal limits
│   └── scripts/deploy.ts
│
├── backend/            Express + TypeScript + PostgreSQL
│   └── src/
│       ├── db/schema.sql
│       ├── routes/      auth, users, donations, posts, rewards,
│       │                reports, invitations, internal
│       ├── services/    karma.ts
│       ├── lib/         blockchain.ts, pinata.ts, geo.ts, firebase.ts
│       ├── middleware/  auth.ts (JWT)
│       └── jobs/        scheduler.ts (midnight emission, hourly expiry)
│
├── frontend/           Next.js 14 + wagmi/RainbowKit
│   ├── app/
│   │   ├── page.tsx                  Landing page
│   │   ├── login/ signup/            Auth pages
│   │   ├── feed/                     Social feed
│   │   ├── donate/                   Create donation
│   │   ├── donations/[id]/           Donation detail + confirm
│   │   ├── rewards/                  Karma, exchange, medals
│   │   ├── leaderboard/
│   │   ├── profile/[id]/
│   │   └── settings/
│   ├── components/     Layout, Sidebar, ConnectWalletButton
│   └── lib/            wagmi.ts, api.ts, store.ts (Zustand)
│
└── docs/
    └── deployment.md   Step-by-step setup & deployment guide
```

---

## Key business rules

| Rule | Value |
|------|-------|
| Karma per confirmed donation | 100 pts (donor) + 50 pts (receiver) |
| Exchange rate | 10 karma = 1 $SHARE |
| Minimum exchange | 100 karma |
| GPS geofence (confirm) | 5 km Haversine |
| Challenge period | 24 h per listing |
| Fraud strikes before slash | 3 → 50 % stake to Treasury |
| Daily $SHARE emission | 1,000 $SHARE / day |
| Super Donor stake | 500 $SHARE → 1.5× multiplier |

### Medal tiers

| Tier | Days active | Donations | $SHARE burn |
|------|------------|-----------|-------------|
| Bronze | 30 | 20 | 50 |
| Silver | 90 | 70 | 150 |
| Gold | 180 | 150 | 300 |
| Platinum | 365 | 320 | 500 |

---

## Quick start

```bash
git clone <repo-url> foodshi && cd foodshi
npm install

cp .env.example .env                          # fill in all blank values
cp frontend/.env.local.example frontend/.env.local

# Apply DB schema
psql $DATABASE_URL -f backend/src/db/schema.sql

# Compile & deploy contracts (needs test MATIC)
cd contracts && npx hardhat compile
npx hardhat run scripts/deploy.ts --network amoy
cd ..

# Start backend (:3001) + frontend (:3000)
npm run dev
```

See **[docs/deployment.md](docs/deployment.md)** for the full guide including
Chainlink CRE setup, contract verification, and production hosting.

---

## API overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Login → JWT |
| POST | `/api/auth/link-wallet` | Link wallet address |
| GET | `/api/users/leaderboard` | Top donors by karma |
| GET | `/api/users/me` | Own full profile |
| PATCH | `/api/users/me` | Update name / bio / avatar |
| GET | `/api/users/:id` | Public profile |
| POST | `/api/donations` | Create donation listing |
| GET | `/api/donations` | List (filter by status) |
| POST | `/api/donations/:id/confirm` | GPS-gated pickup confirm |
| POST | `/api/donations/:id/dispute` | Flag donation |
| POST | `/api/donations/:id/cancel` | Donor cancels |
| GET | `/api/posts` | Paginated feed |
| POST | `/api/posts` | Publish post |
| POST | `/api/posts/:id/like` | Like (idempotent) |
| DELETE | `/api/posts/:id/like` | Unlike |
| GET | `/api/rewards/karma` | Balance + history |
| GET | `/api/rewards/medals` | Progress per tier |
| POST | `/api/rewards/exchange` | Karma → $SHARE request |
| GET | `/api/internal/daily-points` | Chainlink CRE endpoint |

---

## Tech stack

| Layer | Tech |
|-------|------|
| Contracts | Solidity ^0.8.20, Hardhat, OpenZeppelin, Chainlink CRE |
| Backend | Node.js 18, Express, TypeScript, PostgreSQL, ethers.js v6 |
| Frontend | Next.js 14, TailwindCSS, wagmi v2, RainbowKit v2, Zustand |
| Auth | JWT (7-day), optional Firebase |
| IPFS | Pinata (medal NFT metadata) |
| Network | Polygon Amoy testnet |

---

## License

MIT
