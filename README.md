# MEW Blockchain (MEW-blockchain)

This repository contains the local Hardhat blockchain ecosystem for the **MEW** Web3 platform. The project simulates a "Pay-by-Performance" environmental funding model using smart contracts, dynamic NFTs (dNFTs), and simulated Oracles.

## Architecture

The project consists of four core smart contracts:

- **`MockUSDC.sol`**: An ERC-20 token used to simulate corporate sponsorship funds.
- **`MockNDVIOracle.sol`**: A simulated oracle contract that holds and updates NDVI (Normalized Difference Vegetation Index) scores for land parcels, representing real-world satellite data.
- **`ForestNFT.sol`**: An ERC-721 dynamic NFT contract. Each NFT represents a land parcel, and its metadata state upgrades (e.g., `Planted` -> `Growing` -> `Verified`) based on oracle updates.
- **`MEWEscrow.sol`**: The core escrow logic. Corporate sponsors lock `MockUSDC` here. Funds are only released to the worker (NFT owner) when the `MockNDVIOracle` confirms the NDVI score has reached the target threshold.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- npm or yarn

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/culjaklukaa/MEW-blockchain.git
   cd MEW-blockchain
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

## Development & Testing

This project uses **Hardhat** as the development environment.

### Compile Contracts
```bash
npx hardhat compile
```

### Run Tests
The test suite validates the core escrow logic, ensuring funds cannot be released early and are successfully transferred once the target NDVI is met.
```bash
npx hardhat test
```

### Lifecycle Simulation
You can run a complete simulated lifecycle of the MEW platform, demonstrating:
1. Minting a new ForestNFT.
2. A sponsor depositing MockUSDC into escrow with a target NDVI.
3. Oracle data ingestion.
4. Fund release and NFT state upgrade.

Run the simulation script using:
```bash
npx hardhat run scripts/simulate.js
```

## Built With

- [Hardhat](https://hardhat.org/)
- [Ethers.js v6](https://docs.ethers.org/v6/)
- [OpenZeppelin Contracts](https://www.openzeppelin.com/contracts)
