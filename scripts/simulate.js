import hre from "hardhat";
const { ethers } = hre;

async function main() {
  const [deployer, sponsor, worker] = await ethers.getSigners();

  console.log("Starting CarbonShare Lifecycle Simulation...");
  console.log("------------------------------------------");
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Sponsor: ${sponsor.address}`);
  console.log(`Worker: ${worker.address}`);

  // 1. Deploy Contracts
  console.log("\nDeploying contracts...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const usdcAddress = await mockUSDC.getAddress();
  console.log(`MockUSDC deployed to: ${usdcAddress}`);

  const MockNDVIOracle = await ethers.getContractFactory("MockNDVIOracle");
  const mockOracle = await MockNDVIOracle.deploy();
  await mockOracle.waitForDeployment();
  const oracleAddress = await mockOracle.getAddress();
  console.log(`MockNDVIOracle deployed to: ${oracleAddress}`);

  const ForestNFT = await ethers.getContractFactory("ForestNFT");
  const forestNFT = await ForestNFT.deploy();
  await forestNFT.waitForDeployment();
  const nftAddress = await forestNFT.getAddress();
  console.log(`ForestNFT deployed to: ${nftAddress}`);

  const CarbonShareEscrow = await ethers.getContractFactory("CarbonShareEscrow");
  const escrow = await CarbonShareEscrow.deploy(usdcAddress, oracleAddress, nftAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`CarbonShareEscrow deployed to: ${escrowAddress}`);

  // Transfer NFT ownership to Escrow
  await forestNFT.transferOwnership(escrowAddress);
  console.log("Transferred ForestNFT ownership to Escrow.");

  console.log("\nStarting lifecycle...");
  
  // 2. Worker mints NFT
  console.log("Worker is minting Forest NFT...");
  let tx = await forestNFT.connect(worker).mintForest(worker.address, "ipfs://mock-uri");
  await tx.wait();
  const tokenId = 0;
  console.log(`Forest NFT minted with Token ID: ${tokenId}. State: Planted (0)`);

  // 3. Sponsor deposits funds
  const depositAmount = ethers.parseUnits("5000", 18);
  const targetNDVI = 800;
  console.log(`\nSponsor is depositing ${ethers.formatUnits(depositAmount, 18)} USDC with Target NDVI ${targetNDVI}...`);
  
  await mockUSDC.mint(sponsor.address, depositAmount);
  await mockUSDC.connect(sponsor).approve(escrowAddress, depositAmount);
  
  tx = await escrow.connect(sponsor).depositFunds(tokenId, worker.address, depositAmount, targetNDVI);
  await tx.wait();
  console.log("Funds deposited successfully.");

  // 4. Simulate Oracle Updates
  console.log("\nSimulating Oracle Data updates over time...");
  
  console.log("Month 3: NDVI is 500");
  tx = await mockOracle.updateNDVIScore(tokenId, 500);
  await tx.wait();
  
  try {
      console.log("Attempting to release funds early...");
      await escrow.checkAndRelease(tokenId);
  } catch (error) {
      console.log("Failed to release funds as expected: Target NDVI not reached.");
  }

  console.log("Month 6: NDVI is 850");
  tx = await mockOracle.updateNDVIScore(tokenId, 850);
  await tx.wait();

  // 5. Release Funds
  console.log("\nAttempting to release funds after goal reached...");
  tx = await escrow.checkAndRelease(tokenId);
  await tx.wait();
  console.log("Funds released successfully!");

  // 6. Verify final states
  const workerBalance = await mockUSDC.balanceOf(worker.address);
  console.log(`\nWorker Final USDC Balance: ${ethers.formatUnits(workerBalance, 18)}`);
  
  const nftState = await forestNFT.forestStates(tokenId);
  console.log(`Forest NFT State: ${nftState} (Should be 2 / Verified)`);

  console.log("\nSimulation Complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
