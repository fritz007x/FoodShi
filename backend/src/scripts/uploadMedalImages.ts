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

import { createReadStream } from 'fs';
import { join } from 'path';
import PinataClient from '@pinata/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: join(__dirname, '../../../.env') });

const TIERS = ['bronze', 'silver', 'gold', 'platinum'] as const;

async function main() {
  if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_KEY) {
    console.error('Error: PINATA_API_KEY and PINATA_SECRET_KEY must be set in .env');
    process.exit(1);
  }

  const pinata = new PinataClient({
    pinataApiKey:       process.env.PINATA_API_KEY,
    pinataSecretApiKey: process.env.PINATA_SECRET_KEY,
  });

  console.log('Uploading medal images to Pinata IPFS...\n');

  const cids: Record<string, string> = {};

  for (const tier of TIERS) {
    const filePath = join(__dirname, '../../assets/medals', `${tier}.png`);
    const stream = createReadStream(filePath);

    const result = await pinata.pinFileToIPFS(stream, {
      pinataMetadata: { name: `foodshi-medal-${tier}` },
    });

    cids[tier] = result.IpfsHash;
    console.log(`${tier.toUpperCase()}: ${result.IpfsHash}`);
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
