import { ethers } from "ethers";
import ContractData from "@/contracts/MEWContracts.json";

let provider: ethers.JsonRpcProvider;

export const getProvider = () => {
  if (!provider) {
    provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  }
  return provider;
};

// Simulated wallets using Hardhat's unlocked accounts
export const getSigner = async (address: string) => {
  const p = getProvider();
  return p.getSigner(address);
};

export const getContracts = async (address: string) => {
  const signer = await getSigner(address);

  const mockUSDC = new ethers.Contract(
    ContractData.MockUSDC.address,
    ContractData.MockUSDC.abi,
    signer
  );

  const mockOracle = new ethers.Contract(
    ContractData.MockNDVIOracle.address,
    ContractData.MockNDVIOracle.abi,
    signer
  );

  const forestNFT = new ethers.Contract(
    ContractData.ForestNFT.address,
    ContractData.ForestNFT.abi,
    signer
  );

  const escrow = new ethers.Contract(
    ContractData.MEWEscrow.address,
    ContractData.MEWEscrow.abi,
    signer
  );

  return { mockUSDC, mockOracle, forestNFT, escrow };
};

export const roles = ContractData.accounts;
