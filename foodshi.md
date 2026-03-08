Here's a logical redevelopment plan, organized into phases with clean, incremental commits. I've corrected ordering issues from the original history (security baked in from the start, tests alongside code, no scattered config fixes).

---

## Phase 0: Project Scaffolding

| # | Commit Message | Scope |
|---|----------------|-------|
| 1 | `chore: initialize monorepo structure` | Root `package.json`, `.gitignore`, `README.md`, workspace dirs (`contracts/`, `backend/`, `frontend/`) |
| 2 | `chore: configure Hardhat for Polygon Amoy` | `contracts/hardhat.config.ts`, `contracts/package.json`, `.env.example` with Amoy RPC + explorer keys ΓÇö single testnet target from day one |
| 3 | `chore: initialize Express backend with TypeScript` | `backend/package.json`, `tsconfig.json`, `src/index.ts` (hello-world server on :3001) |
| 4 | `chore: initialize Next.js 14 frontend with Tailwind` | `npx create-next-app`, Tailwind config, base layout, `frontend/package.json` |

---

## Phase 1: Core Smart Contracts (bottom-up by dependency)

| # | Commit Message | Scope |
|---|----------------|-------|
| 5 | `feat(contracts): add ShareToken ERC-20 with emission cap` | `ShareToken.sol` ΓÇö 10M initial, 100M max, `EMISSION_ROLE` mint gate, burn support |
| 6 | `feat(contracts): add Treasury for slashed tokens and revenue` | `Treasury.sol` ΓÇö receives ETH + tokens, daily withdrawal limits, `GOVERNOR_ROLE` |
| 7 | `feat(contracts): add Staking with fraud strikes and slashing` | `Staking.sol` ΓÇö min stake, Super Donor tier, 3-strike slash to Treasury, `SLASHER_ROLE` |
| 8 | `feat(contracts): add EmissionPool with daily distribution` | `EmissionPool.sol` ΓÇö `recordPointsBatch()`, `finalizeDay()`, `claim()`, `exchangePoints()`, staking multiplier integration |
| 9 | `feat(contracts): add MedalNFT with tiered burn-to-mint` | `MedalNFT.sol` ΓÇö BronzeΓåÆPlatinum tiers, burns $SHARE via `burnFrom`, per-token IPFS URI, `MINTER_ROLE` |
| 10 | `feat(contracts): add shared interfaces` | `IShareToken.sol`, `IStaking.sol`, `ITreasury.sol` ΓÇö cross-contract typing |

---

## Phase 2: Contract Testing & Security

| # | Commit Message | Scope |
|---|----------------|-------|
| 11 | `test(contracts): add unit tests for ShareToken and Staking` | Hardhat/Vitest tests ΓÇö minting caps, role enforcement, stake/unstake, fraud strikes, slash math |
| 12 | `test(contracts): add unit tests for EmissionPool and MedalNFT` | Points recording, day finalization, proportional claims, medal eligibility, burn costs |
| 13 | `fix(contracts): harden against reentrancy and overflow edge cases` | CEI pattern enforcement, bounds checks, rate limits ΓÇö security baked in, not patched after |
| 14 | `feat(contracts): add deployment and role configuration scripts` | `deploy.ts` for each contract, `configureRoles.ts` to wire up ORACLE/SLASHER/MINTER/EMISSION roles, `verifyRoles.ts` sanity check |

---

## Phase 3: Backend ΓÇö Database & Auth

| # | Commit Message | Scope |
|---|----------------|-------|
| 15 | `feat(backend): add PostgreSQL schema and connection pool` | `schema.sql` (users, donations, karma_transactions, daily_points, etc.), `db/index.ts` pool config |
| 16 | `feat(backend): add JWT auth with signup, login, and wallet linking` | `routes/auth.ts`, bcrypt hashing, 7-day JWT, `/me` endpoint, `wallet_address` linking |
| 17 | `feat(backend): add Firebase Auth integration` | `lib/firebase.ts`, optional Firebase signup/login path alongside email/password |

---

## Phase 4: Backend ΓÇö Core Domain Logic

