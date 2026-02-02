import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

// Contract ABIs (simplified for key functions)
const SHARE_TOKEN_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function transferableBalanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const STAKING_ABI = [
  'function stakes(address) view returns (uint256 amount, uint256 stakedAt, uint256 unlockTime, bool isSuperDonor, uint8 fraudStrikes)',
  'function isWithdrawalEligible(address user) view returns (bool)',
  'function isSuperDonor(address user) view returns (bool)',
  'function getMultiplier(address user) view returns (uint256)',
  'function addFraudStrike(address user)',
];

const EMISSION_POOL_ABI = [
  'function recordPoints(address user, uint256 points)',
  'function recordPointsBatch(address[] users, uint256[] points)',
  'function finalizeDay(uint256 day)',
  'function exchangeRate() view returns (uint256)',
  'function getCurrentDay() view returns (uint256)',
];

const MEDAL_NFT_ABI = [
  'function mint(address to, uint8 tier, uint256 firstDonationTimestamp, uint256 confirmedDonations)',
  'function canMintMedal(address user, uint8 tier, uint256 firstDonationTimestamp, uint256 confirmedDonations) view returns (bool canMint, string reason)',
  'function getUserMedals(address user) view returns (uint256[4])',
  'function medalRequirements(uint8) view returns (uint256 minDays, uint256 minDonations, uint256 burnCost)',
  'function setTokenMetadataURI(uint256 tokenId, string uri)',
  'function getStoredTokenURI(uint256 tokenId) view returns (string)',
  'event MedalMinted(address indexed user, uint256 indexed tokenId, uint8 tier, uint256 burnAmount)',
];

// Get provider
function getProvider(): ethers.JsonRpcProvider {
  const rpcUrl = process.env.NODE_ENV === 'production'
    ? process.env.POLYGON_RPC_URL
    : process.env.AMOY_RPC_URL;

  return new ethers.JsonRpcProvider(rpcUrl);
}

// Get signer (for write operations)
function getSigner(): ethers.Wallet {
  const provider = getProvider();
  const privateKey = process.env.BACKEND_PRIVATE_KEY || process.env.PRIVATE_KEY;

  if (!privateKey) {
    throw new Error('No private key configured');
  }

  return new ethers.Wallet(privateKey, provider);
}

// Contract addresses (loaded from deployment)
let contractAddresses: {
  shareToken: string;
  staking: string;
  emissionPool: string;
  medalNFT: string;
  treasury: string;
} | null = null;

export function setContractAddresses(addresses: typeof contractAddresses) {
  contractAddresses = addresses;
}

function getAddresses() {
  if (!contractAddresses) {
    // Try to load from environment or deployment file
    contractAddresses = {
      shareToken: process.env.SHARE_TOKEN_ADDRESS || '',
      staking: process.env.STAKING_ADDRESS || '',
      emissionPool: process.env.EMISSION_POOL_ADDRESS || '',
      medalNFT: process.env.MEDAL_NFT_ADDRESS || '',
      treasury: process.env.TREASURY_ADDRESS || '',
    };
  }
  return contractAddresses;
}

// Token operations
export async function getTokenBalance(walletAddress: string): Promise<string> {
  const provider = getProvider();
  const addresses = getAddresses();
  const contract = new ethers.Contract(addresses.shareToken, SHARE_TOKEN_ABI, provider);

  const balance = await contract.balanceOf(walletAddress);
  return ethers.formatEther(balance);
}

export async function getTransferableBalance(walletAddress: string): Promise<string> {
  const provider = getProvider();
  const addresses = getAddresses();
  const contract = new ethers.Contract(addresses.shareToken, SHARE_TOKEN_ABI, provider);

  const balance = await contract.transferableBalanceOf(walletAddress);
  return ethers.formatEther(balance);
}

// Staking operations
export async function getStakeInfo(walletAddress: string): Promise<{
  amount: string;
  stakedAt: number;
  unlockTime: number;
  isSuperDonor: boolean;
  fraudStrikes: number;
}> {
  const provider = getProvider();
  const addresses = getAddresses();
  const contract = new ethers.Contract(addresses.staking, STAKING_ABI, provider);

  const stake = await contract.stakes(walletAddress);

  return {
    amount: ethers.formatEther(stake.amount),
    stakedAt: Number(stake.stakedAt),
    unlockTime: Number(stake.unlockTime),
    isSuperDonor: stake.isSuperDonor,
    fraudStrikes: Number(stake.fraudStrikes),
  };
}

