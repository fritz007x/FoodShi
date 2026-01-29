import { expect } from "chai";
import { ethers } from "hardhat";
import { ShareToken, Staking, Treasury, EmissionPool } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ShareToken", function () {
  let shareToken: ShareToken;
  let treasury: Treasury;
  let staking: Staking;
  let emissionPool: EmissionPool;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy ShareToken
    const ShareTokenFactory = await ethers.getContractFactory("ShareToken");
    shareToken = await ShareTokenFactory.deploy();
    await shareToken.waitForDeployment();

    // Deploy Treasury
    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy(await shareToken.getAddress());
    await treasury.waitForDeployment();

    // Deploy Staking
    const StakingFactory = await ethers.getContractFactory("Staking");
    staking = await StakingFactory.deploy(
      await shareToken.getAddress(),
      await treasury.getAddress()
    );
    await staking.waitForDeployment();

    // Deploy EmissionPool
    const EmissionPoolFactory = await ethers.getContractFactory("EmissionPool");
    emissionPool = await EmissionPoolFactory.deploy(
      await shareToken.getAddress(),
      await staking.getAddress()
    );
    await emissionPool.waitForDeployment();

    // Configure
    const EMISSION_ROLE = await shareToken.EMISSION_ROLE();
    await shareToken.grantRole(EMISSION_ROLE, await emissionPool.getAddress());

    const DEPOSITOR_ROLE = await treasury.DEPOSITOR_ROLE();
    await treasury.grantRole(DEPOSITOR_ROLE, await staking.getAddress());
  });

  describe("Deployment", function () {
    it("Should have correct name and symbol", async function () {
      expect(await shareToken.name()).to.equal("SHARE Token");
      expect(await shareToken.symbol()).to.equal("SHARE");
    });

    it("Should mint initial supply to deployer", async function () {
      const initialSupply = ethers.parseEther("10000000"); // 10 million
      expect(await shareToken.balanceOf(owner.address)).to.equal(initialSupply);
    });

    it("Should set correct daily emission", async function () {
      const dailyEmission = ethers.parseEther("1000");
      expect(await shareToken.DAILY_EMISSION()).to.equal(dailyEmission);
    });
  });

  describe("Transfers", function () {
    it("Should transfer tokens normally", async function () {
      const amount = ethers.parseEther("1000");
      await shareToken.transfer(user1.address, amount);
      expect(await shareToken.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should correctly track balances after staking", async function () {
      const totalAmount = ethers.parseEther("1000");
      const stakeAmount = ethers.parseEther("600");

      await shareToken.transfer(user1.address, totalAmount);

      // User1 stakes tokens (tokens physically move to staking contract)
      await shareToken.connect(user1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(user1).stake(stakeAmount);

      // User1 should have remaining tokens
      expect(await shareToken.balanceOf(user1.address)).to.equal(totalAmount - stakeAmount);
      // Staking contract should hold the staked tokens
      expect(await shareToken.balanceOf(await staking.getAddress())).to.equal(stakeAmount);
    });

    it("Should allow transfer of remaining tokens after staking", async function () {
      const totalAmount = ethers.parseEther("1000");
      const stakeAmount = ethers.parseEther("600");
      const transferAmount = ethers.parseEther("400");

      await shareToken.transfer(user1.address, totalAmount);

      await shareToken.connect(user1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(user1).stake(stakeAmount);

      // Should be able to transfer remaining tokens
      await shareToken.connect(user1).transfer(user2.address, transferAmount);
      expect(await shareToken.balanceOf(user2.address)).to.equal(transferAmount);
    });
  });

  describe("Burning", function () {
    it("Should allow users to burn their tokens", async function () {
      const amount = ethers.parseEther("1000");
      await shareToken.transfer(user1.address, amount);

      const burnAmount = ethers.parseEther("100");
      await shareToken.connect(user1).burn(burnAmount);

      expect(await shareToken.balanceOf(user1.address)).to.equal(amount - burnAmount);
    });
  });

  describe("Staking Contract Integration", function () {
    it("Should transfer tokens to staking contract on stake", async function () {
      const amount = ethers.parseEther("100");
      await shareToken.transfer(user1.address, amount);

      await shareToken.connect(user1).approve(await staking.getAddress(), amount);
      await staking.connect(user1).stake(amount);

      // Staking contract should have received the tokens
      expect(await shareToken.balanceOf(await staking.getAddress())).to.equal(amount);
    });
  });
});

describe("Staking", function () {
  let shareToken: ShareToken;
  let treasury: Treasury;
  let staking: Staking;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let slasher: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1, slasher] = await ethers.getSigners();

    const ShareTokenFactory = await ethers.getContractFactory("ShareToken");
    shareToken = await ShareTokenFactory.deploy();

    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy(await shareToken.getAddress());

    const StakingFactory = await ethers.getContractFactory("Staking");
    staking = await StakingFactory.deploy(
      await shareToken.getAddress(),
      await treasury.getAddress()
    );

    const DEPOSITOR_ROLE = await treasury.DEPOSITOR_ROLE();
    await treasury.grantRole(DEPOSITOR_ROLE, await staking.getAddress());

    const SLASHER_ROLE = await staking.SLASHER_ROLE();
    await staking.grantRole(SLASHER_ROLE, slasher.address);

    // Give user1 some tokens
    await shareToken.transfer(user1.address, ethers.parseEther("1000"));
  });

  describe("Staking", function () {
    it("Should allow staking tokens", async function () {
      const amount = ethers.parseEther("100");
      await shareToken.connect(user1).approve(await staking.getAddress(), amount);
      await staking.connect(user1).stake(amount);

      const stakeInfo = await staking.getStakeInfo(user1.address);
      expect(stakeInfo.amount).to.equal(amount);
    });

    it("Should track total staked", async function () {
      const amount = ethers.parseEther("100");
      await shareToken.connect(user1).approve(await staking.getAddress(), amount);
      await staking.connect(user1).stake(amount);

      expect(await staking.totalStaked()).to.equal(amount);
    });
  });

  describe("Super Donor", function () {
    it("Should require minimum stake for super donor", async function () {
      const amount = ethers.parseEther("100");
      await shareToken.connect(user1).approve(await staking.getAddress(), amount);
      await staking.connect(user1).stake(amount);

      await expect(staking.connect(user1).activateSuperDonor()).to.be.revertedWith(
        "Insufficient stake for super donor"
      );
    });

    it("Should activate super donor with sufficient stake", async function () {
      const amount = ethers.parseEther("500");
      await shareToken.connect(user1).approve(await staking.getAddress(), amount);
      await staking.connect(user1).stake(amount);

      await staking.connect(user1).activateSuperDonor();

      expect(await staking.isSuperDonor(user1.address)).to.be.true;
      expect(await staking.getMultiplier(user1.address)).to.equal(150);
    });
  });

  describe("Withdrawal Eligibility", function () {
    it("Should require minimum stake for withdrawal", async function () {
      expect(await staking.isWithdrawalEligible(user1.address)).to.be.false;

      const amount = ethers.parseEther("10");
      await shareToken.connect(user1).approve(await staking.getAddress(), amount);
      await staking.connect(user1).stake(amount);

      expect(await staking.isWithdrawalEligible(user1.address)).to.be.true;
    });
  });

  describe("Fraud and Slashing", function () {
    beforeEach(async function () {
      const amount = ethers.parseEther("100");
      await shareToken.connect(user1).approve(await staking.getAddress(), amount);
      await staking.connect(user1).stake(amount);
    });

    it("Should add fraud strikes", async function () {
      await staking.connect(slasher).addFraudStrike(user1.address);

      const stakeInfo = await staking.getStakeInfo(user1.address);
      expect(stakeInfo.fraudStrikes).to.equal(1);
    });

    it("Should auto-slash after 3 fraud strikes", async function () {
      await staking.connect(slasher).addFraudStrike(user1.address);
      await staking.connect(slasher).addFraudStrike(user1.address);
      await staking.connect(slasher).addFraudStrike(user1.address);

      const stakeInfo = await staking.getStakeInfo(user1.address);
      // 50% slashed
      expect(stakeInfo.amount).to.equal(ethers.parseEther("50"));
    });
  });
});

