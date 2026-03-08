import { ethers } from "hardhat";

/**
 * Configure roles for already-deployed Foodshi contracts on Amoy.
 * Run: npx hardhat run scripts/configure.ts --network amoy
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Configuring contracts with account:", deployer.address);

  // Deployed addresses from deploy output
  const ADDRESSES = {
    ShareToken: "0x559903c557b9AE12633F7A205e07ca7A4552350b",
    Treasury: "0xBD3D5D6acDC059a7A6E15140258547307891955A",
    Staking: "0xd081c7A9BdF693ABC4bde6C4Cf990059e0628C8B",
    MedalNFT: "0x531c922EBb98998d30d669e55eAF0Dd4B8dEFB36",
    EmissionPool: "0xd2B3C5Ea2cC4fEE5E1F801C29D7e1A6A0023C0aF",
    EmissionPoolReceiver: "0x5ba5046dF1F0c06322B844430d5e617E4f0AC335",
  };

  // Attach to deployed contracts
  const shareToken = await ethers.getContractAt("ShareToken", ADDRESSES.ShareToken);
  const treasury = await ethers.getContractAt("Treasury", ADDRESSES.Treasury);
  const emissionPool = await ethers.getContractAt("EmissionPool", ADDRESSES.EmissionPool);

  console.log("\nConfiguring roles...\n");

  // 1. Grant EMISSION_ROLE to EmissionPool on ShareToken
  const EMISSION_ROLE = await shareToken.EMISSION_ROLE();
  const hasEmissionRole = await shareToken.hasRole(EMISSION_ROLE, ADDRESSES.EmissionPool);
  if (!hasEmissionRole) {
    const tx1 = await shareToken.grantRole(EMISSION_ROLE, ADDRESSES.EmissionPool);
    await tx1.wait();
    console.log("1. Granted EMISSION_ROLE to EmissionPool");
  } else {
    console.log("1. EMISSION_ROLE already granted to EmissionPool (skipped)");
  }

  // 2. Grant DEPOSITOR_ROLE to Staking on Treasury
  const DEPOSITOR_ROLE = await treasury.DEPOSITOR_ROLE();
  const hasDepositorRole = await treasury.hasRole(DEPOSITOR_ROLE, ADDRESSES.Staking);
  if (!hasDepositorRole) {
    const tx2 = await treasury.grantRole(DEPOSITOR_ROLE, ADDRESSES.Staking);
    await tx2.wait();
    console.log("2. Granted DEPOSITOR_ROLE to Staking");
  } else {
    console.log("2. DEPOSITOR_ROLE already granted to Staking (skipped)");
  }

  // 3. Grant ORACLE_ROLE to EmissionPoolReceiver on EmissionPool
  const ORACLE_ROLE = await emissionPool.ORACLE_ROLE();
  const hasOracleRole = await emissionPool.hasRole(ORACLE_ROLE, ADDRESSES.EmissionPoolReceiver);
  if (!hasOracleRole) {
    const tx3 = await emissionPool.grantRole(ORACLE_ROLE, ADDRESSES.EmissionPoolReceiver);
    await tx3.wait();
    console.log("3. Granted ORACLE_ROLE to EmissionPoolReceiver");
  } else {
    console.log("3. ORACLE_ROLE already granted to EmissionPoolReceiver (skipped)");
  }

  // 4. Verify MINTER_ROLE on MedalNFT (deployer should already have it)
  const medalNFT = await ethers.getContractAt("MedalNFT", ADDRESSES.MedalNFT);
  const MINTER_ROLE = await medalNFT.MINTER_ROLE();
  const hasMinterRole = await medalNFT.hasRole(MINTER_ROLE, deployer.address);
  console.log(`4. MINTER_ROLE on MedalNFT for deployer: ${hasMinterRole ? "confirmed" : "MISSING — grant manually!"}`);

  console.log("\n=== Configuration Complete ===");
  console.log(ADDRESSES);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
