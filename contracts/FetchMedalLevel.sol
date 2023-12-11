// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/dev/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/dev/v1_0_0/libraries/FunctionsRequest.sol";
import "./MedalNFT.sol";

// interface MedalNFT {
//     function awardMedal(address, uint256) external;
//     // function transferOwnership(address) external;
// }

/**
 * Request testnet LINK and ETH here: https://faucets.chain.link/
 * Find information on LINK Token Contracts and get the latest ETH and LINK faucets here: https://docs.chain.link/docs/link-token-contracts/
 */

/**
 * THIS IS AN EXAMPLE CONTRACT WHICH USES HARDCODED VALUES FOR CLARITY.
 * THIS EXAMPLE USES UN-AUDITED CODE.
 * DO NOT USE THIS CODE IN PRODUCTION.
 */

contract FetchMedalLevel is FunctionsClient, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;

    mapping(address => uint256) public userMedal;
    mapping(bytes32 => address) public mintRequestRegistry; //This is for storing the medals of every donnor
    mapping(bytes32 => address) public registerRequestRegistry;

    address private medalContractAddress;
    address private claimer; //userWalletAddress;
    uint256 public updatedMedalLevel;
    bytes32 private jobId;
    string private apiURLStub;
    uint256 private fee;

    MedalNFT public medalNFT;

    bytes32 public donId; // DON ID for the Functions DON to which the requests are sent

    bytes32 public s_lastRequestId;
    bytes public s_lastResponse;
    bytes public s_lastError;

    // Custom error type
    error UnexpectedRequestID(bytes32 requestId);

    event MedalClaimed(
        bytes32 indexed requestId,
        address claimer,
        uint256 medalLevel
    );
    event ErrorOccurred(
        bytes32 indexed requestId,
        address claimer,
        bytes error
    );

    /**
     * @notice Initialize the target oracle
     *
     *
     */

    // constructor(
    //     address router
    // ) FunctionsClient(router) ConfirmedOwner(msg.sender) {
    //     setChainlinkToken(0x779877A7B0D9E8603169DdbD7836e478b4624789);
    //     setChainlinkOracle(0x6090149792dAAeE9D1D568c9f9a6F6B46AA29eFD);
    //     jobId = "ca98366cc7314957b8c012c72f05aeeb";
    //     fee = (1 * LINK_DIVISIBILITY) / 10; // 0,1 * 10**18 (Varies by network and job)
    //     apiURLStub = "http://foodshai.com/api/data?walletAddress";
    // }

    constructor(
        address router,
        bytes32 _donId
    ) FunctionsClient(router) ConfirmedOwner(msg.sender) {
        donId = _donId;
    }

    /**
     * Create a Chainlink request to retrieve API response, find the target
     * data, then multiply by 1000000000000000000 (to remove decimal places from data).
     */
    // function requestmedalLevel() public returns (bytes32 requestId) {
    //     Chainlink.Request memory req = buildChainlinkRequest(
    //         jobId,
    //         address(this),
    //         this.fulfill.selector
    //     );

    //     // Set the URL to perform the GET request on
    //     req.add(
    //         "get",
    //         "https://foodshai.com/api/data/:medalLevel/:walletAddress"
    //         // "https://min-api.cryptocompare.com/data/pricemultifull?fsyms=ETH&tsyms=USD"
    //     );

    //     // Set the path to find the desired data in the API response, where the response format is:
    //     // {"RAW":
    //     //   {"ETH":
    //     //    {"USD":
    //     //     {
    //     //      "VOLUME24HOUR": xxx.xxx,
    //     //     }
    //     //    }
    //     //   }
    //     //  }
    //     // request.add("path", "RAW.ETH.USD.VOLUME24HOUR"); // Chainlink nodes prior to 1.0.0 support this format
    //     req.add("path", /*keys of the JSON*/) //"RAW,ETH,USD,VOLUME24HOUR"); // Chainlink nodes 1.0.0 and later support this format

    //     // Multiply the result by 1000000000000000000 to remove decimals
    //     int256 timesAmount = 10 ** 18;
    //     req.addInt("times", timesAmount);

    //     // Sends the request
    //     return sendChainlinkRequest(req, fee);
    // }
    function setDonId(bytes32 newDonId) external onlyOwner {
        donId = newDonId;
    }

    function sendRequest(
        string calldata source,
        FunctionsRequest.Location secretsLocation,
        bytes calldata encryptedSecretsReference,
        string[] calldata args,
        bytes[] calldata bytesArgs,
        uint64 subscriptionId,
        uint32 callbackGasLimit
    ) external onlyOwner {
        FunctionsRequest.Request memory req; // Struct API reference: https://docs.chain.link/chainlink-functions/api-reference/functions-request
        req.initializeRequest(
            FunctionsRequest.Location.Inline,
            FunctionsRequest.CodeLanguage.JavaScript,
            source
        );
        req.secretsLocation = secretsLocation;
        req.encryptedSecretsReference = encryptedSecretsReference;
        if (args.length > 0) {
            req.setArgs(args);
        }
        if (bytesArgs.length > 0) {
            req.setBytesArgs(bytesArgs);
        }
        s_lastRequestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            callbackGasLimit,
            donId
        );
    }

    /**
     * Receive the response in the form of uint256
     */

    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        // s_lastRequestId = requestId;
        // s_lastResponse = response;
        if (s_lastRequestId != requestId) {
            revert UnexpectedRequestID(requestId); // Check if request IDs match
        }
        updatedMedalLevel = uint256(response);

        s_lastError = err;

        if (userMedal[msg.sender] < updatedMedalLevel) {
            userMedal[msg.sender] = updatedMedalLevel;
            medalNFT.awardMedal(tokenId, msg.sender, updatedMedalLevel);
        }
        emit MedalClaimed(s_lastRequestId, updatedMedalLevel);
    }

    // function transferMedalOwnerShip(address _toAddress) public onlyOwner{
    //             MedalToken medalContract = MedalToken(medalContractAddress);
    //             medalContract.transferOwnership(_toAddress);
    // }

    /**
     * Allow withdraw of Link tokens from the contract
     */
    // function withdrawLink() public onlyOwner {
    //     LinkTokenInterface link = LinkTokenInterface(chainlinkTokenAddress());
    //     require(
    //         link.transfer(msg.sender, link.balanceOf(address(this))),
    //         "Unable to transfer"
    //     );
    // }
}
