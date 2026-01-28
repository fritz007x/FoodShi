// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IContracts.sol";

/**
 * @title Staking
 * @notice Staking contract for FOODSHI platform
 * @dev Manages staking for withdrawal eligibility and Super Donor status
 */
contract Staking is IStaking, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");

    IERC20 public immutable shareToken;
    ITreasury public immutable treasury;

    // Staking parameters
    uint256 public constant MINIMUM_STAKE = 10 * 10**18; // 10 SHARE for withdrawal eligibility
    uint256 public constant SUPER_DONOR_STAKE = 500 * 10**18; // 500 SHARE for super donor
    uint256 public constant SUPER_DONOR_LOCK_PERIOD = 90 days; // 3 months lock
    uint256 public constant SUPER_DONOR_MULTIPLIER = 150; // 1.5x multiplier (in basis points / 100)
    uint256 public constant FRAUD_STRIKES_TO_SLASH = 3;
    uint256 public constant SLASH_PERCENTAGE = 50; // 50% of staked tokens

    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        uint256 unlockTime;
        bool isSuperDonor;
        uint8 fraudStrikes;
    }

    mapping(address => StakeInfo) public stakes;

    uint256 public totalStaked;

    event Staked(address indexed user, uint256 amount, bool isSuperDonor);
    event Unstaked(address indexed user, uint256 amount);
    event SuperDonorActivated(address indexed user, uint256 unlockTime);
    event FraudStrikeAdded(address indexed user, uint8 totalStrikes);
    event Slashed(address indexed user, uint256 amount);

    constructor(address _shareToken, address _treasury) {
        require(_shareToken != address(0), "Invalid token address");
        require(_treasury != address(0), "Invalid treasury address");

        shareToken = IERC20(_shareToken);
        treasury = ITreasury(_treasury);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SLASHER_ROLE, msg.sender);
    }

    /**
     * @notice Stake tokens for withdrawal eligibility
     * @param amount Amount to stake
     */
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");

        StakeInfo storage stakeInfo = stakes[msg.sender];

        shareToken.safeTransferFrom(msg.sender, address(this), amount);

        stakeInfo.amount += amount;
        stakeInfo.stakedAt = block.timestamp;
        totalStaked += amount;

        emit Staked(msg.sender, amount, stakeInfo.isSuperDonor);
    }

    /**
     * @notice Activate Super Donor status (requires 500 SHARE staked)
     */
    function activateSuperDonor() external {
        StakeInfo storage stakeInfo = stakes[msg.sender];

        require(stakeInfo.amount >= SUPER_DONOR_STAKE, "Insufficient stake for super donor");
        require(!stakeInfo.isSuperDonor, "Already a super donor");

        stakeInfo.isSuperDonor = true;
        stakeInfo.unlockTime = block.timestamp + SUPER_DONOR_LOCK_PERIOD;

        emit SuperDonorActivated(msg.sender, stakeInfo.unlockTime);
    }

    /**
     * @notice Unstake tokens
     * @param amount Amount to unstake
     */
    function unstake(uint256 amount) external nonReentrant {
        StakeInfo storage stakeInfo = stakes[msg.sender];

        require(stakeInfo.amount >= amount, "Insufficient staked balance");

        // Check super donor lock period
        if (stakeInfo.isSuperDonor) {
            require(block.timestamp >= stakeInfo.unlockTime, "Super donor lock period not over");

            // If unstaking below super donor threshold, remove status
            if (stakeInfo.amount - amount < SUPER_DONOR_STAKE) {
                stakeInfo.isSuperDonor = false;
            }
        }

        stakeInfo.amount -= amount;
        totalStaked -= amount;

        shareToken.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    /**
     * @notice Add fraud strike to user (called by backend oracle)
     * @param user User address
     */
    function addFraudStrike(address user) external onlyRole(SLASHER_ROLE) {
        StakeInfo storage stakeInfo = stakes[user];
        stakeInfo.fraudStrikes++;

        emit FraudStrikeAdded(user, stakeInfo.fraudStrikes);

        // Auto-slash if reached threshold
        if (stakeInfo.fraudStrikes >= FRAUD_STRIKES_TO_SLASH && stakeInfo.amount > 0) {
            _slash(user);
        }
    }

    /**
     * @notice Slash user's staked tokens
     * @param user User address
     */
    function slash(address user) external onlyRole(SLASHER_ROLE) {
        require(stakes[user].fraudStrikes >= FRAUD_STRIKES_TO_SLASH, "Not enough fraud strikes");
        _slash(user);
    }

    /**
     * @notice Internal slash function
     */
    function _slash(address user) internal {
        StakeInfo storage stakeInfo = stakes[user];

        uint256 slashAmount = (stakeInfo.amount * SLASH_PERCENTAGE) / 100;

        // Update all state before external calls (CEI pattern)
        stakeInfo.isSuperDonor = false;

        if (slashAmount > 0) {
            stakeInfo.amount -= slashAmount;
            totalStaked -= slashAmount;

            emit Slashed(user, slashAmount);

            // External calls last (CEI pattern)
            shareToken.safeTransfer(address(treasury), slashAmount);
            treasury.receiveSlashed(slashAmount);
        }
    }

    /**
     * @notice Check if user is eligible for withdrawal
     * @param user User address
     * @return True if eligible
     */
    function isWithdrawalEligible(address user) external view returns (bool) {
        return stakes[user].amount >= MINIMUM_STAKE;
    }

    /**
     * @notice Check if user is a super donor
     * @param user User address
     * @return True if super donor
     */
    function isSuperDonor(address user) external view returns (bool) {
        return stakes[user].isSuperDonor;
    }

    /**
     * @notice Get multiplier for user (100 = 1x, 150 = 1.5x)
     * @param user User address
     * @return Multiplier in basis points / 100
     */
    function getMultiplier(address user) external view returns (uint256) {
        if (stakes[user].isSuperDonor) {
            return SUPER_DONOR_MULTIPLIER;
        }
        return 100;
    }

    /**
     * @notice Get user's stake info
     * @param user User address
     * @return StakeInfo struct
     */
    function getStakeInfo(address user) external view returns (StakeInfo memory) {
        return stakes[user];
    }

    /**
     * @notice Get time remaining until super donor unlock
     * @param user User address
     * @return Seconds remaining (0 if unlocked or not super donor)
     */
    function getUnlockTimeRemaining(address user) external view returns (uint256) {
        StakeInfo memory stakeInfo = stakes[user];
        if (!stakeInfo.isSuperDonor || block.timestamp >= stakeInfo.unlockTime) {
            return 0;
        }
        return stakeInfo.unlockTime - block.timestamp;
    }
}
