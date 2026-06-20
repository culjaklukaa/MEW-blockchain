// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MockNDVIOracle is Ownable {
    mapping(uint256 => uint256) public parcelNDVIScores;

    event NDVIUpdated(uint256 indexed parcelId, uint256 score);

    constructor() Ownable(msg.sender) {}

    // Simulates an oracle pushing new NDVI score data
    function updateNDVIScore(uint256 parcelId, uint256 score) external onlyOwner {
        parcelNDVIScores[parcelId] = score;
        emit NDVIUpdated(parcelId, score);
    }

    // Contracts can call this to verify the score
    function getNDVIScore(uint256 parcelId) external view returns (uint256) {
        return parcelNDVIScores[parcelId];
    }
}
