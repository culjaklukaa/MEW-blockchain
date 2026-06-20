// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./MockNDVIOracle.sol";
import "./ForestNFT.sol";

contract MEWEscrow {
    IERC20 public paymentToken;
    MockNDVIOracle public oracle;
    ForestNFT public nftContract;

    struct Escrow {
        address sponsor;
        address worker;
        uint256 amount;
        uint256 targetNDVIScore;
        bool isReleased;
    }

    // Mapping from tokenId to its Escrow details
    mapping(uint256 => Escrow) public escrows;

    event FundsDeposited(uint256 indexed tokenId, address indexed sponsor, address indexed worker, uint256 amount);
    event FundsReleased(uint256 indexed tokenId, address indexed worker, uint256 amount);

    constructor(address _paymentToken, address _oracle, address _nftContract) {
        paymentToken = IERC20(_paymentToken);
        oracle = MockNDVIOracle(_oracle);
        nftContract = ForestNFT(_nftContract);
    }

    // Sponsor deposits funds for a specific parcel (NFT)
    function depositFunds(
        uint256 tokenId,
        address worker,
        uint256 amount,
        uint256 targetNDVIScore
    ) external {
        require(amount > 0, "Amount must be greater than 0");
        require(escrows[tokenId].amount == 0, "Escrow already exists for this token");

        // Transfer tokens from sponsor to this escrow contract
        require(paymentToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        escrows[tokenId] = Escrow({
            sponsor: msg.sender,
            worker: worker,
            amount: amount,
            targetNDVIScore: targetNDVIScore,
            isReleased: false
        });

        emit FundsDeposited(tokenId, msg.sender, worker, amount);
    }

    // Can be called by anyone (e.g. an automation script) to check Oracle and release funds
    function checkAndRelease(uint256 tokenId) external {
        Escrow storage escrowData = escrows[tokenId];
        require(escrowData.amount > 0, "No funds in escrow");
        require(!escrowData.isReleased, "Funds already released");

        uint256 currentScore = oracle.getNDVIScore(tokenId);
        require(currentScore >= escrowData.targetNDVIScore, "Target NDVI score not reached");

        // Update state
        escrowData.isReleased = true;

        // Release funds to the worker
        require(paymentToken.transfer(escrowData.worker, escrowData.amount), "Transfer failed");

        // Update NFT state to Verified
        nftContract.updateForestState(tokenId, ForestNFT.ForestState.Verified);

        emit FundsReleased(tokenId, escrowData.worker, escrowData.amount);
    }
}
