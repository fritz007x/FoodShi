// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "hardhat/console.sol";

error ERC721Metadata__URI_QueryFor_NonExistentToken();

contract MedalNFT is
    ERC721,
    ERC721URIStorage,
    Ownable //Dynamic NFT
{
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    event CreatedNFT(uint256 indexed tokenId, int256 indexed medalValue); //Elaborate on medal value

    // event TransferedNFT(
    //     address indexed recipient,
    //     address indexed nftAddress,
    //     uint256 indexed tokenId
    );

    // Metadata information for each stage of the NFT on IPFS.
    string[] IpfsUri = [
        "",
        "",
        ""
        // "https://ipfs.io/ipfs/QmYaTsyxTDnrG4toc8721w62rL4ZBKXQTGj9c9Rpdrntou/seed.json",
        // "https://ipfs.io/ipfs/QmYaTsyxTDnrG4toc8721w62rL4ZBKXQTGj9c9Rpdrntou/purple-sprout.json",
        // "https://ipfs.io/ipfs/QmYaTsyxTDnrG4toc8721w62rL4ZBKXQTGj9c9Rpdrntou/purple-blooms.json"
    ];

    constructor() ERC721("Dynamic Medal NFT", "DMN") {
        _tokenIdCounter._value = 0;
    }

    //This function is executed by the donor when he has achieved a goal for it
    //medalValue is just for tracking the type of medal awarded. Consider not to use it

    function awardMedal(
        int256 medalValue,
        address donnorAddress
    ) public onlyOwner {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(donnorAddress, tokenId);
        _setTokenURI(tokenId, IpfsUri[0]); //The user first mint the initial medal

        // emit CreatedNFT(tokenId, medalValue);
    }

    //This function set the token URI of the same NFT to a new value
    function upgradeMedal(uint256 _tokenId) public {
        uint256 medalQty = IpfsUri.length;

        if (medalStage(_tokenId) >= medalQty) {
            return;
        }
        // Get the current stage of the medal and increment it
        uint256 newVal = medalStage(_tokenId) + 1;
        // store the new URI
        string memory newUri = IpfsUri[newVal];
        // Update the URI
        _setTokenURI(_tokenId, newUri);
    }

    //This function returns the current stage of the medal
    function medalStage(uint256 _tokenId) public view returns (uint256) {
        string memory _uri = tokenURI(_tokenId);
        // 1st medal
        if (compareStrings(_uri, IpfsUri[0])) {
            return 0;
        }
        // 2nd medal
        if (compareStrings(_uri, IpfsUri[1])) {
            return 1;
        }
        // 3rd medal
        return 2; //This might be augmented
    }

    // helper function to compare strings
    function compareStrings(
        string memory a,
        string memory b
    ) public pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) ==
            keccak256(abi.encodePacked((b))));
    }

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
