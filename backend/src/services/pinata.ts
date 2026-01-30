import PinataSDK from '@pinata/sdk';
import fs from 'fs';
import path from 'path';

// Lazily instantiate Pinata client to allow dotenv to load first
let pinata: PinataSDK | null = null;

function getPinataClient(): PinataSDK {
  if (!pinata) {
    pinata = new PinataSDK(
      process.env.PINATA_API_KEY || '',
      process.env.PINATA_SECRET_KEY || ''
    );
  }
  return pinata;
}

// Medal tier names
const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum'] as const;
type TierName = typeof TIER_NAMES[number];

// Cached image CIDs (loaded from env or set after upload)
let imageCIDs: Record<TierName, string> = {
  Bronze: process.env.MEDAL_IMAGE_CID_BRONZE || '',
  Silver: process.env.MEDAL_IMAGE_CID_SILVER || '',
  Gold: process.env.MEDAL_IMAGE_CID_GOLD || '',
  Platinum: process.env.MEDAL_IMAGE_CID_PLATINUM || '',
};

/**
 * Test Pinata connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await getPinataClient().testAuthentication();
    return result.authenticated === true;
  } catch (error) {
    console.error('Pinata authentication failed:', error);
    return false;
  }
}

/**
 * Upload a file to IPFS via Pinata
 */
export async function uploadFile(
  filePath: string,
  name: string
): Promise<string> {
  const readableStream = fs.createReadStream(filePath);

  const options = {
    pinataMetadata: {
      name,
    },
  };

  const result = await getPinataClient().pinFileToIPFS(readableStream, options);
  return result.IpfsHash;
}

/**
 * Upload JSON metadata to IPFS via Pinata
 */
export async function uploadJSON(
  json: object,
  name: string
): Promise<string> {
  const options = {
    pinataMetadata: {
      name,
    },
  };

  const result = await getPinataClient().pinJSONToIPFS(json, options);
  return result.IpfsHash;
}

/**
 * Upload all 4 medal images from a directory
 * Expected files: bronze.png, silver.png, gold.png, platinum.png
 */
export async function uploadMedalImages(
  imageDir: string
): Promise<Record<TierName, string>> {
  const results: Record<string, string> = {};

  for (const tier of TIER_NAMES) {
    const fileName = `${tier.toLowerCase()}.png`;
    const filePath = path.join(imageDir, fileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Medal image not found: ${filePath}`);
    }

    console.log(`Uploading ${tier} medal image...`);
    const cid = await uploadFile(filePath, `FOODSHI ${tier} Medal Image`);
    results[tier] = cid;
    console.log(`  ${tier}: ipfs://${cid}`);
  }

  // Update cached CIDs
  imageCIDs = results as Record<TierName, string>;

  return imageCIDs;
}

/**
 * Set image CIDs manually (from env vars or previous upload)
 */
export function setImageCIDs(cids: Record<TierName, string>): void {
  imageCIDs = cids;
}

/**
 * Get the image CID for a tier
 */
export function getImageCID(tierIndex: number): string {
  const tier = TIER_NAMES[tierIndex];
  return imageCIDs[tier] || '';
}

/**
 * Generate and upload metadata for a minted medal
 */
export async function uploadMedalMetadata(
  tokenId: number,
  tierIndex: number,
  mintedAt: number,
  donationsAtMint: number,
  ownerAddress: string
): Promise<string> {
  const tier = TIER_NAMES[tierIndex];
  const imageCID = imageCIDs[tier];

  if (!imageCID) {
    throw new Error(`No image CID found for tier: ${tier}. Upload medal images first.`);
  }

  const metadata = {
    name: `FOODSHI ${tier} Medal #${tokenId}`,
    description: getMedalDescription(tier),
    image: `ipfs://${imageCID}`,
    external_url: `https://foodshi.app/medals/${tokenId}`,
    attributes: [
      {
        trait_type: 'Tier',
        value: tier,
      },
      {
        trait_type: 'Tier Level',
        value: tierIndex + 1,
        display_type: 'number',
      },
      {
        trait_type: 'Donations at Mint',
        value: donationsAtMint,
        display_type: 'number',
      },
      {
        trait_type: 'Minted At',
        value: mintedAt,
        display_type: 'date',
      },
      {
        trait_type: 'Original Owner',
        value: ownerAddress,
      },
    ],
  };

  const cid = await uploadJSON(metadata, `FOODSHI ${tier} Medal #${tokenId} Metadata`);
  return cid;
}

/**
 * Get medal description by tier
 */
function getMedalDescription(tier: TierName): string {
  const descriptions: Record<TierName, string> = {
    Bronze: 'Awarded to FOODSHI donors who have made 20+ food donations over at least 30 days. This medal represents the beginning of a meaningful journey in fighting food waste and hunger.',
    Silver: 'Awarded to FOODSHI donors who have made 70+ food donations over at least 90 days. This medal recognizes consistent dedication to the community.',
    Gold: 'Awarded to FOODSHI donors who have made 150+ food donations over at least 180 days. This medal honors exceptional commitment to reducing food waste.',
    Platinum: 'Awarded to FOODSHI donors who have made 320+ food donations over at least 365 days. This medal celebrates extraordinary impact and sustained generosity.',
  };

  return descriptions[tier];
}

/**
 * Get the full IPFS gateway URL for a CID
 */
export function getIPFSUrl(cid: string): string {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}
