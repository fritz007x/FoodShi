// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IShareToken
 * @notice Interface for ShareToken contract
 */
interface IShareToken {
    function emissionMint(address to, uint256 amount) external;
    function resetEmissionTimer() external;
    function getAvailableEmission() external view returns (uint256);
}

/**
 * @title IStaking
 * @notice Interface for Staking contract
 */
interface IStaking {
    function isWithdrawalEligible(address user) external view returns (bool);
    function getMultiplier(address user) external view returns (uint256);
}

/**
 * @title ITreasury
 * @notice Interface for Treasury contract
 */
interface ITreasury {
    function receiveSlashed(uint256 amount) external;
    function depositSlashed(uint256 amount) external;
}
