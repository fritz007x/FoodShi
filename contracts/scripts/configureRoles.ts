import { ethers } from "hardhat";

// Deployed contract addresses on Amoy testnet
const ADDRESSES = {
  ShareToken: "0xFD0c8d14a500fdEEeB52166681E39EfA6a3c71F1",
  Staking: "0xaC1398b0edAa71566f7Cc7E81043368040F2e9A9",
  Treasury: "0x8E8d0c5d32B4A01C5a6008e5A9382026aA67d418",
  MedalNFT: "0x823889474A37ef9860245c4DF6035d9163f4AC5b",
  EmissionPool: "0xD2Dc2d6854c9F83dcE4EE08632400CE3152681dd",
  EmissionPoolReceiver: "", // TODO: fill in after deploying EmissionPoolReceiver
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Configuring contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Get contract instances
  const shareToken = await ethers.getContractAt("ShareToken", ADDRESSES.ShareToken);
  const treasury = await ethers.getContractAt("Treasury", ADDRESSES.Treasury);
  const medalNFT = await ethers.getContractAt("MedalNFT", ADDRESSES.MedalNFT);
  const emissionPool = await ethers.getContractAt("EmissionPool", ADDRESSES.EmissionPool);

  console.log("\n=== Configuring Roles ===\n");

  // Grant EMISSION_ROLE to EmissionPool
  console.log("1. Granting EMISSION_ROLE to EmissionPool...");
  const EMISSION_ROLE = await shareToken.EMISSION_ROLE();
  const hasEmissionRole = await shareToken.hasRole(EMISSION_ROLE, ADDRESSES.EmissionPool);
  if (hasEmissionRole) {
    console.log("   - EMISSION_ROLE already granted to EmissionPool");
  } else {
    const tx1 = await shareToken.grantRole(EMISSION_ROLE, ADDRESSES.EmissionPool);
    await tx1.wait();
    console.log("   - Granted EMISSION_ROLE to EmissionPool");
    console.log("   - Transaction hash:", tx1.hash);
  }

  // Grant DEPOSITOR_ROLE to Staking in Treasury
  console.log("\n2. Granting DEPOSITOR_ROLE to Staking...");
  const DEPOSITOR_ROLE = await treasury.DEPOSITOR_ROLE();
  const hasDepositorRole = await treasury.hasRole(DEPOSITOR_ROLE, ADDRESSES.Staking);
  if (hasDepositorRole) {
    console.log("   - DEPOSITOR_ROLE already granted to Staking");
  } else {
    const tx2 = await treasury.grantRole(DEPOSITOR_ROLE, ADDRESSES.Staking);
    await tx2.wait();
    console.log("   - Granted DEPOSITOR_ROLE to Staking");
    console.log("   - Transaction hash:", tx2.hash);
  }

  // Check MINTER_ROLE status on MedalNFT
  console.log("\n3. Checking MINTER_ROLE on MedalNFT...");
  const MINTER_ROLE = await medalNFT.MINTER_ROLE();
  const hasMinterRole = await medalNFT.hasRole(MINTER_ROLE, deployer.address);
  if (hasMinterRole) {
    console.log("   - MINTER_ROLE already granted to deployer");
  } else {
    console.log("   - WARNING: Deployer does not have MINTER_ROLE");
  }

  // Grant ORACLE_ROLE to EmissionPoolReceiver
  console.log("\n4. Granting ORACLE_ROLE to EmissionPoolReceiver...");
  if (!ADDRESSES.EmissionPoolReceiver) {
    console.log("   - SKIPPED: EmissionPoolReceiver address not set in ADDRESSES");
  } else {
    const ORACLE_ROLE = await emissionPool.ORACLE_ROLE();
    const hasOracleRole = await emissionPool.hasRole(ORACLE_ROLE, ADDRESSES.EmissionPoolReceiver);
    if (hasOracleRole) {
      console.log("   - ORACLE_ROLE already granted to EmissionPoolReceiver");
    } else {
      const tx4 = await emissionPool.grantRole(ORACLE_ROLE, ADDRESSES.EmissionPoolReceiver);
      await tx4.wait();
      console.log("   - Granted ORACLE_ROLE to EmissionPoolReceiver");
      console.log("   - Transaction hash:", tx4.hash);
    }
  }

  console.log("\n=== Configuration Complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
