// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
// import "@openzeppelin/contracts/utils/Counters.sol";

import "hardhat/console.sol";

error ERC721Metadata__URI_QueryFor_NonExistentToken();

contract MedalNFT is ERC721, ERC721URIStorage, Ownable {
    // using Counters for Counters.Counter;

    // Counters.Counter private _tokenIdCounter;

    uint private _tokenIdCounter;

    event TokenMinted(uint256 indexed tokenId, address to); //int256 medalValue
    event TokenURIUpdated(uint256 tokenId, string uri);

    //New URIs can be added in the future
    string[] public tokenURIs = ["", "", ""];

    address public immutable medalLevelContract;

    constructor(address _medalLevelContract) ERC721("Medal NFT", "DMN") {
        _tokenIdCounter = 0;
        medalLevelContract = _medalLevelContract;
    }

    //This function is executed by the donor when he has achieved a goal for it
    //medalValue is just for tracking the type of medal awarded. Consider not to use it

    function mint(
        uint256 tokenId, //medalValue,
        address account,
        string memory newURI
    ) public {
        require(msg.sender == medalLevelContract, "Direct mint invalid");
        // uint256 tokenId = _tokenIdCounter.current();
        // _tokenIdCounter.increment();
        ++_tokenIdCounter;
        _safeMint(account, tokenId);
        _setTokenURI(tokenId, newURI); //The user first mint the initial medal

        emit TokenMinted(tokenId, account);
    }

    /**
     * @dev Updates the URI of an existing token.
     * Only the FetchmedalLevel contract can call this function.
     * @param tokenId The ID of the token.
     * @param newUri The new URI of the token.
     */
    function setURI(uint256 tokenId, string memory newUri) public {
        //onlyOwner
        require(
            msg.sender == medalLevelContract,
            "URI can be only be updated by FetchmedalLevel contract"
        );

        _setTokenURI(tokenId, newUri);
        emit TokenURIUpdated(tokenId, newUri); //, block.timestamp
    }

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

    function _burn(
        uint256 tokenId
    ) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
}
