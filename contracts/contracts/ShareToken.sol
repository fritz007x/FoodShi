// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IContracts.sol";

/**
 * @title ShareToken
 * @notice ERC-20 token for the FOODSHI platform
 * @dev Implements daily emission pool and burn mechanism for NFT minting
 */
contract ShareToken is IShareToken, ERC20, ERC20Burnable, AccessControl, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant EMISSION_ROLE = keccak256("EMISSION_ROLE");

    uint256 public constant INITIAL_SUPPLY = 10_000_000 * 10**18; // 10 million tokens
    uint256 public constant DAILY_EMISSION = 1_000 * 10**18; // 1,000 tokens per day

    // Emission tracking
    uint256 public lastEmissionTime;
    uint256 public totalEmitted;
    uint256 public immutable maxEmissionSupply;

    event EmissionClaimed(address indexed recipient, uint256 amount);

    constructor() ERC20("SHARE Token", "SHARE") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);

        // Mint initial supply to deployer (for treasury, liquidity, etc.)
        _mint(msg.sender, INITIAL_SUPPLY);

        lastEmissionTime = block.timestamp;
        maxEmissionSupply = 100_000_000 * 10**18; // 100 million max supply including emissions
    }

    /**
     * @notice Mint tokens from emission pool
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function emissionMint(address to, uint256 amount) external onlyRole(EMISSION_ROLE) nonReentrant {
        require(totalSupply() + amount <= maxEmissionSupply, "Exceeds max emission supply");

        uint256 timePassed = block.timestamp - lastEmissionTime;
        uint256 availableEmission = (timePassed * DAILY_EMISSION) / 1 days;

        require(amount <= availableEmission, "Exceeds available emission");

        totalEmitted += amount;
        _mint(to, amount);

        emit EmissionClaimed(to, amount);
    }

    /**
     * @notice Get available emission amount
     * @return Amount of tokens available for emission
     */
    function getAvailableEmission() external view returns (uint256) {
        uint256 timePassed = block.timestamp - lastEmissionTime;
        return (timePassed * DAILY_EMISSION) / 1 days;
    }

    /**
     * @notice Reset emission timer (called after daily distribution)
     */
    function resetEmissionTimer() external onlyRole(EMISSION_ROLE) {
        lastEmissionTime = block.timestamp;
    }

    // H-3 FIX: Removed dead code (stakedBalance, transferableBalanceOf, transfer/transferFrom overrides)
    // Staking contract physically transfers tokens, so no need for in-wallet locking mechanism
}
