# FOODSHI - Web3 Food Donation Platform

A Web3 microblogging platform where users donate food, earn Karma Points, exchange them for $SHARE tokens, and mint NFT medals. Built on Polygon PoS with GPS geofencing for fraud prevention.

## Project Structure

```
foodshi/
├── contracts/          # Solidity smart contracts (Hardhat)
│   ├── contracts/
│   │   ├── ShareToken.sol     # ERC-20 token
│   │   ├── Treasury.sol       # Treasury management
│   │   ├── Staking.sol        # Token staking
│   │   ├── MedalNFT.sol       # ERC-721 medal NFTs
│   │   └── EmissionPool.sol   # Daily token distribution
│   ├── scripts/
│   │   └── deploy.ts          # Deployment script
│   └── test/
│       └── ShareToken.test.ts # Contract tests
│
├── backend/            # Express API server
│   └── src/
│       ├── index.ts           # Server entry point
│       ├── db/
│       │   ├── schema.sql     # PostgreSQL schema
│       │   └── index.ts       # Database connection
│       ├── routes/
│       │   ├── auth.ts        # Authentication
│       │   ├── users.ts       # User profiles
│       │   ├── donations.ts   # Donation management
│       │   ├── posts.ts       # Microblogging
│       │   ├── reports.ts     # Abuse reports
│       │   ├── rewards.ts     # Karma & tokens
│       │   ├── invitations.ts # User invitations
│       │   └── contributions.ts # Payments
│       ├── services/
│       │   ├── gps.ts         # GPS verification
│       │   ├── karma.ts       # Karma point logic
│       │   └── blockchain.ts  # Web3 integration
│       ├── middleware/
│       │   ├── auth.ts        # JWT authentication
│       │   └── errorHandler.ts
│       └── jobs/
│           └── scheduler.ts   # Background jobs
│
└── frontend/           # Next.js 14 application
    ├── app/
    │   ├── page.tsx           # Landing page
    │   ├── login/page.tsx     # Login
    │   ├── signup/page.tsx    # Signup
    │   ├── feed/page.tsx      # Social feed
    │   ├── donate/page.tsx    # Create donation
    │   ├── donations/page.tsx # Donation list
    │   ├── profile/[id]/page.tsx # User profile
    │   ├── rewards/page.tsx   # Karma & medals
    │   ├── wallet/page.tsx    # Web3 wallet
    │   ├── leaderboard/page.tsx
    │   └── settings/page.tsx
    ├── components/
    │   ├── Layout.tsx
    │   ├── PostCard.tsx
    │   └── DonationCard.tsx
    └── lib/
        ├── wagmi.ts           # Web3 config
        ├── api.ts             # API client
        ├── store.ts           # Zustand stores
        └── utils.ts           # Utilities
```

## Features

### Core Features
- **Food Donations** - Create donations with GPS verification
- **Microblogging** - Share stories, like posts
- **Karma Points** - Earn points for donations (10 points each)
- **$SHARE Tokens** - Exchange karma for ERC-20 tokens
- **NFT Medals** - Mint Bronze/Silver/Gold/Platinum medals

### Fraud Prevention
- GPS geofencing (100m radius)
- 3-day challenge period for disputes
- 3-strike slashing mechanism
- Staking requirements for withdrawals

### Medal Requirements
| Medal | Time | Donations | $SHARE Burn |
|-------|------|-----------|-------------|
| Bronze | 1 month | 20 | 50 |
| Silver | 3 months | 70 | 150 |
| Gold | 6 months | 150 | 300 |
| Platinum | 1 year | 320 | 500 |

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Set up the database:**
```bash
npm run backend:db:migrate
```

4. **Deploy smart contracts (testnet):**
```bash
cd contracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy.ts --network amoy
```

5. **Start development servers:**
```bash
npm run dev
```

This starts:
- Backend API: http://localhost:3001
- Frontend: http://localhost:3000

## Smart Contracts

### Contract Addresses (After Deployment)
Update `.env` with deployed addresses:
```
NEXT_PUBLIC_SHARE_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_STAKING_ADDRESS=0x...
NEXT_PUBLIC_MEDAL_NFT_ADDRESS=0x...
NEXT_PUBLIC_EMISSION_POOL_ADDRESS=0x...
NEXT_PUBLIC_TREASURY_ADDRESS=0x...
```

### Key Parameters
- Daily Emission: 1,000 $SHARE/day
- Exchange Rate: 10 Karma = 1 $SHARE
- Minimum Stake: 10 $SHARE (for withdrawals)
- Super Donor Stake: 500 $SHARE (1.5x multiplier)
- Challenge Period: 3 days
- Fraud Strikes: 3 before slashing (50%)

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user
- `POST /api/auth/wallet` - Link wallet

### Donations
- `POST /api/donations` - Create donation
- `GET /api/donations` - List donations
- `POST /api/donations/:id/confirm` - Confirm (GPS)
- `POST /api/donations/:id/dispute` - Dispute

### Posts
- `POST /api/posts` - Create post
- `GET /api/posts` - Feed
- `POST /api/posts/:id/like` - Like/unlike

### Rewards
- `GET /api/rewards/karma` - Karma balance
- `POST /api/rewards/exchange` - Exchange for tokens
- `GET /api/rewards/medals` - Medal eligibility
- `POST /api/rewards/medals/mint` - Mint medal NFT

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, TailwindCSS, wagmi/viem |
| Backend | Node.js, Express, PostgreSQL |
| Blockchain | Polygon PoS, Solidity, Hardhat |
| Auth | JWT, Firebase Auth (optional) |
| Web3 | RainbowKit, Privy/Web3Auth |

## License

MIT
