/**
 * Upload Medal Images to IPFS via Pinata
 *
 * Usage:
 *   npx tsx src/scripts/uploadMedalImages.ts <image-directory>
 *
 * Example:
 *   npx tsx src/scripts/uploadMedalImages.ts ./medal-images
 *
 * Expected files in directory:
 *   - bronze.png
 *   - silver.png
 *   - gold.png
 *   - platinum.png
 *
 * After running, add the output CIDs to your .env file.
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { uploadMedalImages, testConnection } from '../services/pinata';

async function main() {
  const imageDir = process.argv[2];

  if (!imageDir) {
    console.error('Usage: npx tsx src/scripts/uploadMedalImages.ts <image-directory>');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx src/scripts/uploadMedalImages.ts ./medal-images');
    console.error('');
    console.error('Expected files:');
    console.error('  - bronze.png');
    console.error('  - silver.png');
    console.error('  - gold.png');
    console.error('  - platinum.png');
    process.exit(1);
  }

  const resolvedDir = path.resolve(imageDir);

  if (!fs.existsSync(resolvedDir)) {
    console.error(`Directory not found: ${resolvedDir}`);
    process.exit(1);
  }

  // Check for required files
  const requiredFiles = ['bronze.png', 'silver.png', 'gold.png', 'platinum.png'];
  const missingFiles = requiredFiles.filter(
    (f) => !fs.existsSync(path.join(resolvedDir, f))
  );

  if (missingFiles.length > 0) {
    console.error('Missing required files:');
    missingFiles.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }

  // Check Pinata credentials
  if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_KEY) {
    console.error('Missing Pinata credentials in .env file:');
    console.error('  - PINATA_API_KEY');
    console.error('  - PINATA_SECRET_KEY');
    process.exit(1);
  }

  console.log('Testing Pinata connection...');
  const connected = await testConnection();

  if (!connected) {
    console.error('Failed to connect to Pinata. Check your API keys.');
    process.exit(1);
  }

  console.log('Connected to Pinata successfully!\n');
  console.log(`Uploading medal images from: ${resolvedDir}\n`);

  try {
    const cids = await uploadMedalImages(resolvedDir);

    console.log('\n========================================');
    console.log('Upload complete! Add these to your .env:');
    console.log('========================================\n');
    console.log(`MEDAL_IMAGE_CID_BRONZE=${cids.Bronze}`);
    console.log(`MEDAL_IMAGE_CID_SILVER=${cids.Silver}`);
    console.log(`MEDAL_IMAGE_CID_GOLD=${cids.Gold}`);
    console.log(`MEDAL_IMAGE_CID_PLATINUM=${cids.Platinum}`);
    console.log('\n========================================');
    console.log('IPFS URLs:');
    console.log('========================================\n');
    console.log(`Bronze:   https://gateway.pinata.cloud/ipfs/${cids.Bronze}`);
    console.log(`Silver:   https://gateway.pinata.cloud/ipfs/${cids.Silver}`);
    console.log(`Gold:     https://gateway.pinata.cloud/ipfs/${cids.Gold}`);
    console.log(`Platinum: https://gateway.pinata.cloud/ipfs/${cids.Platinum}`);
  } catch (error) {
    console.error('Upload failed:', error);
    process.exit(1);
  }
}

main();
