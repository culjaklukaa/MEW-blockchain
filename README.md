# MEW - Mostar Eco View (Blockchain)

A decentralized platform for funding and verifying reforestation projects using smart contracts, dynamic Forest NFTs, and simulated satellite NDVI Oracle data — all running on a local Hardhat blockchain with an interactive Next.js frontend.

## Quick Start

```bash
git clone https://github.com/culjaklukaa/MEW-blockchain.git
cd MEW-blockchain
npm install
npm start
```

That's it. `npm start` will:
1. Start a local Hardhat blockchain node on `http://127.0.0.1:8545`
2. Compile and deploy all smart contracts
3. Write contract ABIs and addresses to the frontend
4. Launch the Next.js UI on `http://localhost:3000`

Open **http://localhost:3000** in your browser and interact with the full MEW platform.

## Architecture

### Smart Contracts (`contracts/`)
- **`MockUSDC.sol`** — ERC-20 token simulating corporate sponsorship funds
- **`MockNDVIOracle.sol`** — Simulated oracle pushing satellite NDVI vegetation scores
- **`ForestNFT.sol`** — ERC-721 dynamic NFT representing land parcels (`Planted` → `Growing` → `Verified`)
- **`MEWEscrow.sol`** — Escrow logic that locks funds and releases them when NDVI targets are met

### Frontend (`frontend/`)
- **Next.js** app connecting to the local blockchain via **ethers.js**
- Role switching between **Worker** (plants parcels) and **Sponsor** (funds projects)
- Real-time satellite simulation with animated NDVI progress tracking
- On-chain activity log showing all blockchain transactions

## Available Commands

| Command | Description |
|---|---|
| `npm start` | Launch everything (node + deploy + frontend) |
| `npm test` | Run smart contract unit tests |
| `npm run compile` | Compile Solidity contracts |
| `npm run node` | Start Hardhat node only |
| `npm run deploy:local` | Deploy contracts to running local node |
| `npm run frontend` | Start frontend dev server only |

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- npm

## Built With

- [Hardhat](https://hardhat.org/) — Ethereum development environment
- [Ethers.js v6](https://docs.ethers.org/v6/) — Blockchain interaction library
- [OpenZeppelin Contracts](https://www.openzeppelin.com/contracts) — Secure smart contract standards
- [Next.js](https://nextjs.org/) — React framework for the frontend