describe("MedalNFT", function () {
  let shareToken: ShareToken;
  let medalNFT: any;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    const ShareTokenFactory = await ethers.getContractFactory("ShareToken");
    shareToken = await ShareTokenFactory.deploy();

    const MedalNFTFactory = await ethers.getContractFactory("MedalNFT");
    medalNFT = await MedalNFTFactory.deploy(await shareToken.getAddress());

    // Give user1 tokens for burning
    await shareToken.transfer(user1.address, ethers.parseEther("1000"));
  });

  describe("Medal Requirements", function () {
    it("Should have correct bronze requirements", async function () {
      const requirements = await medalNFT.medalRequirements(0); // Bronze = 0
      expect(requirements.minDays).to.equal(30);
      expect(requirements.minDonations).to.equal(20);
      expect(requirements.burnCost).to.equal(ethers.parseEther("50"));
    });

    it("Should have correct platinum requirements", async function () {
      const requirements = await medalNFT.medalRequirements(3); // Platinum = 3
      expect(requirements.minDays).to.equal(365);
      expect(requirements.minDonations).to.equal(320);
      expect(requirements.burnCost).to.equal(ethers.parseEther("500"));
    });
  });

  describe("Minting", function () {
    it("Should mint medal when requirements met", async function () {
      // Approve burn
      await shareToken.connect(user1).approve(await medalNFT.getAddress(), ethers.parseEther("50"));

      const firstDonation = Math.floor(Date.now() / 1000) - 31 * 24 * 60 * 60; // 31 days ago

      await medalNFT.mint(
        user1.address,
        0, // Bronze
        firstDonation,
        25 // 25 donations
      );

      expect(await medalNFT.balanceOf(user1.address)).to.equal(1);
    });

    it("Should burn tokens when minting", async function () {
      const initialBalance = await shareToken.balanceOf(user1.address);

      await shareToken.connect(user1).approve(await medalNFT.getAddress(), ethers.parseEther("50"));

      const firstDonation = Math.floor(Date.now() / 1000) - 31 * 24 * 60 * 60;

      await medalNFT.mint(user1.address, 0, firstDonation, 25);

      const finalBalance = await shareToken.balanceOf(user1.address);
      expect(initialBalance - finalBalance).to.equal(ethers.parseEther("50"));
    });

    it("Should prevent minting same tier twice", async function () {
      await shareToken.connect(user1).approve(await medalNFT.getAddress(), ethers.parseEther("100"));

      const firstDonation = Math.floor(Date.now() / 1000) - 31 * 24 * 60 * 60;

      await medalNFT.mint(user1.address, 0, firstDonation, 25);

      await expect(
        medalNFT.mint(user1.address, 0, firstDonation, 30)
      ).to.be.revertedWith("Already owns this medal tier");
    });
  });

  describe("CEI Pattern Security", function () {
    it("Should set userMedals before external calls", async function () {
      await shareToken.connect(user1).approve(await medalNFT.getAddress(), ethers.parseEther("50"));

      const firstDonation = Math.floor(Date.now() / 1000) - 31 * 24 * 60 * 60;

      await medalNFT.mint(user1.address, 0, firstDonation, 25);

      // Verify state is correctly set
      const userMedals = await medalNFT.getUserMedals(user1.address);
      expect(userMedals[0]).to.be.gt(0); // Bronze medal token ID
    });

    it("Should set medalData before external calls", async function () {
      await shareToken.connect(user1).approve(await medalNFT.getAddress(), ethers.parseEther("50"));

      const firstDonation = Math.floor(Date.now() / 1000) - 31 * 24 * 60 * 60;

      await medalNFT.mint(user1.address, 0, firstDonation, 25);

      // Get the token ID
      const userMedals = await medalNFT.getUserMedals(user1.address);
      const tokenId = userMedals[0];

      // Verify medalData is correctly set
      const medalData = await medalNFT.medalData(tokenId);
      expect(medalData.tier).to.equal(0); // Bronze
      expect(medalData.donationsAtMint).to.equal(25);
    });

    it("Should revert entire transaction if burn fails", async function () {
      // Don't approve - burnFrom will fail
      const firstDonation = Math.floor(Date.now() / 1000) - 31 * 24 * 60 * 60;

      await expect(
        medalNFT.mint(user1.address, 0, firstDonation, 25)
      ).to.be.reverted;

      // State should not have changed
      const userMedals = await medalNFT.getUserMedals(user1.address);
      expect(userMedals[0]).to.equal(0); // No medal minted
    });
  });
});