export async function isWithdrawalEligible(walletAddress: string): Promise<boolean> {
  const provider = getProvider();
  const addresses = getAddresses();
  const contract = new ethers.Contract(addresses.staking, STAKING_ABI, provider);

  return contract.isWithdrawalEligible(walletAddress);
}

export async function addFraudStrike(walletAddress: string): Promise<string> {
  const signer = getSigner();
  const addresses = getAddresses();
  const contract = new ethers.Contract(addresses.staking, STAKING_ABI, signer);

  const tx = await contract.addFraudStrike(walletAddress);
  await tx.wait();

  return tx.hash;
}

// Emission pool operations
export async function recordPointsOnChain(
  users: string[],
  points: number[]
): Promise<string> {
  const signer = getSigner();
  const addresses = getAddresses();
  const contract = new ethers.Contract(addresses.emissionPool, EMISSION_POOL_ABI, signer);

  const tx = await contract.recordPointsBatch(users, points);
  await tx.wait();

  return tx.hash;
}

export async function finalizeDay(day: number): Promise<string> {
  const signer = getSigner();
  const addresses = getAddresses();
  const contract = new ethers.Contract(addresses.emissionPool, EMISSION_POOL_ABI, signer);

  const tx = await contract.finalizeDay(day);
  await tx.wait();

  return tx.hash;
}

export async function getExchangeRate(): Promise<number> {
  const provider = getProvider();
  const addresses = getAddresses();
  const contract = new ethers.Contract(addresses.emissionPool, EMISSION_POOL_ABI, provider);

  const rate = await contract.exchangeRate();
  return Number(rate);
}

// Medal operations
export async function mintMedal(
  to: string,
  tier: number,
  firstDonationTimestamp: number,
  confirmedDonations: number
): Promise<{ txHash: string; tokenId: number }> {
  const signer = getSigner();
  const addresses = getAddresses();
  const contract = new ethers.Contract(addresses.medalNFT, MEDAL_NFT_ABI, signer);

  const tx = await contract.mint(to, tier, firstDonationTimestamp, confirmedDonations);
  const receipt = await tx.wait();

  // Parse the MedalMinted event to get the token ID
  let tokenId = 0;
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (parsed && parsed.name === 'MedalMinted') {
        tokenId = Number(parsed.args.tokenId);
        break;
      }
    } catch {
      // Not a matching event, continue
    }
  }

  return { txHash: tx.hash, tokenId };
}

export async function setTokenMetadataURI(
  tokenId: number,
  uri: string
): Promise<string> {
  const signer = getSigner();
  const addresses = getAddresses();
  const contract = new ethers.Contract(addresses.medalNFT, MEDAL_NFT_ABI, signer);

  const tx = await contract.setTokenMetadataURI(tokenId, uri);
  await tx.wait();

  return tx.hash;
}

export async function getStoredTokenURI(tokenId: number): Promise<string> {
  const provider = getProvider();
  const addresses = getAddresses();
  const contract = new ethers.Contract(addresses.medalNFT, MEDAL_NFT_ABI, provider);

  return contract.getStoredTokenURI(tokenId);
}

export async function canMintMedal(
  walletAddress: string,
  tier: number,
  firstDonationTimestamp: number,
  confirmedDonations: number
): Promise<{ canMint: boolean; reason: string }> {
  const provider = getProvider();
  const addresses = getAddresses();
  const contract = new ethers.Contract(addresses.medalNFT, MEDAL_NFT_ABI, provider);

  const [canMint, reason] = await contract.canMintMedal(
    walletAddress,
    tier,
    firstDonationTimestamp,
    confirmedDonations
  );

  return { canMint, reason };
}

export async function getUserMedals(walletAddress: string): Promise<number[]> {
  const provider = getProvider();
  const addresses = getAddresses();
  const contract = new ethers.Contract(addresses.medalNFT, MEDAL_NFT_ABI, provider);

  const medals = await contract.getUserMedals(walletAddress);
  return medals.map((m: bigint) => Number(m));
}

export async function getMedalRequirements(tier: number): Promise<{
  minDays: number;
  minDonations: number;
  burnCost: string;
}> {
  const provider = getProvider();
  const addresses = getAddresses();
  const contract = new ethers.Contract(addresses.medalNFT, MEDAL_NFT_ABI, provider);

  const req = await contract.medalRequirements(tier);

  return {
    minDays: Number(req.minDays),
    minDonations: Number(req.minDonations),
    burnCost: ethers.formatEther(req.burnCost),
  };
}
