// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title MedalNFT
 * @notice NFT medals for FOODSHI platform donors
 * @dev ERC-721 with 4 medal tiers requiring $SHARE burning
 */
contract MedalNFT is ERC721, ERC721URIStorage, ERC721Enumerable, AccessControl, ReentrancyGuard {
    using Strings for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    ERC20Burnable public immutable shareToken;

    // Medal tiers
    enum MedalTier { Bronze, Silver, Gold, Platinum }

    // Medal requirements
    struct MedalRequirements {
        uint256 minDays;        // Minimum days since first donation
        uint256 minDonations;   // Minimum confirmed donations
        uint256 burnCost;       // $SHARE tokens to burn
    }

    // Medal metadata
    struct MedalData {
        MedalTier tier;
        uint256 mintedAt;
        uint256 donationsAtMint;
    }

    // Requirements for each tier
    mapping(MedalTier => MedalRequirements) public medalRequirements;

    // Token ID to medal data
    mapping(uint256 => MedalData) public medalData;

    // User medals (user => tier => tokenId, 0 if not owned)
    mapping(address => mapping(MedalTier => uint256)) public userMedals;

    // Base URI for metadata
    string public baseMetadataURI;

    // Token counter
    uint256 private _tokenIdCounter;

    event MedalMinted(address indexed user, uint256 indexed tokenId, MedalTier tier, uint256 burnAmount);
    event BaseURIUpdated(string oldURI, string newURI);

    constructor(address _shareToken) ERC721("FOODSHI Medal", "FSHMEDAL") {
        require(_shareToken != address(0), "Invalid token address");

        shareToken = ERC20Burnable(_shareToken);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);

        // Initialize medal requirements
        // Bronze: 1 month (30 days), 20 donations, 50 SHARE burn
        medalRequirements[MedalTier.Bronze] = MedalRequirements({
            minDays: 30,
            minDonations: 20,
            burnCost: 50 * 10**18
        });

        // Silver: 3 months (90 days), 70 donations, 150 SHARE burn
        medalRequirements[MedalTier.Silver] = MedalRequirements({
            minDays: 90,
            minDonations: 70,
            burnCost: 150 * 10**18
        });

        // Gold: 6 months (180 days), 150 donations, 300 SHARE burn
        medalRequirements[MedalTier.Gold] = MedalRequirements({
            minDays: 180,
            minDonations: 150,
            burnCost: 300 * 10**18
        });

        // Platinum: 1 year (365 days), 320 donations, 500 SHARE burn
        medalRequirements[MedalTier.Platinum] = MedalRequirements({
            minDays: 365,
            minDonations: 320,
            burnCost: 500 * 10**18
        });

        baseMetadataURI = "ipfs://";
    }

    /**
     * @notice Mint a medal NFT
     * @param to Recipient address
     * @param tier Medal tier
     * @param firstDonationTimestamp Timestamp of user's first donation
     * @param confirmedDonations Number of confirmed donations
     */
    function mint(
        address to,
        MedalTier tier,
        uint256 firstDonationTimestamp,
        uint256 confirmedDonations
    ) external onlyRole(MINTER_ROLE) nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(userMedals[to][tier] == 0, "Already owns this medal tier");

        MedalRequirements memory requirements = medalRequirements[tier];

        // Verify time requirement
        uint256 daysSinceFirst = (block.timestamp - firstDonationTimestamp) / 1 days;
        require(daysSinceFirst >= requirements.minDays, "Time requirement not met");

        // Verify donation count
        require(confirmedDonations >= requirements.minDonations, "Donation count not met");

        // Burn tokens from user
        shareToken.burnFrom(to, requirements.burnCost);

        // Mint NFT
        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;

        _safeMint(to, tokenId);

        // Store medal data
        medalData[tokenId] = MedalData({
            tier: tier,
            mintedAt: block.timestamp,
            donationsAtMint: confirmedDonations
        });

        userMedals[to][tier] = tokenId;

        emit MedalMinted(to, tokenId, tier, requirements.burnCost);
    }

    /**
     * @notice Set base metadata URI
     * @param newBaseURI New base URI
     */
    function setBaseURI(string calldata newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        string memory oldURI = baseMetadataURI;
        baseMetadataURI = newBaseURI;
        emit BaseURIUpdated(oldURI, newBaseURI);
    }

    /**
     * @notice Update medal requirements (admin only)
     * @param tier Medal tier to update
     * @param minDays Minimum days requirement
     * @param minDonations Minimum donations requirement
     * @param burnCost Burn cost in tokens
     */
    function updateMedalRequirements(
        MedalTier tier,
        uint256 minDays,
        uint256 minDonations,
        uint256 burnCost
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        medalRequirements[tier] = MedalRequirements({
            minDays: minDays,
            minDonations: minDonations,
            burnCost: burnCost
        });
    }

    /**
     * @notice Check if user can mint a specific medal tier
     * @param user User address
     * @param tier Medal tier
     * @param firstDonationTimestamp Timestamp of first donation
     * @param confirmedDonations Number of confirmed donations
     * @return canMint Whether user can mint
     * @return reason Reason if cannot mint
     */
    function canMintMedal(
        address user,
        MedalTier tier,
        uint256 firstDonationTimestamp,
        uint256 confirmedDonations
    ) external view returns (bool canMint, string memory reason) {
        if (userMedals[user][tier] != 0) {
            return (false, "Already owns this medal");
        }

        MedalRequirements memory requirements = medalRequirements[tier];

        uint256 daysSinceFirst = (block.timestamp - firstDonationTimestamp) / 1 days;
        if (daysSinceFirst < requirements.minDays) {
            return (false, "Time requirement not met");
        }

        if (confirmedDonations < requirements.minDonations) {
            return (false, "Donation count not met");
        }

        if (shareToken.balanceOf(user) < requirements.burnCost) {
            return (false, "Insufficient token balance");
        }

        if (shareToken.allowance(user, address(this)) < requirements.burnCost) {
            return (false, "Insufficient token allowance");
        }

        return (true, "");
    }

    /**
     * @notice Get user's medals
     * @param user User address
     * @return Array of owned medal token IDs (0 if not owned for that tier)
     */
    function getUserMedals(address user) external view returns (uint256[4] memory) {
        return [
            userMedals[user][MedalTier.Bronze],
            userMedals[user][MedalTier.Silver],
            userMedals[user][MedalTier.Gold],
            userMedals[user][MedalTier.Platinum]
        ];
    }

    /**
     * @notice Get medal tier name
     * @param tier Medal tier
     * @return Tier name string
     */
    function getTierName(MedalTier tier) public pure returns (string memory) {
        if (tier == MedalTier.Bronze) return "Bronze";
        if (tier == MedalTier.Silver) return "Silver";
        if (tier == MedalTier.Gold) return "Gold";
        if (tier == MedalTier.Platinum) return "Platinum";
        return "";
    }

    // Required overrides

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        _requireOwned(tokenId);

        MedalData memory data = medalData[tokenId];
        string memory tierName = getTierName(data.tier);

        return string(abi.encodePacked(baseMetadataURI, tierName, "/", tokenId.toString(), ".json"));
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }
}
