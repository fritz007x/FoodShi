// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";

// error ERC721Metadata__URI_QueryFor_NonExistentToken();

contract MedalNFT is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    event TokenMinted(uint256 indexed tokenId, address to); //int256 medalValue
    event TokenURIUpdated(uint256 tokenId, string uri);

    //New URIs can be added in the future
    string[] public tokenURIs = ["", "", ""];

    address public immutable medalLevelContract;

    constructor(address _medalLevelContract) ERC721("Medal NFT", "FMN") {
        medalLevelContract = _medalLevelContract;
        _tokenIdCounter = 0;
    }

    /**
     * @dev Mints a token to the specified account.
     * Only the Medal Level contract can call this function directly.
     * @param account The account to mint the token to.
     * @param medalLevel The ID of the token.
    
     */

    function awardMedal(
        //uint256 tokenId, //medalValue,
        address account,
        uint256 medalLevel // string memory newURI
    ) public {
        require(msg.sender == medalLevelContract, "Direct mint invalid");
        // uint256 tokenId = _tokenIdCounter.current();
        // _tokenIdCounter.increment();
        ++_tokenIdCounter;
        uint256 tokenId = _tokenIdCounter;
        _safeMint(account, tokenId);
        _setTokenURI(tokenId, tokenURIs[medalLevel - 1]); //At the beggining users have no medal (medal level=0)

        emit TokenMinted(tokenId, account);
    }

    /**
     *
     */
    // function setURI(uint256 tokenId, string memory newUri) public {
    //     //onlyOwner
    //     require(
    //         msg.sender == medalLevelContract,
    //         "URI can be only be updated by FetchmedalLevel contract"
    //     );

    //     _setTokenURI(tokenId, newUri);
    //     emit TokenURIUpdated(tokenId, newUri); //, block.timestamp
    // }

    //This function set the token URI of the same NFT to a new value
    // function upgradeMedal(uint256 _tokenId) public {
    //     uint256 medalQty = IpfsUri.length;

    //     if (medalStage(_tokenId) >= medalQty) {
    //         return;
    //     }
    //     // Get the current stage of the medal and increment it
    //     uint256 newVal = medalStage(_tokenId) + 1;
    //     // store the new URI
    //     string memory newUri = IpfsUri[newVal];
    //     // Update the URI
    //     _setTokenURI(_tokenId, newUri);
    // }

    // The following functions are overrides required by Solidity.

    function _burn(uint256 tokenId) internal override(ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    // Getters
    /**
     * @dev Checks if a token with the given ID exists.
     * @param tokenId The ID of the token.
     * @return A boolean indicating whether the token exists.
     */
    function tokenExists(uint256 tokenId) public view returns (bool) {
        return tokenId < _tokenIdCounter;
    }

    /**
     * @dev Gets the total number of tokens created.
     * @return The total number of tokens.
     */
    function getTotalTokens() public view returns (uint256) {
        return _tokenIdCounter;
    }

    function getTokenURIs() public view returns (string[] memory) {
        return tokenURIs;
    }
}
