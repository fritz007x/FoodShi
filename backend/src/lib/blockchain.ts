import { ethers } from 'ethers';
import { markDaySynced } from '../services/karma';
import { uploadMedalMetadata } from './pinata';
export { MedalTier } from './medalTier';

// ---------------------------------------------------------------------------
// Minimal ABIs — only the functions the backend actually calls
// ---------------------------------------------------------------------------

const SHARE_TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
] as const;

const EMISSION_POOL_ABI = [
  'function getClaimable(address user, uint256 day) view returns (uint256)',
  'function getUserPoints(address user, uint256 day) view returns (uint256)',
  'function dailyDistributions(uint256 day) view returns (uint256 timestamp, uint256 totalPoints, uint256 totalDistributed, bool finalized)',
  'function getCurrentDay() view returns (uint256)',
  'event DayFinalized(uint256 indexed day, uint256 totalPoints, uint256 totalDistributed)',
] as const;

const MEDAL_NFT_ABI = [
  'function mint(address to, uint8 tier, uint256 firstDonationTimestamp, uint256 confirmedDonations) external',
  'function setTokenMetadataURI(uint256 tokenId, string calldata uri) external',
  'function userMedals(address user, uint8 tier) view returns (uint256)',
  'function canMintMedal(address user, uint8 tier, uint256 firstDonationTimestamp, uint256 confirmedDonations) view returns (bool canMint, string reason)',
  'event MedalMinted(address indexed user, uint256 indexed tokenId, uint8 tier, uint256 burnAmount)',
] as const;

const STAKING_ABI = [
  'function getMultiplier(address user) view returns (uint256)',
  'function isWithdrawalEligible(address user) view returns (bool)',
] as const;

// ---------------------------------------------------------------------------
// Lazy-initialised provider / signer
// ---------------------------------------------------------------------------

let _provider: ethers.JsonRpcProvider | null = null;
let _signer:   ethers.Wallet          | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL);
  }
  return _provider;
}

function getSigner(): ethers.Wallet {
  if (!_signer) {
    if (!process.env.PRIVATE_KEY) throw new Error('PRIVATE_KEY env var not set');
    _signer = new ethers.Wallet(process.env.PRIVATE_KEY, getProvider());
  }
  return _signer;
}

// ---------------------------------------------------------------------------
// Contract accessors
// ---------------------------------------------------------------------------

function emissionPool(): ethers.Contract {
  return new ethers.Contract(
    process.env.EMISSION_POOL_ADDRESS!,
    EMISSION_POOL_ABI,
    getProvider()
  );
}

function shareToken(): ethers.Contract {
  return new ethers.Contract(
    process.env.SHARE_TOKEN_ADDRESS!,
    SHARE_TOKEN_ABI,
    getProvider()
  );
}

function medalNFT(): ethers.Contract {
  return new ethers.Contract(
    process.env.MEDAL_NFT_ADDRESS!,
    MEDAL_NFT_ABI,
    getSigner()   // minting requires the backend signer (MINTER_ROLE)
  );
}

