import { ethers } from "hardhat";

const ADDRESSES = {
  ShareToken: "0xFD0c8d14a500fdEEeB52166681E39EfA6a3c71F1",
  Staking: "0xaC1398b0edAa71566f7Cc7E81043368040F2e9A9",
  Treasury: "0x8E8d0c5d32B4A01C5a6008e5A9382026aA67d418",
  MedalNFT: "0x823889474A37ef9860245c4DF6035d9163f4AC5b",
  EmissionPool: "0xD2Dc2d6854c9F83dcE4EE08632400CE3152681dd",
  Deployer: "0x8F28Ef284CD19f133C67F79Ba7505D72CB782544",
};

async function main() {
  console.log("=== Verifying Role Configuration on Amoy ===\n");

  // Get contract instances
  const shareToken = await ethers.getContractAt("ShareToken", ADDRESSES.ShareToken);
  const treasury = await ethers.getContractAt("Treasury", ADDRESSES.Treasury);
  const medalNFT = await ethers.getContractAt("MedalNFT", ADDRESSES.MedalNFT);
  const emissionPool = await ethers.getContractAt("EmissionPool", ADDRESSES.EmissionPool);

  // Get role hashes
  const EMISSION_ROLE = await shareToken.EMISSION_ROLE();
  const DEPOSITOR_ROLE = await treasury.DEPOSITOR_ROLE();
  const MINTER_ROLE = await medalNFT.MINTER_ROLE();
  const ORACLE_ROLE = await emissionPool.ORACLE_ROLE();
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

  console.log("Role Hashes:");
  console.log("  EMISSION_ROLE:", EMISSION_ROLE);
  console.log("  DEPOSITOR_ROLE:", DEPOSITOR_ROLE);
  console.log("  MINTER_ROLE:", MINTER_ROLE);
  console.log("  ORACLE_ROLE:", ORACLE_ROLE);

  console.log("\n--- ShareToken Roles ---");
  const emissionPoolHasEmissionRole = await shareToken.hasRole(EMISSION_ROLE, ADDRESSES.EmissionPool);
  const deployerHasAdminOnShareToken = await shareToken.hasRole(DEFAULT_ADMIN_ROLE, ADDRESSES.Deployer);
  console.log(`  EmissionPool has EMISSION_ROLE: ${emissionPoolHasEmissionRole ? "✅ YES" : "❌ NO"}`);
  console.log(`  Deployer has DEFAULT_ADMIN_ROLE: ${deployerHasAdminOnShareToken ? "✅ YES" : "❌ NO"}`);

  console.log("\n--- Treasury Roles ---");
  const stakingHasDepositorRole = await treasury.hasRole(DEPOSITOR_ROLE, ADDRESSES.Staking);
  const deployerHasAdminOnTreasury = await treasury.hasRole(DEFAULT_ADMIN_ROLE, ADDRESSES.Deployer);
  console.log(`  Staking has DEPOSITOR_ROLE: ${stakingHasDepositorRole ? "✅ YES" : "❌ NO"}`);
  console.log(`  Deployer has DEFAULT_ADMIN_ROLE: ${deployerHasAdminOnTreasury ? "✅ YES" : "❌ NO"}`);

  console.log("\n--- MedalNFT Roles ---");
  const deployerHasMinterRole = await medalNFT.hasRole(MINTER_ROLE, ADDRESSES.Deployer);
  const deployerHasAdminOnMedalNFT = await medalNFT.hasRole(DEFAULT_ADMIN_ROLE, ADDRESSES.Deployer);
  console.log(`  Deployer has MINTER_ROLE: ${deployerHasMinterRole ? "✅ YES" : "❌ NO"}`);
  console.log(`  Deployer has DEFAULT_ADMIN_ROLE: ${deployerHasAdminOnMedalNFT ? "✅ YES" : "❌ NO"}`);

  console.log("\n--- EmissionPool Roles ---");
  const deployerHasOracleRole = await emissionPool.hasRole(ORACLE_ROLE, ADDRESSES.Deployer);
  const deployerHasAdminOnEmissionPool = await emissionPool.hasRole(DEFAULT_ADMIN_ROLE, ADDRESSES.Deployer);
  console.log(`  Deployer has ORACLE_ROLE: ${deployerHasOracleRole ? "✅ YES" : "❌ NO"}`);
  console.log(`  Deployer has DEFAULT_ADMIN_ROLE: ${deployerHasAdminOnEmissionPool ? "✅ YES" : "❌ NO"}`);

  // Summary
  console.log("\n=== SUMMARY ===");
  const criticalRoles = [
    { name: "EmissionPool → EMISSION_ROLE on ShareToken", ok: emissionPoolHasEmissionRole },
    { name: "Staking → DEPOSITOR_ROLE on Treasury", ok: stakingHasDepositorRole },
  ];

  const allCriticalOk = criticalRoles.every(r => r.ok);

  criticalRoles.forEach(r => {
    console.log(`  ${r.ok ? "✅" : "❌"} ${r.name}`);
  });

  if (allCriticalOk) {
    console.log("\n✅ All critical roles are configured correctly!");
  } else {
    console.log("\n❌ Some critical roles are missing. Run configureRoles.ts to fix.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