| # | Commit Message | Scope |
|---|----------------|-------|
| 18 | `feat(backend): add donation CRUD with GPS geofencing` | `routes/donations.ts`, `services/gps.ts` (Haversine, 100m radius), create/list/get/confirm/dispute/cancel |
| 19 | `feat(backend): add karma lifecycle service` | `services/karma.ts` ΓÇö `addPendingKarma`, `confirmKarma`, `cancelKarma`, `deductKarmaForExchange`, transaction logging |
| 20 | `feat(backend): add rewards routes and medal eligibility` | `routes/rewards.ts` ΓÇö karma balance/history, exchange karmaΓåÆ$SHARE, medal tier checks |
| 21 | `feat(backend): add social features (posts, likes, profiles)` | `routes/posts.ts`, `routes/users.ts`, feed, like/unlike |
| 22 | `feat(backend): add invitations and abuse reporting` | `routes/invitations.ts` (+50 karma bonus), `routes/reports.ts` |

---

## Phase 5: Backend ΓÇö Blockchain Integration

| # | Commit Message | Scope |
|---|----------------|-------|
| 23 | `feat(backend): add blockchain service with ethers.js` | `services/blockchain.ts` ΓÇö contract wrappers for token balance, staking info, `recordPointsOnChain`, `finalizeDay`, `mintMedal`, `addFraudStrike` |
| 24 | `feat(backend): add Pinata IPFS service for medal metadata` | `services/pinata.ts` ΓÇö image + JSON upload, CID generation |
| 25 | `feat(backend): add scheduled jobs (emission, challenges, sync)` | `jobs/scheduler.ts` ΓÇö midnight emission finalization, hourly challenge expiry, 6h point sync to chain |

---

## Phase 6: Backend Testing

| # | Commit Message | Scope |
|---|----------------|-------|
| 26 | `test(backend): add Vitest framework and backendΓåÆcontract tests` | Vitest config, integration tests for blockchain service against local Hardhat node |
| 27 | `test(backend): add API route tests for donations and rewards` | Auth flow, donation lifecycle, karma confirmation, exchange validation |

---

## Phase 7: Frontend ΓÇö Shell & Auth

| # | Commit Message | Scope |
|---|----------------|-------|
| 28 | `feat(frontend): add layout, navigation, and Zustand stores` | Root layout, sidebar, `useAuthStore` (persisted JWT), `useUIStore`, `useGeolocationStore` |
| 29 | `feat(frontend): add login and signup pages` | `login/page.tsx`, `signup/page.tsx` ΓÇö email/password + Firebase, invite code support |
| 30 | `feat(frontend): add wagmi/RainbowKit wallet connection` | `wagmi.ts` config (Polygon + Amoy), contract ABIs/addresses from env, `wallet/page.tsx` ΓÇö connect, stake, Super Donor activation |

---

## Phase 8: Frontend ΓÇö Core Features

| # | Commit Message | Scope |
|---|----------------|-------|
| 31 | `feat(frontend): add donation flow with browser GPS` | `donate/page.tsx` (create), `donations/page.tsx` (browse, confirm/dispute with geolocation) |
| 32 | `feat(frontend): add rewards page with karma exchange and medals` | `rewards/page.tsx` ΓÇö karma balance (confirmed + pending), exchange UI, medal tiers display, mint button |
| 33 | `feat(frontend): add social feed and user profiles` | `feed/page.tsx` (create post, like), `profile/[id]/page.tsx` (history, medals) |
| 34 | `feat(frontend): add landing page, leaderboard, and settings` | `page.tsx` (hero, how-it-works, stats), `leaderboard/page.tsx`, `settings/page.tsx` |

---

## Phase 9: Polish & Submission

| # | Commit Message | Scope |
|---|----------------|-------|
| 35 | `chore: add environment examples and deployment docs` | `.env.example` for all three workspaces, deployment notes |
| 36 | `chore: final cleanup and hackathon submission prep` | Remove dead code, verify all env vars, confirm testnet deployment works end-to-end |

---

### Key corrections from the original history

1. **Testnet configured once upfront** (commit 2) instead of scattered across 3 separate fix commits
2. **Contracts built bottom-up by dependency** ΓÇö ShareToken ΓåÆ Treasury ΓåÆ Staking ΓåÆ EmissionPool ΓåÆ MedalNFT, not all at once
3. **Security hardening during contract development** (commit 13), not as a post-hoc patch
4. **Tests alongside each layer**, not bolted on at the very end
5. **Backend built in domain layers** (DB ΓåÆ auth ΓåÆ donations ΓåÆ karma ΓåÆ blockchain) instead of one monolithic commit
6. **Frontend built shell-first** (layout/auth/wallet) then features, instead of a single dump
7. **36 commits vs 35 original**, but each one is atomic, compilable, and tells a clear story to hackathon judges reviewing git history