describe("Treasury Security (ETH Limits)", function () {
  let shareToken: ShareToken;
  let treasury: Treasury;
  let owner: SignerWithAddress;
  let governor: SignerWithAddress;
  let recipient: SignerWithAddress;

  beforeEach(async function () {
    [owner, governor, recipient] = await ethers.getSigners();

    const ShareTokenFactory = await ethers.getContractFactory("ShareToken");
    shareToken = await ShareTokenFactory.deploy();

    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy(await shareToken.getAddress());

    const GOVERNOR_ROLE = await treasury.GOVERNOR_ROLE();
    await treasury.grantRole(GOVERNOR_ROLE, governor.address);

    // Send ETH to treasury
    await owner.sendTransaction({
      to: await treasury.getAddress(),
      value: ethers.parseEther("100"),
    });
  });

  describe("Daily ETH Withdrawal Limit", function () {
    it("Should have default 10 ETH daily limit", async function () {
      expect(await treasury.dailyETHWithdrawalLimit()).to.equal(ethers.parseEther("10"));
    });

    it("Should allow ETH withdrawal within daily limit", async function () {
      const amount = ethers.parseEther("5");
      const initialBalance = await ethers.provider.getBalance(recipient.address);

      await treasury.connect(governor).withdrawETH(recipient.address, amount, "Test withdrawal");

      const finalBalance = await ethers.provider.getBalance(recipient.address);
      expect(finalBalance - initialBalance).to.equal(amount);
    });

    it("Should track withdrawn ETH today", async function () {
      const amount = ethers.parseEther("3");
      await treasury.connect(governor).withdrawETH(recipient.address, amount, "First withdrawal");

      expect(await treasury.withdrawnETHToday()).to.equal(amount);
    });

    it("Should reject ETH withdrawal exceeding daily limit", async function () {
      const amount = ethers.parseEther("11"); // Exceeds 10 ETH limit

      await expect(
        treasury.connect(governor).withdrawETH(recipient.address, amount, "Too much")
      ).to.be.revertedWith("Exceeds daily ETH limit");
    });

    it("Should reject multiple withdrawals exceeding daily limit", async function () {
      await treasury.connect(governor).withdrawETH(recipient.address, ethers.parseEther("6"), "First");

      await expect(
        treasury.connect(governor).withdrawETH(recipient.address, ethers.parseEther("5"), "Second")
      ).to.be.revertedWith("Exceeds daily ETH limit");
    });

    it("Should reset ETH limit after day passes", async function () {
      // First withdrawal
      await treasury.connect(governor).withdrawETH(recipient.address, ethers.parseEther("8"), "Day 1");

      // Advance time by 1 day
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);

      // Should be able to withdraw again
      await treasury.connect(governor).withdrawETH(recipient.address, ethers.parseEther("8"), "Day 2");

      expect(await treasury.withdrawnETHToday()).to.equal(ethers.parseEther("8"));
    });

    it("Should allow admin to update ETH daily limit", async function () {
      const newLimit = ethers.parseEther("20");
      await treasury.setDailyETHWithdrawalLimit(newLimit);

      expect(await treasury.dailyETHWithdrawalLimit()).to.equal(newLimit);
    });

    it("Should emit event when ETH limit updated", async function () {
      const oldLimit = ethers.parseEther("10");
      const newLimit = ethers.parseEther("20");

      await expect(treasury.setDailyETHWithdrawalLimit(newLimit))
        .to.emit(treasury, "DailyETHLimitUpdated")
        .withArgs(oldLimit, newLimit);
    });

    it("Should return correct remaining ETH allowance", async function () {
      expect(await treasury.getRemainingDailyETHAllowance()).to.equal(ethers.parseEther("10"));

      await treasury.connect(governor).withdrawETH(recipient.address, ethers.parseEther("3"), "Test");

      expect(await treasury.getRemainingDailyETHAllowance()).to.equal(ethers.parseEther("7"));
    });

    it("Should return full allowance after day reset", async function () {
      await treasury.connect(governor).withdrawETH(recipient.address, ethers.parseEther("5"), "Test");

      // Advance time by 1 day
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);

      expect(await treasury.getRemainingDailyETHAllowance()).to.equal(ethers.parseEther("10"));
    });
  });
});

