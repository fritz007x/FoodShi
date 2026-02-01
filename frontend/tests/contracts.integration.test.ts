/**
 * Frontend → Contracts Integration Tests
 *
 * These tests verify that the frontend can correctly interact with the smart contracts
 * using viem (the library wagmi uses under the hood). They test the same contract
 * interactions the frontend would perform.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  createTestClient,
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  getContract,
  type Address,
  type PublicClient,
  type WalletClient,
  type TestClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';

// Contract ABIs (matching frontend/lib/wagmi.ts)
const SHARE_TOKEN_ABI = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'burn',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'grantRole',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'EMISSION_ROLE',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    name: 'DAILY_EMISSION',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getAvailableEmission',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const STAKING_ABI = [
  {
    name: 'stake',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'unstake',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'activateSuperDonor',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'stakes',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'stakedAt', type: 'uint256' },
      { name: 'unlockTime', type: 'uint256' },
      { name: 'isSuperDonor', type: 'bool' },
      { name: 'fraudStrikes', type: 'uint8' },
    ],
  },
  {
    name: 'isWithdrawalEligible',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'isSuperDonor',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'getMultiplier',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getUnlockTimeRemaining',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'MINIMUM_STAKE',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'SUPER_DONOR_STAKE',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalStaked',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'grantRole',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'SLASHER_ROLE',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    name: 'addFraudStrike',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [],
  },
] as const;

const EMISSION_POOL_ABI = [
  {
    name: 'recordPoints',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'points', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'recordPointsBatch',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'users', type: 'address[]' },
      { name: 'points', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    name: 'exchangeRate',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getCurrentDay',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getUserPointBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getUserPoints',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'day', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'grantRole',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'ORACLE_ROLE',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
] as const;

const MEDAL_NFT_ABI = [
  {
    name: 'canMintMedal',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'tier', type: 'uint8' },
      { name: 'firstDonationTimestamp', type: 'uint256' },
      { name: 'confirmedDonations', type: 'uint256' },
    ],
    outputs: [
      { name: 'canMint', type: 'bool' },
      { name: 'reason', type: 'string' },
    ],
  },
  {
    name: 'getUserMedals',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256[4]' }],
  },
  {
    name: 'medalRequirements',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tier', type: 'uint8' }],
    outputs: [
      { name: 'minDays', type: 'uint256' },
      { name: 'minDonations', type: 'uint256' },
      { name: 'burnCost', type: 'uint256' },
    ],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
] as const;

const TREASURY_ABI = [
  {
    name: 'getTokenBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getETHBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'dailyWithdrawalLimit',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getRemainingDailyAllowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'grantRole',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'DEPOSITOR_ROLE',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
] as const;

// Contract deployment helper
async function deployContract(
  walletClient: WalletClient,
  publicClient: PublicClient,
  bytecode: `0x${string}`,
  abi: readonly unknown[],
  args: unknown[] = []
): Promise<Address> {
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args,
    account: walletClient.account!,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return receipt.contractAddress!;
}

// Test contract bytecodes (loaded from compiled artifacts)
let artifacts: {
  ShareToken: { abi: unknown[]; bytecode: `0x${string}` };
  Treasury: { abi: unknown[]; bytecode: `0x${string}` };
  Staking: { abi: unknown[]; bytecode: `0x${string}` };
  EmissionPool: { abi: unknown[]; bytecode: `0x${string}` };
  MedalNFT: { abi: unknown[]; bytecode: `0x${string}` };
};

// Contract addresses (set after deployment)
let shareTokenAddress: Address;
let treasuryAddress: Address;
let stakingAddress: Address;
let emissionPoolAddress: Address;
let medalNFTAddress: Address;

// Clients
let publicClient: PublicClient;
let walletClient: WalletClient;
let testClient: TestClient;

// Hardhat default accounts (well-known private keys for testing)
// These are the same accounts that Hardhat uses by default
const HARDHAT_ACCOUNTS = [
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
  '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
  '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
  '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
] as const;

const ownerAccount = privateKeyToAccount(HARDHAT_ACCOUNTS[0]);
const user1Account = privateKeyToAccount(HARDHAT_ACCOUNTS[1]);
const user2Account = privateKeyToAccount(HARDHAT_ACCOUNTS[2]);

let ownerAddress: Address;
let user1Address: Address;
let user2Address: Address;

// Load contract artifacts
async function loadArtifacts() {
  const fs = await import('fs');
  const path = await import('path');

  const artifactsDir = path.resolve(__dirname, '../../contracts/artifacts/contracts');

  artifacts = {
    ShareToken: JSON.parse(
      fs.readFileSync(path.join(artifactsDir, 'ShareToken.sol/ShareToken.json'), 'utf-8')
    ),
    Treasury: JSON.parse(
      fs.readFileSync(path.join(artifactsDir, 'Treasury.sol/Treasury.json'), 'utf-8')
    ),
    Staking: JSON.parse(
      fs.readFileSync(path.join(artifactsDir, 'Staking.sol/Staking.json'), 'utf-8')
    ),
    EmissionPool: JSON.parse(
      fs.readFileSync(path.join(artifactsDir, 'EmissionPool.sol/EmissionPool.json'), 'utf-8')
    ),
    MedalNFT: JSON.parse(
      fs.readFileSync(path.join(artifactsDir, 'MedalNFT.sol/MedalNFT.json'), 'utf-8')
    ),
  };
}

// Deploy all contracts
async function deployAllContracts() {
  // Deploy ShareToken
  shareTokenAddress = await deployContract(
    walletClient,
    publicClient,
    artifacts.ShareToken.bytecode as `0x${string}`,
    artifacts.ShareToken.abi
  );

  // Deploy Treasury
  treasuryAddress = await deployContract(
    walletClient,
    publicClient,
    artifacts.Treasury.bytecode as `0x${string}`,
    artifacts.Treasury.abi,
    [shareTokenAddress]
  );

  // Deploy Staking
  stakingAddress = await deployContract(
    walletClient,
    publicClient,
    artifacts.Staking.bytecode as `0x${string}`,
    artifacts.Staking.abi,
    [shareTokenAddress, treasuryAddress]
  );

  // Deploy EmissionPool
  emissionPoolAddress = await deployContract(
    walletClient,
    publicClient,
    artifacts.EmissionPool.bytecode as `0x${string}`,
    artifacts.EmissionPool.abi,
    [shareTokenAddress, stakingAddress]
  );

  // Deploy MedalNFT
  medalNFTAddress = await deployContract(
    walletClient,
    publicClient,
    artifacts.MedalNFT.bytecode as `0x${string}`,
    artifacts.MedalNFT.abi,
    [shareTokenAddress]
  );

  // Configure roles
  const shareToken = getContract({
    address: shareTokenAddress,
    abi: SHARE_TOKEN_ABI,
    client: { public: publicClient, wallet: walletClient },
  });

  const treasury = getContract({
    address: treasuryAddress,
    abi: TREASURY_ABI,
    client: { public: publicClient, wallet: walletClient },
  });

  // Grant EMISSION_ROLE to EmissionPool
  const emissionRole = await shareToken.read.EMISSION_ROLE();
  await shareToken.write.grantRole([emissionRole, emissionPoolAddress], {
    account: ownerAddress,
  });

  // Grant DEPOSITOR_ROLE to Staking
  const depositorRole = await treasury.read.DEPOSITOR_ROLE();
  await treasury.write.grantRole([depositorRole, stakingAddress], {
    account: ownerAddress,
  });
}

describe('Frontend → Contracts Integration Tests', () => {
  beforeAll(async () => {
    // Setup clients
    publicClient = createPublicClient({
      chain: hardhat,
      transport: http('http://127.0.0.1:8545'),
    });

    testClient = createTestClient({
      chain: hardhat,
      mode: 'hardhat',
      transport: http('http://127.0.0.1:8545'),
    });

    // Use known Hardhat accounts
    ownerAddress = ownerAccount.address;
    user1Address = user1Account.address;
    user2Address = user2Account.address;

    walletClient = createWalletClient({
      chain: hardhat,
      transport: http('http://127.0.0.1:8545'),
      account: ownerAccount,
    });

    // Load artifacts and deploy contracts
    await loadArtifacts();
    await deployAllContracts();
  });

  describe('ShareToken Contract', () => {
    it('should read token name and symbol', async () => {
      const shareToken = getContract({
        address: shareTokenAddress,
        abi: SHARE_TOKEN_ABI,
        client: publicClient,
      });

      const name = await shareToken.read.name();
      const symbol = await shareToken.read.symbol();

      expect(name).toBe('SHARE Token');
      expect(symbol).toBe('SHARE');
    });

    it('should read owner balance (initial supply)', async () => {
      const shareToken = getContract({
        address: shareTokenAddress,
        abi: SHARE_TOKEN_ABI,
        client: publicClient,
      });

      const balance = await shareToken.read.balanceOf([ownerAddress]);
      const balanceFormatted = formatEther(balance);

      expect(Number(balanceFormatted)).toBe(10_000_000); // 10 million initial supply
    });

    it('should transfer tokens to user', async () => {
      const shareToken = getContract({
        address: shareTokenAddress,
        abi: SHARE_TOKEN_ABI,
        client: { public: publicClient, wallet: walletClient },
      });

      const amount = parseEther('1000');
      await shareToken.write.transfer([user1Address, amount], {
        account: ownerAddress,
      });

      const balance = await shareToken.read.balanceOf([user1Address]);
      expect(balance).toBe(amount);
    });

    it('should read daily emission constant', async () => {
      const shareToken = getContract({
        address: shareTokenAddress,
        abi: SHARE_TOKEN_ABI,
        client: publicClient,
      });

      const dailyEmission = await shareToken.read.DAILY_EMISSION();
      expect(formatEther(dailyEmission)).toBe('1000');
    });

    it('should approve spender and read allowance', async () => {
      // Create wallet client for user1
      const user1WalletClient = createWalletClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
        account: user1Address,
      });

      const shareToken = getContract({
        address: shareTokenAddress,
        abi: SHARE_TOKEN_ABI,
        client: { public: publicClient, wallet: user1WalletClient },
      });

      const approveAmount = parseEther('500');
      await shareToken.write.approve([stakingAddress, approveAmount], {
        account: user1Address,
      });

      const allowance = await shareToken.read.allowance([user1Address, stakingAddress]);
      expect(allowance).toBe(approveAmount);
    });
  });

  describe('Staking Contract', () => {
    it('should read staking constants', async () => {
      const staking = getContract({
        address: stakingAddress,
        abi: STAKING_ABI,
        client: publicClient,
      });

      const minStake = await staking.read.MINIMUM_STAKE();
      const superDonorStake = await staking.read.SUPER_DONOR_STAKE();

      expect(formatEther(minStake)).toBe('10');
      expect(formatEther(superDonorStake)).toBe('500');
    });

    it('should stake tokens', async () => {
      // Transfer tokens to user2
      const shareToken = getContract({
        address: shareTokenAddress,
        abi: SHARE_TOKEN_ABI,
        client: { public: publicClient, wallet: walletClient },
      });
      await shareToken.write.transfer([user2Address, parseEther('100')], {
        account: ownerAddress,
      });

      // Create wallet client for user2
      const user2WalletClient = createWalletClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
        account: user2Address,
      });

      // Approve staking contract
      const shareTokenUser2 = getContract({
        address: shareTokenAddress,
        abi: SHARE_TOKEN_ABI,
        client: { public: publicClient, wallet: user2WalletClient },
      });
      await shareTokenUser2.write.approve([stakingAddress, parseEther('50')], {
        account: user2Address,
      });

      // Stake tokens
      const staking = getContract({
        address: stakingAddress,
        abi: STAKING_ABI,
        client: { public: publicClient, wallet: user2WalletClient },
      });
      await staking.write.stake([parseEther('50')], {
        account: user2Address,
      });

      // Verify stake
      const stakeInfo = await staking.read.stakes([user2Address]);
      expect(formatEther(stakeInfo[0])).toBe('50'); // amount
      expect(stakeInfo[3]).toBe(false); // isSuperDonor
    });

    it('should check withdrawal eligibility', async () => {
      const staking = getContract({
        address: stakingAddress,
        abi: STAKING_ABI,
        client: publicClient,
      });

      // User2 has 50 staked (>= 10 minimum)
      const eligible = await staking.read.isWithdrawalEligible([user2Address]);
      expect(eligible).toBe(true);

      // User1 has 0 staked
      const notEligible = await staking.read.isWithdrawalEligible([user1Address]);
      expect(notEligible).toBe(false);
    });

    it('should return correct multiplier', async () => {
      const staking = getContract({
        address: stakingAddress,
        abi: STAKING_ABI,
        client: publicClient,
      });

      // Regular user (not super donor) has 1x multiplier (100)
      const multiplier = await staking.read.getMultiplier([user2Address]);
      expect(Number(multiplier)).toBe(100);
    });

    it('should track total staked', async () => {
      const staking = getContract({
        address: stakingAddress,
        abi: STAKING_ABI,
        client: publicClient,
      });

      const totalStaked = await staking.read.totalStaked();
      expect(formatEther(totalStaked)).toBe('50');
    });
  });

  describe('EmissionPool Contract', () => {
    it('should read exchange rate', async () => {
      const emissionPool = getContract({
        address: emissionPoolAddress,
        abi: EMISSION_POOL_ABI,
        client: publicClient,
      });

      const rate = await emissionPool.read.exchangeRate();
      expect(Number(rate)).toBe(10); // 10 points per token
    });

    it('should read current day', async () => {
      const emissionPool = getContract({
        address: emissionPoolAddress,
        abi: EMISSION_POOL_ABI,
        client: publicClient,
      });

      const currentDay = await emissionPool.read.getCurrentDay();
      // Should be a reasonable day number (> 0)
      expect(Number(currentDay)).toBeGreaterThan(0);
    });

    it('should record points via oracle', async () => {
      const emissionPool = getContract({
        address: emissionPoolAddress,
        abi: EMISSION_POOL_ABI,
        client: { public: publicClient, wallet: walletClient },
      });

      // Record points for user2 (owner has ORACLE_ROLE by default)
      await emissionPool.write.recordPoints([user2Address, BigInt(500)], {
        account: ownerAddress,
      });

      // Verify point balance
      const pointBalance = await emissionPool.read.getUserPointBalance([user2Address]);
      expect(Number(pointBalance)).toBe(500);
    });

    it('should batch record points', async () => {
      const emissionPool = getContract({
        address: emissionPoolAddress,
        abi: EMISSION_POOL_ABI,
        client: { public: publicClient, wallet: walletClient },
      });

      // Batch record points
      await emissionPool.write.recordPointsBatch(
        [[user1Address, user2Address], [BigInt(200), BigInt(300)]],
        { account: ownerAddress }
      );

      // Verify balances
      const user1Balance = await emissionPool.read.getUserPointBalance([user1Address]);
      const user2Balance = await emissionPool.read.getUserPointBalance([user2Address]);

      expect(Number(user1Balance)).toBe(200);
      expect(Number(user2Balance)).toBe(800); // 500 from before + 300
    });
  });

  describe('MedalNFT Contract', () => {
    it('should read medal name and symbol', async () => {
      const medalNFT = getContract({
        address: medalNFTAddress,
        abi: MEDAL_NFT_ABI,
        client: publicClient,
      });

      const name = await medalNFT.read.name();
      const symbol = await medalNFT.read.symbol();

      expect(name).toBe('FOODSHI Medal');
      expect(symbol).toBe('FSHMEDAL');
    });

    it('should read medal requirements for each tier', async () => {
      const medalNFT = getContract({
        address: medalNFTAddress,
        abi: MEDAL_NFT_ABI,
        client: publicClient,
      });

      // Bronze (tier 0)
      const bronze = await medalNFT.read.medalRequirements([0]);
      expect(Number(bronze[0])).toBe(30); // minDays
      expect(Number(bronze[1])).toBe(20); // minDonations
      expect(formatEther(bronze[2])).toBe('50'); // burnCost

      // Silver (tier 1)
      const silver = await medalNFT.read.medalRequirements([1]);
      expect(Number(silver[0])).toBe(90);
      expect(Number(silver[1])).toBe(70);
      expect(formatEther(silver[2])).toBe('150');

      // Gold (tier 2)
      const gold = await medalNFT.read.medalRequirements([2]);
      expect(Number(gold[0])).toBe(180);
      expect(Number(gold[1])).toBe(150);
      expect(formatEther(gold[2])).toBe('300');

      // Platinum (tier 3)
      const platinum = await medalNFT.read.medalRequirements([3]);
      expect(Number(platinum[0])).toBe(365);
      expect(Number(platinum[1])).toBe(320);
      expect(formatEther(platinum[2])).toBe('500');
    });

    it('should return empty medals for new user', async () => {
      const medalNFT = getContract({
        address: medalNFTAddress,
        abi: MEDAL_NFT_ABI,
        client: publicClient,
      });

      const medals = await medalNFT.read.getUserMedals([user1Address]);
      expect(medals).toEqual([0n, 0n, 0n, 0n]);
    });

    it('should check if user can mint medal', async () => {
      const medalNFT = getContract({
        address: medalNFTAddress,
        abi: MEDAL_NFT_ABI,
        client: publicClient,
      });

      // User hasn't met requirements
      const now = Math.floor(Date.now() / 1000);
      const [canMint, reason] = await medalNFT.read.canMintMedal([
        user1Address,
        0, // Bronze
        BigInt(now), // first donation now
        BigInt(5), // only 5 donations
      ]);

      expect(canMint).toBe(false);
      expect(reason).toBeTruthy(); // Some reason for rejection
    });

    it('should return zero NFT balance for new user', async () => {
      const medalNFT = getContract({
        address: medalNFTAddress,
        abi: MEDAL_NFT_ABI,
        client: publicClient,
      });

      const balance = await medalNFT.read.balanceOf([user1Address]);
      expect(Number(balance)).toBe(0);
    });
  });

  describe('Treasury Contract', () => {
    it('should read token balance', async () => {
      const treasury = getContract({
        address: treasuryAddress,
        abi: TREASURY_ABI,
        client: publicClient,
      });

      const balance = await treasury.read.getTokenBalance();
      // Treasury starts with no tokens
      expect(Number(balance)).toBe(0);
    });

    it('should read ETH balance', async () => {
      const treasury = getContract({
        address: treasuryAddress,
        abi: TREASURY_ABI,
        client: publicClient,
      });

      const ethBalance = await treasury.read.getETHBalance();
      expect(Number(ethBalance)).toBe(0);
    });

    it('should read daily withdrawal limit', async () => {
      const treasury = getContract({
        address: treasuryAddress,
        abi: TREASURY_ABI,
        client: publicClient,
      });

      const limit = await treasury.read.dailyWithdrawalLimit();
      expect(formatEther(limit)).toBe('10000'); // 10,000 tokens default
    });

    it('should read remaining daily allowance', async () => {
      const treasury = getContract({
        address: treasuryAddress,
        abi: TREASURY_ABI,
        client: publicClient,
      });

      const remaining = await treasury.read.getRemainingDailyAllowance();
      // Should be full limit since nothing withdrawn
      expect(formatEther(remaining)).toBe('10000');
    });
  });

  describe('Full User Flow: Frontend Perspective', () => {
    const user3Account = privateKeyToAccount(HARDHAT_ACCOUNTS[3]);
    const user3Address = user3Account.address;
    const user3WalletClient = createWalletClient({
      chain: hardhat,
      transport: http('http://127.0.0.1:8545'),
      account: user3Account,
    });

    beforeAll(async () => {

      // Transfer tokens to user3
      const shareToken = getContract({
        address: shareTokenAddress,
        abi: SHARE_TOKEN_ABI,
        client: { public: publicClient, wallet: walletClient },
      });
      await shareToken.write.transfer([user3Address, parseEther('1000')], {
        account: ownerAddress,
      });
    });

    it('should complete stake flow: approve → stake → check eligibility', async () => {
      // 1. Read initial balance
      const shareToken = getContract({
        address: shareTokenAddress,
        abi: SHARE_TOKEN_ABI,
        client: { public: publicClient, wallet: user3WalletClient },
      });
      const initialBalance = await shareToken.read.balanceOf([user3Address]);
      expect(formatEther(initialBalance)).toBe('1000');

      // 2. Approve staking contract
      await shareToken.write.approve([stakingAddress, parseEther('100')], {
        account: user3Address,
      });

      // 3. Verify allowance
      const allowance = await shareToken.read.allowance([user3Address, stakingAddress]);
      expect(formatEther(allowance)).toBe('100');

      // 4. Stake tokens
      const staking = getContract({
        address: stakingAddress,
        abi: STAKING_ABI,
        client: { public: publicClient, wallet: user3WalletClient },
      });
      await staking.write.stake([parseEther('15')], {
        account: user3Address,
      });

      // 5. Verify stake info
      const stakeInfo = await staking.read.stakes([user3Address]);
      expect(formatEther(stakeInfo[0])).toBe('15');

      // 6. Check withdrawal eligibility (should be true with 15 staked)
      const eligible = await staking.read.isWithdrawalEligible([user3Address]);
      expect(eligible).toBe(true);

      // 7. Verify balance decreased
      const finalBalance = await shareToken.read.balanceOf([user3Address]);
      expect(formatEther(finalBalance)).toBe('985');
    });

    it('should read dashboard data for user', async () => {
      // Simulate what frontend dashboard would read

      // Token balance
      const shareToken = getContract({
        address: shareTokenAddress,
        abi: SHARE_TOKEN_ABI,
        client: publicClient,
      });
      const tokenBalance = await shareToken.read.balanceOf([user3Address]);

      // Staking info
      const staking = getContract({
        address: stakingAddress,
        abi: STAKING_ABI,
        client: publicClient,
      });
      const stakeInfo = await staking.read.stakes([user3Address]);
      const isEligible = await staking.read.isWithdrawalEligible([user3Address]);
      const multiplier = await staking.read.getMultiplier([user3Address]);

      // Medal info
      const medalNFT = getContract({
        address: medalNFTAddress,
        abi: MEDAL_NFT_ABI,
        client: publicClient,
      });
      const medals = await medalNFT.read.getUserMedals([user3Address]);

      // EmissionPool info
      const emissionPool = getContract({
        address: emissionPoolAddress,
        abi: EMISSION_POOL_ABI,
        client: publicClient,
      });
      const pointBalance = await emissionPool.read.getUserPointBalance([user3Address]);
      const exchangeRate = await emissionPool.read.exchangeRate();

      // Compose dashboard data
      const dashboardData = {
        tokens: formatEther(tokenBalance),
        staked: formatEther(stakeInfo[0]),
        isSuperDonor: stakeInfo[3],
        fraudStrikes: Number(stakeInfo[4]),
        isWithdrawalEligible: isEligible,
        multiplier: Number(multiplier),
        medals: medals.map(Number),
        karmaPoints: Number(pointBalance),
        exchangeRate: Number(exchangeRate),
      };

      expect(dashboardData.tokens).toBe('985');
      expect(dashboardData.staked).toBe('15');
      expect(dashboardData.isSuperDonor).toBe(false);
      expect(dashboardData.fraudStrikes).toBe(0);
      expect(dashboardData.isWithdrawalEligible).toBe(true);
      expect(dashboardData.multiplier).toBe(100);
      expect(dashboardData.medals).toEqual([0, 0, 0, 0]);
      expect(dashboardData.karmaPoints).toBe(0);
      expect(dashboardData.exchangeRate).toBe(10);
    });
  });

  describe('Error Handling', () => {
    const noApprovalUserAccount = privateKeyToAccount(HARDHAT_ACCOUNTS[5]);
    const noApprovalUser = noApprovalUserAccount.address;

    const unstakeUserAccount = privateKeyToAccount(HARDHAT_ACCOUNTS[6]);
    const unstakeUser = unstakeUserAccount.address;

    const newUserAccount = privateKeyToAccount(HARDHAT_ACCOUNTS[7]);
    const newUser = newUserAccount.address;

    it('should fail when staking without approval', async () => {
      // Transfer tokens
      const shareToken = getContract({
        address: shareTokenAddress,
        abi: SHARE_TOKEN_ABI,
        client: { public: publicClient, wallet: walletClient },
      });
      await shareToken.write.transfer([noApprovalUser, parseEther('100')], {
        account: ownerAddress,
      });

      // Try to stake without approval
      const userWallet = createWalletClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
        account: noApprovalUserAccount,
      });

      const staking = getContract({
        address: stakingAddress,
        abi: STAKING_ABI,
        client: { public: publicClient, wallet: userWallet },
      });

      await expect(
        staking.write.stake([parseEther('10')], { account: noApprovalUserAccount })
      ).rejects.toThrow();
    });

    it('should fail when unstaking more than staked', async () => {
      // Setup: transfer, approve, and stake
      const shareToken = getContract({
        address: shareTokenAddress,
        abi: SHARE_TOKEN_ABI,
        client: { public: publicClient, wallet: walletClient },
      });
      await shareToken.write.transfer([unstakeUser, parseEther('100')], {
        account: ownerAddress,
      });

      const userWallet = createWalletClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
        account: unstakeUserAccount,
      });

      const shareTokenUser = getContract({
        address: shareTokenAddress,
        abi: SHARE_TOKEN_ABI,
        client: { public: publicClient, wallet: userWallet },
      });
      await shareTokenUser.write.approve([stakingAddress, parseEther('20')], {
        account: unstakeUserAccount,
      });

      const staking = getContract({
        address: stakingAddress,
        abi: STAKING_ABI,
        client: { public: publicClient, wallet: userWallet },
      });
      await staking.write.stake([parseEther('20')], { account: unstakeUserAccount });

      // Try to unstake more than staked
      await expect(
        staking.write.unstake([parseEther('50')], { account: unstakeUserAccount })
      ).rejects.toThrow();
    });

    it('should return correct reason when medal requirements not met', async () => {
      const medalNFT = getContract({
        address: medalNFTAddress,
        abi: MEDAL_NFT_ABI,
        client: publicClient,
      });

      const now = Math.floor(Date.now() / 1000);

      // Not enough time
      const [canMint1, reason1] = await medalNFT.read.canMintMedal([
        newUser,
        0,
        BigInt(now - 10 * 86400), // 10 days ago (need 30)
        BigInt(25), // enough donations
      ]);
      expect(canMint1).toBe(false);
      expect(reason1).toBe('Time requirement not met');

      // Not enough donations
      const [canMint2, reason2] = await medalNFT.read.canMintMedal([
        newUser,
        0,
        BigInt(now - 35 * 86400), // 35 days ago (enough)
        BigInt(15), // not enough donations (need 20)
      ]);
      expect(canMint2).toBe(false);
      expect(reason2).toBe('Donation count not met');
    });
  });
});
