/**
 * Upload medal image files to Pinata IPFS and print the CIDs.
 *
 * Usage:
 *   npm run upload:medals
 *
 * Expects four PNG files at:
 *   backend/assets/medals/bronze.png
 *   backend/assets/medals/silver.png
 *   backend/assets/medals/gold.png
 *   backend/assets/medals/platinum.png
 *
 * Copy the printed CIDs into your .env file:
 *   MEDAL_IMAGE_CID_BRONZE=<cid>
 *   MEDAL_IMAGE_CID_SILVER=<cid>
 *   MEDAL_IMAGE_CID_GOLD=<cid>
 *   MEDAL_IMAGE_CID_PLATINUM=<cid>
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { PinataSDK } from 'pinata';
import dotenv from 'dotenv';

dotenv.config({ path: join(__dirname, '../../../.env') });

const TIERS = ['bronze', 'silver', 'gold', 'platinum'] as const;

async function main() {
  if (!process.env.PINATA_JWT) {
    console.error('Error: PINATA_JWT must be set in .env');
    process.exit(1);
  }

  const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT,
  });

  console.log('Uploading medal images to Pinata IPFS...\n');

  const cids: Record<string, string> = {};

  for (const tier of TIERS) {
    const filePath = join(__dirname, '../../assets/medals', `${tier}.png`);
    const buffer = readFileSync(filePath);
    const file = new File(
      [buffer],
      `foodshi-medal-${tier}.png`,
      { type: 'image/png' },
    );

    const result = await pinata.upload.public.file(file);

    cids[tier] = result.cid;
    console.log(`${tier.toUpperCase()}: ${result.cid}`);
  }

  console.log('\nAdd these to your .env file:');
  console.log(`MEDAL_IMAGE_CID_BRONZE=${cids.bronze}`);
  console.log(`MEDAL_IMAGE_CID_SILVER=${cids.silver}`);
  console.log(`MEDAL_IMAGE_CID_GOLD=${cids.gold}`);
  console.log(`MEDAL_IMAGE_CID_PLATINUM=${cids.platinum}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
