import PinataClient from '@pinata/sdk';
import { MedalTier } from './blockchain';

const TIER_NAMES: Record<MedalTier, string> = {
  [MedalTier.Bronze]:   'Bronze',
  [MedalTier.Silver]:   'Silver',
  [MedalTier.Gold]:     'Gold',
  [MedalTier.Platinum]: 'Platinum',
};

const TIER_DESCRIPTIONS: Record<MedalTier, string> = {
  [MedalTier.Bronze]:   'Awarded for 20 confirmed food donations over 30 days on the FOODSHI platform.',
  [MedalTier.Silver]:   'Awarded for 70 confirmed food donations over 90 days on the FOODSHI platform.',
  [MedalTier.Gold]:     'Awarded for 150 confirmed food donations over 180 days on the FOODSHI platform.',
  [MedalTier.Platinum]: 'Awarded for 320 confirmed food donations over 365 days on the FOODSHI platform.',
};

const IMAGE_CID_KEYS: Record<MedalTier, string> = {
  [MedalTier.Bronze]:   'MEDAL_IMAGE_CID_BRONZE',
  [MedalTier.Silver]:   'MEDAL_IMAGE_CID_SILVER',
  [MedalTier.Gold]:     'MEDAL_IMAGE_CID_GOLD',
  [MedalTier.Platinum]: 'MEDAL_IMAGE_CID_PLATINUM',
};

let _client: PinataClient | null = null;

function getClient(): PinataClient {
  if (!_client) {
    if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_KEY) {
      throw new Error('PINATA_API_KEY and PINATA_SECRET_KEY must be set');
    }
    _client = new PinataClient({
      pinataApiKey:       process.env.PINATA_API_KEY,
      pinataSecretApiKey: process.env.PINATA_SECRET_KEY,
    });
  }
  return _client;
}

/**
 * Upload ERC-721 metadata JSON for a minted medal NFT to Pinata IPFS.
 * The image CID must be pre-uploaded via the upload:medals script and
 * set in the corresponding MEDAL_IMAGE_CID_* env var.
 *
 * @returns Full IPFS URI — e.g. "ipfs://Qm..."
 */
export async function uploadMedalMetadata(
  tokenId: number,
  tier: MedalTier,
  donationsAtMint: number,
  mintedAt: number        // unix timestamp (seconds)
): Promise<string> {
  const tierName = TIER_NAMES[tier];
  const imageCidKey = IMAGE_CID_KEYS[tier];
  const imageCid = process.env[imageCidKey];

  if (!imageCid) {
    throw new Error(
      `${imageCidKey} env var is not set — run "npm run upload:medals" first`
    );
  }

  const metadata = {
    name:        `FOODSHI ${tierName} Medal #${tokenId}`,
    description: TIER_DESCRIPTIONS[tier],
    image:       `ipfs://${imageCid}`,
    attributes: [
      { trait_type: 'Tier',              value: tierName },
      { trait_type: 'Donations at Mint', value: donationsAtMint },
      { trait_type: 'Minted At',         display_type: 'date', value: mintedAt },
    ],
  };

  const result = await getClient().pinJSONToIPFS(metadata, {
    pinataMetadata: {
      name: `foodshi-medal-${tierName.toLowerCase()}-${tokenId}`,
    },
  });

  return `ipfs://${result.IpfsHash}`;
}
