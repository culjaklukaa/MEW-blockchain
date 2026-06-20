// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ForestNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    enum ForestState { Planted, Growing, Verified }

    mapping(uint256 => ForestState) public forestStates;

    event ForestStateUpdated(uint256 indexed tokenId, ForestState state);

    constructor() ERC721("MEW - Mostar Eco View Forest", "CFOR") Ownable(msg.sender) {}

    function mintForest(address to, string memory uri) public returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
        forestStates[tokenId] = ForestState.Planted;
        return tokenId;
    }

    // This can be called by the Escrow contract or the owner to update the state
    function updateForestState(uint256 tokenId, ForestState newState) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        forestStates[tokenId] = newState;
        emit ForestStateUpdated(tokenId, newState);
    }
}
