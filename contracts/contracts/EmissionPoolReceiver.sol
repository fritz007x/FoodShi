// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/keystone/interfaces/IReceiver.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IContracts.sol";

/**
 * @title EmissionPoolReceiver
 * @notice Chainlink CRE consumer that receives DON consensus reports and
 *         forwards daily point distributions to EmissionPool.
 * @dev The Chainlink forwarder calls onReport() with a signed, DON-consensus
 *      payload. The report is ABI-decoded and forwarded to EmissionPool's
 *      recordPointsBatch() and finalizeDay() functions.
 */
contract EmissionPoolReceiver is IReceiver, AccessControl {
    IEmissionPool public immutable emissionPool;
    address public immutable forwarder; // Chainlink CRE forwarder address

    event ReportReceived(uint256 indexed day, uint256 userCount);

    constructor(address _emissionPool, address _forwarder) {
        require(_emissionPool != address(0), "Invalid emission pool address");
        require(_forwarder != address(0), "Invalid forwarder address");

        emissionPool = IEmissionPool(_emissionPool);
        forwarder = _forwarder;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Called by the Chainlink CRE forwarder with the DON-consensus report.
     * @param metadata Chainlink-provided metadata (workflow ID, report ID, etc.)
     * @param report ABI-encoded (address[] users, uint256[] points, uint256 day)
     */
    function onReport(bytes calldata metadata, bytes calldata report) external override {
        require(msg.sender == forwarder, "Only Chainlink forwarder");

        (address[] memory users, uint256[] memory points, uint256 day) =
            abi.decode(report, (address[], uint256[], uint256));

        require(users.length == points.length, "Array length mismatch");

        emit ReportReceived(day, users.length);

        emissionPool.recordPointsBatch(users, points);
        emissionPool.finalizeDay(day);
    }
}