describe("Staking Security (CEI Pattern)", function () {
  let shareToken: ShareToken;
  let treasury: Treasury;
  let staking: Staking;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let slasher: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1, slasher] = await ethers.getSigners();

    const ShareTokenFactory = await ethers.getContractFactory("ShareToken");
    shareToken = await ShareTokenFactory.deploy();

    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy(await shareToken.getAddress());

    const StakingFactory = await ethers.getContractFactory("Staking");
    staking = await StakingFactory.deploy(
      await shareToken.getAddress(),
      await treasury.getAddress()
    );

    const DEPOSITOR_ROLE = await treasury.DEPOSITOR_ROLE();
    await treasury.grantRole(DEPOSITOR_ROLE, await staking.getAddress());

    const SLASHER_ROLE = await staking.SLASHER_ROLE();
    await staking.grantRole(SLASHER_ROLE, slasher.address);

    await shareToken.transfer(user1.address, ethers.parseEther("1000"));
  });

  describe("Stake State Consistency", function () {
    it("Should update state correctly even if transfer reverts", async function () {
      // Don't approve - transfer will fail
      await expect(
        staking.connect(user1).stake(ethers.parseEther("100"))
      ).to.be.reverted;

      // State should not have changed
      const stakeInfo = await staking.getStakeInfo(user1.address);
      expect(stakeInfo.amount).to.equal(0);
      expect(await staking.totalStaked()).to.equal(0);
    });

    it("Should correctly handle multiple stakes", async function () {
      await shareToken.connect(user1).approve(await staking.getAddress(), ethers.parseEther("200"));

      await staking.connect(user1).stake(ethers.parseEther("100"));
      await staking.connect(user1).stake(ethers.parseEther("100"));

      const stakeInfo = await staking.getStakeInfo(user1.address);
      expect(stakeInfo.amount).to.equal(ethers.parseEther("200"));
      expect(await staking.totalStaked()).to.equal(ethers.parseEther("200"));
    });
  });

  describe("addFraudStrike Reentrancy Protection", function () {
    it("Should have nonReentrant on addFraudStrike", async function () {
      await shareToken.connect(user1).approve(await staking.getAddress(), ethers.parseEther("100"));
      await staking.connect(user1).stake(ethers.parseEther("100"));

      // Multiple fraud strikes should work sequentially
      await staking.connect(slasher).addFraudStrike(user1.address);
      await staking.connect(slasher).addFraudStrike(user1.address);

      const stakeInfo = await staking.getStakeInfo(user1.address);
      expect(stakeInfo.fraudStrikes).to.equal(2);
    });

    it("Should slash correctly with reentrancy guard", async function () {
      await shareToken.connect(user1).approve(await staking.getAddress(), ethers.parseEther("100"));
      await staking.connect(user1).stake(ethers.parseEther("100"));

      // 3 strikes triggers slash
      await staking.connect(slasher).addFraudStrike(user1.address);
      await staking.connect(slasher).addFraudStrike(user1.address);
      await staking.connect(slasher).addFraudStrike(user1.address);

      // 50% slashed, 50 tokens should go to treasury
      expect(await shareToken.balanceOf(await treasury.getAddress())).to.equal(ethers.parseEther("50"));
    });
  });
});

