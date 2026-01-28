// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IContracts.sol";

/**
 * @title Treasury
 * @notice Treasury contract for FOODSHI platform
 * @dev Receives slashed tokens and advertising revenue, with governance-controlled withdrawals
 */
contract Treasury is ITreasury, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    IERC20 public immutable shareToken;

    // Track deposits by source
    uint256 public totalSlashedTokens;
    uint256 public totalAdRevenue;
    uint256 public totalDonations;

    // Withdrawal limits
    uint256 public dailyWithdrawalLimit;
    uint256 public lastWithdrawalDay;
    uint256 public withdrawnToday;

    event TokensDeposited(address indexed from, uint256 amount, string source);
    event TokensWithdrawn(address indexed to, uint256 amount, string reason);
    event ETHWithdrawn(address indexed to, uint256 amount, string reason);
    event DailyLimitUpdated(uint256 oldLimit, uint256 newLimit);

    constructor(address _shareToken) {
        require(_shareToken != address(0), "Invalid token address");

        shareToken = IERC20(_shareToken);
        dailyWithdrawalLimit = 10_000 * 10**18; // 10,000 tokens per day default

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNOR_ROLE, msg.sender);
    }

    /**
     * @notice Receive ETH donations
     */
    receive() external payable {
        emit TokensDeposited(msg.sender, msg.value, "ETH_DONATION");
    }

    /**
     * @notice Deposit slashed tokens (legacy - uses transferFrom)
     * @param amount Amount of tokens
     */
    function depositSlashed(uint256 amount) external onlyRole(DEPOSITOR_ROLE) {
        shareToken.safeTransferFrom(msg.sender, address(this), amount);
        totalSlashedTokens += amount;
        emit TokensDeposited(msg.sender, amount, "SLASHED");
    }

    /**
     * @notice Receive slashed tokens via direct transfer
     * @dev H-2 FIX: Safer pattern - tokens transferred before this call, we just track
     * @param amount Amount of tokens already transferred
     */
    function receiveSlashed(uint256 amount) external onlyRole(DEPOSITOR_ROLE) {
        totalSlashedTokens += amount;
        emit TokensDeposited(msg.sender, amount, "SLASHED");
    }

    /**
     * @notice Deposit advertising revenue
     * @param amount Amount of tokens
     */
    function depositAdRevenue(uint256 amount) external onlyRole(DEPOSITOR_ROLE) {
        shareToken.safeTransferFrom(msg.sender, address(this), amount);
        totalAdRevenue += amount;
        emit TokensDeposited(msg.sender, amount, "AD_REVENUE");
    }

    /**
     * @notice Deposit general donations
     * @param amount Amount of tokens
     */
    function depositDonation(uint256 amount) external {
        shareToken.safeTransferFrom(msg.sender, address(this), amount);
        totalDonations += amount;
        emit TokensDeposited(msg.sender, amount, "DONATION");
    }

    /**
     * @notice Withdraw tokens (governance controlled)
     * @param to Recipient address
     * @param amount Amount of tokens
     * @param reason Reason for withdrawal
     */
    function withdrawTokens(
        address to,
        uint256 amount,
        string calldata reason
    ) external onlyRole(GOVERNOR_ROLE) nonReentrant {
        require(to != address(0), "Invalid recipient");

        // Check daily limit
        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > lastWithdrawalDay) {
            lastWithdrawalDay = currentDay;
            withdrawnToday = 0;
        }

        require(withdrawnToday + amount <= dailyWithdrawalLimit, "Exceeds daily limit");
        withdrawnToday += amount;

        shareToken.safeTransfer(to, amount);
        emit TokensWithdrawn(to, amount, reason);
    }

    /**
     * @notice Withdraw ETH (governance controlled)
     * @param to Recipient address
     * @param amount Amount of ETH
     * @param reason Reason for withdrawal
     */
    function withdrawETH(
        address payable to,
        uint256 amount,
        string calldata reason
    ) external onlyRole(GOVERNOR_ROLE) nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(address(this).balance >= amount, "Insufficient ETH balance");

        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");

        emit ETHWithdrawn(to, amount, reason);
    }

    /**
     * @notice Update daily withdrawal limit
     * @param newLimit New limit in tokens
     */
    function setDailyWithdrawalLimit(uint256 newLimit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldLimit = dailyWithdrawalLimit;
        dailyWithdrawalLimit = newLimit;
        emit DailyLimitUpdated(oldLimit, newLimit);
    }

    /**
     * @notice Get token balance
     * @return Token balance of treasury
     */
    function getTokenBalance() external view returns (uint256) {
        return shareToken.balanceOf(address(this));
    }

    /**
     * @notice Get ETH balance
     * @return ETH balance of treasury
     */
    function getETHBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Get remaining daily withdrawal allowance
     * @return Remaining tokens that can be withdrawn today
     */
    function getRemainingDailyAllowance() external view returns (uint256) {
        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > lastWithdrawalDay) {
            return dailyWithdrawalLimit;
        }
        return dailyWithdrawalLimit - withdrawnToday;
    }
}
