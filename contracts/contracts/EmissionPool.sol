// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IContracts.sol";

/**
 * @title EmissionPool
 * @notice Daily token distribution for FOODSHI platform
 * @dev Distributes 1,000 SHARE tokens daily based on verified point share
 */
contract EmissionPool is AccessControl, ReentrancyGuard {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    IShareToken public immutable shareToken;
    IStaking public immutable staking;

    uint256 public constant DAILY_EMISSION = 1_000 * 10**18; // 1,000 tokens per day

    // Track daily distributions
    struct DailyDistribution {
        uint256 timestamp;
        uint256 totalPoints;
        uint256 totalDistributed;
        bool finalized;
    }

    // Day number => distribution data
    mapping(uint256 => DailyDistribution) public dailyDistributions;

    // Day number => user => points earned that day
    mapping(uint256 => mapping(address => uint256)) public userDailyPoints;

    // Day number => user => claimed
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    // User point balances (for exchangePoints - deducted on use)
    mapping(address => uint256) public userPointBalance;

    // Rate limiting: max points per user per day
    uint256 public maxPointsPerUserPerDay = 10_000;
    mapping(uint256 => mapping(address => uint256)) public userDailyPointsRecorded;

    // Current distribution day (set at deployment)
    uint256 public immutable currentDay;

    // Minimum points to claim
    uint256 public minPointsToExchange = 100;

    // Exchange rate: points per token (10 points = 1 token means rate = 10)
    uint256 public exchangeRate = 10;

    event PointsRecorded(uint256 indexed day, address indexed user, uint256 points);
    event DayFinalized(uint256 indexed day, uint256 totalPoints, uint256 totalDistributed);
    event TokensClaimed(uint256 indexed day, address indexed user, uint256 points, uint256 tokens);
    event PointsExchanged(address indexed user, uint256 points, uint256 tokens);
    event ExchangeRateUpdated(uint256 oldRate, uint256 newRate);
    event MaxPointsPerUserPerDayUpdated(uint256 oldMax, uint256 newMax);

    constructor(address _shareToken, address _staking) {
        require(_shareToken != address(0), "Invalid token address");
        require(_staking != address(0), "Invalid staking address");

        shareToken = IShareToken(_shareToken);
        staking = IStaking(_staking);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);

        currentDay = block.timestamp / 1 days;
    }

    /**
     * @notice Record user points for the day (called by backend oracle)
     * @param user User address
     * @param points Points earned
     */
    function recordPoints(address user, uint256 points) external onlyRole(ORACLE_ROLE) {
        require(user != address(0), "Invalid user address");
        require(points > 0, "Points must be positive");
        uint256 day = block.timestamp / 1 days;

        // Rate limiting: check user hasn't exceeded daily limit
        uint256 newDailyTotal = userDailyPointsRecorded[day][user] + points;
        require(newDailyTotal <= maxPointsPerUserPerDay, "Exceeds max points per user per day");
        userDailyPointsRecorded[day][user] = newDailyTotal;

        // Initialize day if needed
        if (dailyDistributions[day].timestamp == 0) {
            dailyDistributions[day].timestamp = block.timestamp;
        }

        userDailyPoints[day][user] += points;
        dailyDistributions[day].totalPoints += points;

        // Add to user's exchangeable point balance
        userPointBalance[user] += points;

        emit PointsRecorded(day, user, points);
    }

    /**
     * @notice Record points for multiple users (batch)
     * @param users Array of user addresses
     * @param points Array of points
     */
    function recordPointsBatch(
        address[] calldata users,
        uint256[] calldata points
    ) external onlyRole(ORACLE_ROLE) {
        require(users.length == points.length, "Array length mismatch");

        uint256 day = block.timestamp / 1 days;

        // Initialize day if needed
        if (dailyDistributions[day].timestamp == 0) {
            dailyDistributions[day].timestamp = block.timestamp;
        }

        uint256 totalNewPoints = 0;
        for (uint256 i = 0; i < users.length; i++) {
            if (points[i] == 0) continue; // Skip zero points
            require(users[i] != address(0), "Invalid user address");

            // Rate limiting: check user hasn't exceeded daily limit
            uint256 newDailyTotal = userDailyPointsRecorded[day][users[i]] + points[i];
            require(newDailyTotal <= maxPointsPerUserPerDay, "Exceeds max points per user per day");
            userDailyPointsRecorded[day][users[i]] = newDailyTotal;

            userDailyPoints[day][users[i]] += points[i];
            totalNewPoints += points[i];

            // Add to user's exchangeable point balance
            userPointBalance[users[i]] += points[i];

            emit PointsRecorded(day, users[i], points[i]);
        }

        dailyDistributions[day].totalPoints += totalNewPoints;
    }

    /**
     * @notice Finalize a day's distribution (called at midnight UTC)
     * @param day Day number to finalize
     */
    function finalizeDay(uint256 day) external onlyRole(ORACLE_ROLE) {
        require(day < block.timestamp / 1 days, "Cannot finalize current or future day");
        require(!dailyDistributions[day].finalized, "Day already finalized");

        DailyDistribution storage dist = dailyDistributions[day];
        dist.finalized = true;
        dist.totalDistributed = DAILY_EMISSION;

        // Reset emission timer
        shareToken.resetEmissionTimer();

        emit DayFinalized(day, dist.totalPoints, dist.totalDistributed);
    }

    /**
     * @notice Claim tokens for a specific day
     * @param day Day number to claim for
     */
    function claim(uint256 day) external nonReentrant {
        require(dailyDistributions[day].finalized, "Day not finalized");
        require(!hasClaimed[day][msg.sender], "Already claimed");

        uint256 userPoints = userDailyPoints[day][msg.sender];
        require(userPoints > 0, "No points for this day");

        DailyDistribution memory dist = dailyDistributions[day];

        // Calculate user's share of daily emission
        // Formula: (userPoints / totalPoints) * DAILY_EMISSION * multiplier
        // Multiply all numerators first, then divide once to minimize precision loss
        uint256 multiplier = staking.getMultiplier(msg.sender);
        uint256 tokens = (userPoints * dist.totalDistributed * multiplier) / (dist.totalPoints * 100);

        hasClaimed[day][msg.sender] = true;

        // Mint tokens to user
        shareToken.emissionMint(msg.sender, tokens);

        emit TokensClaimed(day, msg.sender, userPoints, tokens);
    }

    /**
     * @notice Exchange karma points for tokens directly
     * @param points Points to exchange
     */
    function exchangePoints(uint256 points) external nonReentrant {
        require(points >= minPointsToExchange, "Below minimum exchange");
        require(staking.isWithdrawalEligible(msg.sender), "Must stake to withdraw");

        // C-1 FIX: Verify user has sufficient point balance (on-chain verification)
        require(userPointBalance[msg.sender] >= points, "Insufficient point balance");

        // Deduct points from user's balance
        userPointBalance[msg.sender] -= points;

        // Calculate tokens: (points * multiplier) / (exchangeRate * 100)
        // Multiply all numerators first, then divide once to minimize precision loss
        uint256 multiplier = staking.getMultiplier(msg.sender);
        uint256 tokens = (points * 10**18 * multiplier) / (exchangeRate * 100);

        // Mint tokens to user
        shareToken.emissionMint(msg.sender, tokens);

        emit PointsExchanged(msg.sender, points, tokens);
    }

    /**
     * @notice Update exchange rate
     * @param newRate New exchange rate
     */
    function setExchangeRate(uint256 newRate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRate > 0, "Rate must be positive");
        uint256 oldRate = exchangeRate;
        exchangeRate = newRate;
        emit ExchangeRateUpdated(oldRate, newRate);
    }

    /**
     * @notice Update minimum points to exchange
     * @param newMin New minimum points
     */
    function setMinPointsToExchange(uint256 newMin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minPointsToExchange = newMin;
    }

    /**
     * @notice Update max points per user per day (rate limiting)
     * @param newMax New maximum points per user per day
     */
    function setMaxPointsPerUserPerDay(uint256 newMax) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMax > 0, "Max must be positive");
        uint256 oldMax = maxPointsPerUserPerDay;
        maxPointsPerUserPerDay = newMax;
        emit MaxPointsPerUserPerDayUpdated(oldMax, newMax);
    }

    /**
     * @notice Get user's exchangeable point balance
     * @param user User address
     * @return Point balance available for exchange
     */
    function getUserPointBalance(address user) external view returns (uint256) {
        return userPointBalance[user];
    }

    /**
     * @notice Get user's claimable tokens for a day
     * @param user User address
     * @param day Day number
     * @return Claimable token amount
     */
    function getClaimable(address user, uint256 day) external view returns (uint256) {
        if (!dailyDistributions[day].finalized) return 0;
        if (hasClaimed[day][user]) return 0;

        uint256 userPoints = userDailyPoints[day][user];
        if (userPoints == 0) return 0;

        DailyDistribution memory dist = dailyDistributions[day];
        uint256 multiplier = staking.getMultiplier(user);
        return (userPoints * dist.totalDistributed * multiplier) / (dist.totalPoints * 100);
    }

    /**
     * @notice Get current day number
     * @return Current day
     */
    function getCurrentDay() external view returns (uint256) {
        return block.timestamp / 1 days;
    }

    /**
     * @notice Get user's points for a day
     * @param user User address
     * @param day Day number
     * @return Points earned
     */
    function getUserPoints(address user, uint256 day) external view returns (uint256) {
        return userDailyPoints[day][user];
    }
}