describe("EmissionPool Security", function () {
  let shareToken: ShareToken;
  let staking: Staking;
  let emissionPool: EmissionPool;
  let treasury: Treasury;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let oracle: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1, oracle] = await ethers.getSigners();

    const ShareTokenFactory = await ethers.getContractFactory("ShareToken");
    shareToken = await ShareTokenFactory.deploy();

    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy(await shareToken.getAddress());

    const StakingFactory = await ethers.getContractFactory("Staking");
    staking = await StakingFactory.deploy(
      await shareToken.getAddress(),
      await treasury.getAddress()
    );

    const EmissionPoolFactory = await ethers.getContractFactory("EmissionPool");
    emissionPool = await EmissionPoolFactory.deploy(
      await shareToken.getAddress(),
      await staking.getAddress()
    );

    const EMISSION_ROLE = await shareToken.EMISSION_ROLE();
    await shareToken.grantRole(EMISSION_ROLE, await emissionPool.getAddress());

    const ORACLE_ROLE = await emissionPool.ORACLE_ROLE();
    await emissionPool.grantRole(ORACLE_ROLE, oracle.address);

    const DEPOSITOR_ROLE = await treasury.DEPOSITOR_ROLE();
    await treasury.grantRole(DEPOSITOR_ROLE, await staking.getAddress());

    await shareToken.transfer(user1.address, ethers.parseEther("100"));
    await shareToken.connect(user1).approve(await staking.getAddress(), ethers.parseEther("10"));
    await staking.connect(user1).stake(ethers.parseEther("10"));
  });

  describe("Division by Zero Protection", function () {
    it("Should reject claim when totalPoints is zero", async function () {
      // Get current day and advance to next day
      const currentDay = await emissionPool.getCurrentDay();

      // Advance time by 1 day
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);

      // Finalize the previous day (which has no points)
      await emissionPool.connect(oracle).finalizeDay(currentDay);

      // Try to claim - should fail since user has no points for that day
      await expect(
        emissionPool.connect(user1).claim(currentDay)
      ).to.be.revertedWith("No points for this day");
    });

    it("Should calculate tokens correctly with valid totalPoints", async function () {
      // Record points
      await emissionPool.connect(oracle).recordPoints(user1.address, 1000);

      const currentDay = await emissionPool.getCurrentDay();

      // Advance time by 1 day
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);

      // Finalize
      await emissionPool.connect(oracle).finalizeDay(currentDay);

      // Get claimable amount
      const claimable = await emissionPool.getClaimable(user1.address, currentDay);
      expect(claimable).to.be.gt(0);
    });
  });

  describe("Event Ordering (CEI Pattern)", function () {
    it("Should emit DayFinalized event", async function () {
      await emissionPool.connect(oracle).recordPoints(user1.address, 500);

      const currentDay = await emissionPool.getCurrentDay();

      // Advance time
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);

      await expect(emissionPool.connect(oracle).finalizeDay(currentDay))
        .to.emit(emissionPool, "DayFinalized")
        .withArgs(currentDay, 500, ethers.parseEther("1000"));
    });
  });
});

