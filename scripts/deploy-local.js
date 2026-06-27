import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer, sponsor, worker] = await hre.ethers.getSigners();

  console.log("Deploying contracts locally...");

  // Deploy MockUSDC
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const usdcAddress = await mockUSDC.getAddress();

  // Deploy MockNDVIOracle
  const MockNDVIOracle = await hre.ethers.getContractFactory("MockNDVIOracle");
  const mockOracle = await MockNDVIOracle.deploy();
  await mockOracle.waitForDeployment();
  const oracleAddress = await mockOracle.getAddress();

  // Deploy ForestNFT
  const ForestNFT = await hre.ethers.getContractFactory("ForestNFT");
  const forestNFT = await ForestNFT.deploy();
  await forestNFT.waitForDeployment();
  const nftAddress = await forestNFT.getAddress();

  // Deploy MEWEscrow
  const MEWEscrow = await hre.ethers.getContractFactory("MEWEscrow");
  const escrow = await MEWEscrow.deploy(usdcAddress, oracleAddress, nftAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();

  // Transfer NFT ownership to Escrow
  await forestNFT.transferOwnership(escrowAddress);

  console.log("Contracts deployed!");
  
  // Mint some mock USDC to sponsor for simulation
  const depositAmount = hre.ethers.parseUnits("10000", 18);
  await mockUSDC.mint(sponsor.address, depositAmount);
  
  const frontendDir = path.join(process.cwd(), "frontend", "src", "contracts");
  
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
  }

  // Save addresses and ABIs
  const contractData = {
    MockUSDC: {
      address: usdcAddress,
      abi: JSON.parse(mockUSDC.interface.formatJson())
    },
    MockNDVIOracle: {
      address: oracleAddress,
      abi: JSON.parse(mockOracle.interface.formatJson())
    },
    ForestNFT: {
      address: nftAddress,
      abi: JSON.parse(forestNFT.interface.formatJson())
    },
    MEWEscrow: {
      address: escrowAddress,
      abi: JSON.parse(escrow.interface.formatJson())
    },
    // We also save predefined accounts so the frontend can simulate the roles
    accounts: {
      deployer: deployer.address,
      sponsor: sponsor.address,
      worker: worker.address
    }
  };

  fs.writeFileSync(
    path.join(frontendDir, "MEWContracts.json"),
    JSON.stringify(contractData, null, 2)
  );

  console.log("Contract ABIs and Addresses saved to frontend/src/contracts/MEWContracts.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
