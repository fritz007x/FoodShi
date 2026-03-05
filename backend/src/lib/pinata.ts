import { PinataSDK } from 'pinata';
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

let _client: PinataSDK | null = null;

function getClient(): PinataSDK {
  if (!_client) {
    if (!process.env.PINATA_JWT) {
      throw new Error('PINATA_JWT must be set');
    }
    _client = new PinataSDK({
      pinataJwt: process.env.PINATA_JWT,
    });
  }
  return _client;
}

/**
 * Upload ERC-721 metadata JSON for a minted medal NFT to Pinata IPFS.
 * The image CID must be pre-uploaded via the upload:medals script and
 * set in the corresponding MEDAL_IMAGE_CID_* env var.
 *
 * @returns Full IPFS URI — e.g. "ipfs://bafy..."
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

  const blob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
  const file = new File(
    [blob],
    `foodshi-medal-${tierName.toLowerCase()}-${tokenId}.json`,
    { type: 'application/json' },
  );

  const result = await getClient().upload.public.file(file);

  return `ipfs://${result.cid}`;
}