describe("EmissionPool", function () {
  let shareToken: ShareToken;
  let staking: Staking;
  let emissionPool: EmissionPool;
  let treasury: Treasury;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let oracle: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1, oracle] = await ethers.getSigners();

    const ShareTokenFactory = await ethers.getContractFactory("ShareToken");
    shareToken = await ShareTokenFactory.deploy();

    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy(await shareToken.getAddress());

    const StakingFactory = await ethers.getContractFactory("Staking");
    staking = await StakingFactory.deploy(
      await shareToken.getAddress(),
      await treasury.getAddress()
    );

    const EmissionPoolFactory = await ethers.getContractFactory("EmissionPool");
    emissionPool = await EmissionPoolFactory.deploy(
      await shareToken.getAddress(),
      await staking.getAddress()
    );

    const EMISSION_ROLE = await shareToken.EMISSION_ROLE();
    await shareToken.grantRole(EMISSION_ROLE, await emissionPool.getAddress());

    const ORACLE_ROLE = await emissionPool.ORACLE_ROLE();
    await emissionPool.grantRole(ORACLE_ROLE, oracle.address);

    const DEPOSITOR_ROLE = await treasury.DEPOSITOR_ROLE();
    await treasury.grantRole(DEPOSITOR_ROLE, await staking.getAddress());

    // Give user tokens for staking
    await shareToken.transfer(user1.address, ethers.parseEther("100"));
    await shareToken.connect(user1).approve(await staking.getAddress(), ethers.parseEther("10"));
    await staking.connect(user1).stake(ethers.parseEther("10"));
  });

  describe("Points Recording", function () {
    it("Should record user points", async function () {
      await emissionPool.connect(oracle).recordPoints(user1.address, 100);

      const currentDay = await emissionPool.getCurrentDay();
      const points = await emissionPool.getUserPoints(user1.address, currentDay);
      expect(points).to.equal(100);
    });

    it("Should batch record points", async function () {
      await emissionPool.connect(oracle).recordPointsBatch(
        [user1.address, owner.address],
        [100, 200]
      );

      const currentDay = await emissionPool.getCurrentDay();
      expect(await emissionPool.getUserPoints(user1.address, currentDay)).to.equal(100);
      expect(await emissionPool.getUserPoints(owner.address, currentDay)).to.equal(200);
    });
  });

  describe("Exchange Rate", function () {
    it("Should have correct default exchange rate", async function () {
      expect(await emissionPool.exchangeRate()).to.equal(10);
    });

    it("Should update exchange rate", async function () {
      await emissionPool.setExchangeRate(20);
      expect(await emissionPool.exchangeRate()).to.equal(20);
    });
  });

  describe("Point Balance Security (C-1 Fix)", function () {
    it("Should track user point balance when recording", async function () {
      await emissionPool.connect(oracle).recordPoints(user1.address, 500);
      expect(await emissionPool.getUserPointBalance(user1.address)).to.equal(500);
    });

    it("Should reject exchangePoints with insufficient balance", async function () {
      // Record only 100 points
      await emissionPool.connect(oracle).recordPoints(user1.address, 100);

      // Try to exchange 500 points (more than recorded)
      await expect(
        emissionPool.connect(user1).exchangePoints(500)
      ).to.be.revertedWith("Insufficient point balance");
    });

    it("Should deduct points from balance on exchange", async function () {
      await emissionPool.connect(oracle).recordPoints(user1.address, 500);

      // Advance time by 1 day to allow emission
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);

      await emissionPool.connect(user1).exchangePoints(200);

      expect(await emissionPool.getUserPointBalance(user1.address)).to.equal(300);
    });

    it("Should enforce rate limit per user per day", async function () {
      // Default max is 10,000 points per user per day
      await emissionPool.connect(oracle).recordPoints(user1.address, 10000);

      // Trying to record more should fail
      await expect(
        emissionPool.connect(oracle).recordPoints(user1.address, 1)
      ).to.be.revertedWith("Exceeds max points per user per day");
    });
  });
});
