import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // 1. Deploy ShareToken
  console.log("\n1. Deploying ShareToken...");
  const ShareToken = await ethers.getContractFactory("ShareToken");
  const shareToken = await ShareToken.deploy();
  await shareToken.waitForDeployment();
  const shareTokenAddress = await shareToken.getAddress();
  console.log("ShareToken deployed to:", shareTokenAddress);

  // 2. Deploy Treasury
  console.log("\n2. Deploying Treasury...");
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(shareTokenAddress);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("Treasury deployed to:", treasuryAddress);

  // 3. Deploy Staking
  console.log("\n3. Deploying Staking...");
  const Staking = await ethers.getContractFactory("Staking");
  const staking = await Staking.deploy(shareTokenAddress, treasuryAddress);
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  console.log("Staking deployed to:", stakingAddress);

  // 4. Deploy MedalNFT
  console.log("\n4. Deploying MedalNFT...");
  const MedalNFT = await ethers.getContractFactory("MedalNFT");
  const medalNFT = await MedalNFT.deploy(shareTokenAddress);
  await medalNFT.waitForDeployment();
  const medalNFTAddress = await medalNFT.getAddress();
  console.log("MedalNFT deployed to:", medalNFTAddress);

  // 5. Deploy EmissionPool
  console.log("\n5. Deploying EmissionPool...");
  const EmissionPool = await ethers.getContractFactory("EmissionPool");
  const emissionPool = await EmissionPool.deploy(shareTokenAddress, stakingAddress);
  await emissionPool.waitForDeployment();
  const emissionPoolAddress = await emissionPool.getAddress();
  console.log("EmissionPool deployed to:", emissionPoolAddress);

  // 6. Configure contracts
  console.log("\n6. Configuring contracts...");

  
  // Grant EMISSION_ROLE to EmissionPool
  const EMISSION_ROLE = await shareToken.EMISSION_ROLE();
  await shareToken.grantRole(EMISSION_ROLE, emissionPoolAddress);
  console.log("- Granted EMISSION_ROLE to EmissionPool");

  // Grant DEPOSITOR_ROLE to Staking in Treasury
  const DEPOSITOR_ROLE = await treasury.DEPOSITOR_ROLE();
  await treasury.grantRole(DEPOSITOR_ROLE, stakingAddress);
  console.log("- Granted DEPOSITOR_ROLE to Staking");

  // Grant MINTER_ROLE to backend/API address (use deployer for now)
  const MINTER_ROLE = await medalNFT.MINTER_ROLE();
  console.log("- MINTER_ROLE already granted to deployer");

  console.log("\n=== Deployment Complete ===");
  console.log({
    ShareToken: shareTokenAddress,
    Treasury: treasuryAddress,
    Staking: stakingAddress,
    MedalNFT: medalNFTAddress,
    EmissionPool: emissionPoolAddress,
  });

  // Write deployment addresses to file
  const fs = await import("fs");
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    contracts: {
      ShareToken: shareTokenAddress,
      Treasury: treasuryAddress,
      Staking: stakingAddress,
      MedalNFT: medalNFTAddress,
      EmissionPool: emissionPoolAddress,
    },
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    "./deployments.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment info saved to deployments.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
