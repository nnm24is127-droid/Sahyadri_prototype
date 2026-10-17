const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FarmEscrow & FarmToken", function () {
  let FarmToken;
  let token;
  let FarmEscrow;
  let escrow;
  let owner;
  let buyer;
  let farmer;
  let stranger;

  const orderId = "ORD-20261017-ESCROW01";
  const depositAmount = ethers.parseEther("4370"); // 150 kg * 29.13 Rs

  beforeEach(async function () {
    [owner, buyer, farmer, stranger] = await ethers.getSigners();

    // Deploy FarmToken
    FarmToken = await ethers.getContractFactory("FarmToken");
    token = await FarmToken.deploy();
    await token.waitForDeployment();

    // Deploy FarmEscrow
    FarmEscrow = await ethers.getContractFactory("FarmEscrow");
    escrow = await FarmEscrow.deploy(await token.getAddress());
    await escrow.waitForDeployment();

    // Fund buyer with test tokens and approve escrow
    await token.transfer(buyer.address, depositAmount * 2n);
    await token.connect(buyer).approve(await escrow.getAddress(), depositAmount * 2n);
  });

  describe("1. Escrow Funding & Deposit", function () {
    it("should allow buyer to lock funds in escrow for farmer order", async function () {
      await expect(escrow.connect(buyer).deposit(orderId, farmer.address, depositAmount))
        .to.emit(escrow, "EscrowFunded");

      const dep = await escrow.getDeposit(orderId);
      expect(dep.orderId).to.equal(orderId);
      expect(dep.buyer).to.equal(buyer.address);
      expect(dep.farmer).to.equal(farmer.address);
      expect(dep.amount).to.equal(depositAmount);
      expect(dep.state).to.equal(1); // EscrowState.Funded

      // Verify contract holds token balance
      expect(await token.balanceOf(await escrow.getAddress())).to.equal(depositAmount);
    });

    it("should prevent duplicate deposit for the same orderId", async function () {
      await escrow.connect(buyer).deposit(orderId, farmer.address, depositAmount);

      await expect(
        escrow.connect(buyer).deposit(orderId, farmer.address, depositAmount)
      ).to.be.revertedWithCustomError(escrow, "EscrowAlreadyExists").withArgs(orderId);
    });

    it("should reject invalid inputs: empty orderId, zero farmer address, identical parties, zero amount", async function () {
      await expect(
        escrow.connect(buyer).deposit("", farmer.address, depositAmount)
      ).to.be.revertedWithCustomError(escrow, "InvalidEscrowInput").withArgs("Empty orderId");

      await expect(
        escrow.connect(buyer).deposit(orderId, ethers.ZeroAddress, depositAmount)
      ).to.be.revertedWithCustomError(escrow, "InvalidEscrowInput").withArgs("Zero farmer address");

      await expect(
        escrow.connect(buyer).deposit(orderId, buyer.address, depositAmount)
      ).to.be.revertedWithCustomError(escrow, "InvalidEscrowInput").withArgs("Buyer and farmer cannot be identical");

      await expect(
        escrow.connect(buyer).deposit(orderId, farmer.address, 0)
      ).to.be.revertedWithCustomError(escrow, "InvalidEscrowInput").withArgs("Zero deposit amount");
    });
  });

  describe("2. Release to Farmer on Verified Delivery", function () {
    beforeEach(async function () {
      await escrow.connect(buyer).deposit(orderId, farmer.address, depositAmount);
    });

    it("should allow buyer to release escrowed tokens to the farmer upon delivery", async function () {
      const initialFarmerBal = await token.balanceOf(farmer.address);

      await expect(escrow.connect(buyer).release(orderId))
        .to.emit(escrow, "EscrowReleased");

      const finalFarmerBal = await token.balanceOf(farmer.address);
      expect(finalFarmerBal - initialFarmerBal).to.equal(depositAmount);

      const dep = await escrow.getDeposit(orderId);
      expect(dep.state).to.equal(2); // EscrowState.Released
    });

    it("should reject release from unauthorized stranger or farmer themselves", async function () {
      await expect(
        escrow.connect(farmer).release(orderId)
      ).to.be.revertedWithCustomError(escrow, "UnauthorizedEscrowParty").withArgs(farmer.address);

      await expect(
        escrow.connect(stranger).release(orderId)
      ).to.be.revertedWithCustomError(escrow, "UnauthorizedEscrowParty").withArgs(stranger.address);
    });

    it("should prevent double release of already settled escrow", async function () {
      await escrow.connect(buyer).release(orderId);

      await expect(
        escrow.connect(buyer).release(orderId)
      ).to.be.revertedWithCustomError(escrow, "InvalidEscrowState").withArgs(2, 1);
    });
  });

  describe("3. Cancellation & Refund to Buyer", function () {
    beforeEach(async function () {
      await escrow.connect(buyer).deposit(orderId, farmer.address, depositAmount);
    });

    it("should allow farmer to refund escrowed tokens back to the buyer upon mutual cancellation", async function () {
      const initialBuyerBal = await token.balanceOf(buyer.address);

      await expect(escrow.connect(farmer).refund(orderId))
        .to.emit(escrow, "EscrowRefunded");

      const finalBuyerBal = await token.balanceOf(buyer.address);
      expect(finalBuyerBal - initialBuyerBal).to.equal(depositAmount);

      const dep = await escrow.getDeposit(orderId);
      expect(dep.state).to.equal(3); // EscrowState.Refunded
    });

    it("should allow contract owner/admin to trigger refund in emergency dispute", async function () {
      await expect(escrow.connect(owner).refund(orderId))
        .to.emit(escrow, "EscrowRefunded");

      expect(await escrow.getEscrowState(orderId)).to.equal(3);
    });

    it("should reject refund from unauthorized parties", async function () {
      await expect(
        escrow.connect(stranger).refund(orderId)
      ).to.be.revertedWithCustomError(escrow, "UnauthorizedEscrowParty").withArgs(stranger.address);
    });
  });
});
