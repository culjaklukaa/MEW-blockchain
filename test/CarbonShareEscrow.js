import pkg from 'chai';
const { expect } = pkg;
import hre from "hardhat";
const { ethers } = hre;

describe("CarbonShare Escrow Lifecycle", function () {
  let mockUSDC, mockOracle, forestNFT, escrow;
  let deployer, sponsor, worker;

  beforeEach(async function () {
    [deployer, sponsor, worker] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();

    // Deploy MockNDVIOracle
    const MockNDVIOracle = await ethers.getContractFactory("MockNDVIOracle");
    mockOracle = await MockNDVIOracle.deploy();
    await mockOracle.waitForDeployment();

    // Deploy ForestNFT
    const ForestNFT = await ethers.getContractFactory("ForestNFT");
    forestNFT = await ForestNFT.deploy();
    await forestNFT.waitForDeployment();

    // Deploy Escrow
    const CarbonShareEscrow = await ethers.getContractFactory("CarbonShareEscrow");
    escrow = await CarbonShareEscrow.deploy(
      await mockUSDC.getAddress(),
      await mockOracle.getAddress(),
      await forestNFT.getAddress()
    );
    await escrow.waitForDeployment();

    // Transfer ownership of NFT contract to Escrow so it can update state
    await forestNFT.transferOwnership(await escrow.getAddress());
  });

  it("should complete the full lifecycle successfully", async function () {
    const depositAmount = ethers.parseUnits("1000", 18);
    const targetNDVI = 750; // out of 1000

    // 1. Worker mints NFT (Parcel)
    await forestNFT.connect(worker).mintForest(worker.address, "ipfs://mock-uri");
    const tokenId = 0; // First token minted

    // 2. Mint USDC to sponsor and approve escrow
    await mockUSDC.mint(sponsor.address, depositAmount);
    await mockUSDC.connect(sponsor).approve(await escrow.getAddress(), depositAmount);

    // 3. Sponsor deposits funds
    await expect(escrow.connect(sponsor).depositFunds(tokenId, worker.address, depositAmount, targetNDVI))
      .to.emit(escrow, "FundsDeposited")
      .withArgs(tokenId, sponsor.address, worker.address, depositAmount);

    // Check escrow details
    const escrowData = await escrow.escrows(tokenId);
    expect(escrowData.amount).to.equal(depositAmount);

    // 4. Try to release funds before target is reached (should fail)
    await mockOracle.updateNDVIScore(tokenId, 500); // 500 < 750
    await expect(escrow.checkAndRelease(tokenId)).to.be.revertedWith("Target NDVI score not reached");

    // 5. Update Oracle with passing score
    await mockOracle.updateNDVIScore(tokenId, 800); // 800 >= 750

    // 6. Release funds
    await expect(escrow.checkAndRelease(tokenId))
      .to.emit(escrow, "FundsReleased")
      .withArgs(tokenId, worker.address, depositAmount);

    // 7. Verify Worker received funds
    const workerBalance = await mockUSDC.balanceOf(worker.address);
    expect(workerBalance).to.equal(depositAmount);

    // 8. Verify NFT State is Verified (2)
    const nftState = await forestNFT.forestStates(tokenId);
    expect(nftState).to.equal(2); // ForestState.Verified
  });
});
