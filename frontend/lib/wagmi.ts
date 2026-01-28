import { http, createConfig } from 'wagmi';
import { polygon, polygonMumbai } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

export const config = createConfig({
  chains: [polygon, polygonMumbai],
  connectors: [
    injected(),
    walletConnect({ projectId }),
  ],
  transports: {
    [polygon.id]: http(),
    [polygonMumbai.id]: http(),
  },
});

// Contract addresses (from deployment)
export const CONTRACT_ADDRESSES = {
  shareToken: process.env.NEXT_PUBLIC_SHARE_TOKEN_ADDRESS || '',
  treasury: process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '',
  staking: process.env.NEXT_PUBLIC_STAKING_ADDRESS || '',
  medalNFT: process.env.NEXT_PUBLIC_MEDAL_NFT_ADDRESS || '',
  emissionPool: process.env.NEXT_PUBLIC_EMISSION_POOL_ADDRESS || '',
};

// Contract ABIs
export const SHARE_TOKEN_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function transferableBalanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
] as const;

export const STAKING_ABI = [
  'function stake(uint256 amount)',
  'function unstake(uint256 amount)',
  'function activateSuperDonor()',
  'function stakes(address) view returns (uint256 amount, uint256 stakedAt, uint256 unlockTime, bool isSuperDonor, uint8 fraudStrikes)',
  'function isWithdrawalEligible(address user) view returns (bool)',
  'function isSuperDonor(address user) view returns (bool)',
  'function getMultiplier(address user) view returns (uint256)',
  'function getUnlockTimeRemaining(address user) view returns (uint256)',
  'function MINIMUM_STAKE() view returns (uint256)',
  'function SUPER_DONOR_STAKE() view returns (uint256)',
] as const;

export const EMISSION_POOL_ABI = [
  'function claim(uint256 day)',
  'function getClaimable(address user, uint256 day) view returns (uint256)',
  'function getCurrentDay() view returns (uint256)',
  'function exchangeRate() view returns (uint256)',
] as const;

export const MEDAL_NFT_ABI = [
  'function mint(address to, uint8 tier, uint256 firstDonationTimestamp, uint256 confirmedDonations)',
  'function canMintMedal(address user, uint8 tier, uint256 firstDonationTimestamp, uint256 confirmedDonations) view returns (bool canMint, string reason)',
  'function getUserMedals(address user) view returns (uint256[4])',
  'function medalRequirements(uint8) view returns (uint256 minDays, uint256 minDonations, uint256 burnCost)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
] as const;