function staking(): ethers.Contract {
  return new ethers.Contract(
    process.env.STAKING_ADDRESS!,
    STAKING_ABI,
    getProvider()
  );
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/** On-chain distribution record for a day number. */
export async function getDayDistribution(day: number): Promise<{
  timestamp: number;
  totalPoints: bigint;
  totalDistributed: bigint;
  finalized: boolean;
}> {
  const [timestamp, totalPoints, totalDistributed, finalized] =
    await emissionPool().dailyDistributions(day);
  return { timestamp: Number(timestamp), totalPoints, totalDistributed, finalized };
}

/** SHARE token balance for a wallet, formatted in ether units. */
export async function getUserShareBalance(walletAddress: string): Promise<string> {
  const balance: bigint = await shareToken().balanceOf(walletAddress);
  return ethers.formatEther(balance);
}

/** Claimable SHARE tokens for a wallet on a given day number. */
export async function getClaimable(walletAddress: string, day: number): Promise<string> {
  const amount: bigint = await emissionPool().getClaimable(walletAddress, day);
  return ethers.formatEther(amount);
}

/** Staking multiplier for a wallet (100 = 1×, 150 = 1.5×). */
export async function getStakingMultiplier(walletAddress: string): Promise<number> {
  const multiplier: bigint = await staking().getMultiplier(walletAddress);
  return Number(multiplier);
}

/** Whether a wallet is eligible to withdraw / exchange points. */
export async function isWithdrawalEligible(walletAddress: string): Promise<boolean> {
  return staking().isWithdrawalEligible(walletAddress);
}

/** Check on-chain medal eligibility (mirrors canMintMedal in MedalNFT.sol). */
export async function canMintMedal(
  walletAddress: string,
  tier: MedalTier,
  firstDonationTimestamp: number,
  confirmedDonations: number
): Promise<{ canMint: boolean; reason: string }> {
  const [canMint, reason]: [boolean, string] = await medalNFT().canMintMedal(
    walletAddress, tier, firstDonationTimestamp, confirmedDonations
  );
  return { canMint, reason };
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

/**
 * Mint a medal NFT for a user, then upload ERC-721 metadata to Pinata and
 * set the token URI on-chain. Backend must hold MINTER_ROLE on MedalNFT.
 * @returns The mint transaction hash.
 */
export async function mintMedal(
  walletAddress: string,
  tier: MedalTier,
  firstDonationTimestamp: number,
  confirmedDonations: number
): Promise<string> {
  const nft = medalNFT();

  const tx: ethers.TransactionResponse = await nft.mint(
    walletAddress, tier, firstDonationTimestamp, confirmedDonations
  );
  const receipt = await tx.wait();

  // Parse tokenId from the MedalMinted event in the receipt
  const iface = new ethers.Interface([
    'event MedalMinted(address indexed user, uint256 indexed tokenId, uint8 tier, uint256 burnAmount)',
  ]);
  let tokenId: number | null = null;
  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'MedalMinted') {
        tokenId = Number(parsed.args.tokenId);
        break;
      }
    } catch { /* not this event */ }
  }

  if (tokenId !== null) {
    // Upload metadata and set the token URI. Wrapped in try/catch so that
    // a transient Pinata outage does not hide the successful mint. If this
    // block throws, the error includes txHash and tokenId so the caller can
    // retry setTokenMetadataURI without re-minting.
    try {
      const mintedAt = Math.floor(Date.now() / 1000);
      const metadataUri = await uploadMedalMetadata(tokenId, tier, confirmedDonations, mintedAt);
      await nft.setTokenMetadataURI(tokenId, metadataUri);
    } catch (metaErr) {
      const retryInfo = { txHash: tx.hash, tokenId, tier, confirmedDonations };
      console.error(
        '[blockchain] mintMedal: metadata upload/set failed — token minted but URI not set.' +
        ' Retry setTokenMetadataURI with:', retryInfo, metaErr
      );
      throw Object.assign(
        new Error(`Medal minted (tokenId=${tokenId}) but metadata URI could not be set. Retry required.`),
        { txHash: tx.hash, tokenId }
      );
    }
  } else {
    console.warn('[blockchain] mintMedal: MedalMinted event not found in receipt — tokenId unknown', { txHash: tx.hash });
  }

  return tx.hash;
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

/**
 * Subscribe to EmissionPool's DayFinalized event.
 * When the Chainlink CRE EmissionPoolReceiver.onReport() transaction
 * confirms, this fires and marks the corresponding daily_points rows as
 * synced_to_chain = true so they won't be re-submitted.
 */
export function listenForDayFinalized(): void {
  const pool = new ethers.Contract(
    process.env.EMISSION_POOL_ADDRESS!,
    EMISSION_POOL_ABI,
    getProvider()
  );

  pool.on('DayFinalized', async (day: bigint) => {
    const dayNumber = Number(day);
    const dayDate = new Date(dayNumber * 86_400 * 1000).toISOString().split('T')[0];
    try {
      await markDaySynced(dayDate);
      console.log(`[blockchain] DayFinalized day=${dayNumber} (${dayDate}) — marked synced`);
    } catch (err) {
      console.error(`[blockchain] Failed to mark day ${dayNumber} synced:`, err);
    }
  });

  console.log('[blockchain] Listening for DayFinalized events on EmissionPool');
}
