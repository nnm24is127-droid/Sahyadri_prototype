const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FarmConnectOrderRegistry", function () {
  let OrderRegistry;
  let registry;
  let owner;
  let buyer;
  let farmer;
  let stranger;

  const orderId = "ORD-20261017-DEMO01";
  const dummyHash = ethers.keccak256(ethers.toUtf8Bytes("Sample Normalized Contract Terms: 150kg Tomatoes @ Rs 29.13/kg"));
  const dummyHash2 = ethers.keccak256(ethers.toUtf8Bytes("Second Distinct Agreement"));

  beforeEach(async function () {
    [owner, buyer, farmer, stranger] = await ethers.getSigners();
    OrderRegistry = await ethers.getContractFactory("FarmConnectOrderRegistry");
    registry = await OrderRegistry.deploy();
    await registry.waitForDeployment();
  });

  describe("1. Order Registration", function () {
    it("should successfully register an order and emit OrderRegistered event", async function () {
      await expect(registry.registerOrder(orderId, dummyHash, buyer.address, farmer.address))
        .to.emit(registry, "OrderRegistered");

      const ord = await registry.getOrder(orderId);
      expect(ord.orderId).to.equal(orderId);
      expect(ord.agreementHash).to.equal(dummyHash);
      expect(ord.buyer).to.equal(buyer.address);
      expect(ord.farmer).to.equal(farmer.address);
      expect(ord.buyerConfirmed).to.equal(false);
      expect(ord.farmerConfirmed).to.equal(false);
      expect(ord.status).to.equal(0); // OrderStatus.Registered
      expect(await registry.isOrderRegistered(orderId)).to.equal(true);
    });

    it("should prevent duplicate registration of the same order ID", async function () {
      await registry.registerOrder(orderId, dummyHash, buyer.address, farmer.address);

      await expect(
        registry.registerOrder(orderId, dummyHash2, buyer.address, farmer.address)
      ).to.be.revertedWithCustomError(registry, "OrderAlreadyExists").withArgs(orderId);
    });

    it("should prevent duplicate registration of the exact same agreement hash", async function () {
      await registry.registerOrder(orderId, dummyHash, buyer.address, farmer.address);

      await expect(
        registry.registerOrder("ORD-DIFF-ID", dummyHash, buyer.address, farmer.address)
      ).to.be.revertedWithCustomError(registry, "DuplicateAgreementHash").withArgs(dummyHash, orderId);
    });

    it("should reject invalid inputs: empty orderId, zero hash, zero addresses, identical parties", async function () {
      await expect(
        registry.registerOrder("", dummyHash, buyer.address, farmer.address)
      ).to.be.revertedWithCustomError(registry, "InvalidInput").withArgs("Empty orderId");

      await expect(
        registry.registerOrder(orderId, ethers.ZeroHash, buyer.address, farmer.address)
      ).to.be.revertedWithCustomError(registry, "InvalidInput").withArgs("Empty agreementHash");

      await expect(
        registry.registerOrder(orderId, dummyHash, ethers.ZeroAddress, farmer.address)
      ).to.be.revertedWithCustomError(registry, "InvalidInput").withArgs("Zero buyer address");

      await expect(
        registry.registerOrder(orderId, dummyHash, buyer.address, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(registry, "InvalidInput").withArgs("Zero farmer address");

      await expect(
        registry.registerOrder(orderId, dummyHash, buyer.address, buyer.address)
      ).to.be.revertedWithCustomError(registry, "InvalidInput").withArgs("Buyer and farmer cannot be identical");
    });
  });

  describe("2. Agreement Confirmation", function () {
    beforeEach(async function () {
      await registry.registerOrder(orderId, dummyHash, buyer.address, farmer.address);
    });

    it("should allow buyer to confirm agreement terms", async function () {
      await expect(registry.connect(buyer).confirmAgreement(orderId))
        .to.emit(registry, "AgreementConfirmed");

      const ord = await registry.getOrder(orderId);
      expect(ord.buyerConfirmed).to.equal(true);
      expect(ord.farmerConfirmed).to.equal(false);
      expect(ord.status).to.equal(0); // Still Registered until both confirm
    });

    it("should transition status to Confirmed when both buyer and farmer confirm", async function () {
      await registry.connect(buyer).confirmAgreement(orderId);
      
      await expect(registry.connect(farmer).confirmAgreement(orderId))
        .to.emit(registry, "OrderStatusUpdated");

      const ord = await registry.getOrder(orderId);
      expect(ord.buyerConfirmed).to.equal(true);
      expect(ord.farmerConfirmed).to.equal(true);
      expect(ord.status).to.equal(1); // OrderStatus.Confirmed
    });

    it("should reject agreement confirmation from unauthorized stranger", async function () {
      await expect(
        registry.connect(stranger).confirmAgreement(orderId)
      ).to.be.revertedWithCustomError(registry, "UnauthorizedCaller").withArgs(stranger.address);
    });
  });

  describe("3. Order Status & Hash Verification", function () {
    beforeEach(async function () {
      await registry.registerOrder(orderId, dummyHash, buyer.address, farmer.address);
    });

    it("should correctly verify valid agreement hash and reject invalid candidate", async function () {
      expect(await registry.verifyAgreementHash(orderId, dummyHash)).to.equal(true);
      expect(await registry.verifyAgreementHash(orderId, dummyHash2)).to.equal(false);
      expect(await registry.verifyAgreementHash("NON-EXISTENT", dummyHash)).to.equal(false);
    });

    it("should allow authorized party to update status and reject invalid transitions after fulfillment", async function () {
      // Transition to InEscrow (status 2)
      await registry.connect(buyer).updateOrderStatus(orderId, 2);
      let ord = await registry.getOrder(orderId);
      expect(ord.status).to.equal(2);

      // Transition to Fulfilled (status 3)
      await registry.connect(farmer).updateOrderStatus(orderId, 3);
      ord = await registry.getOrder(orderId);
      expect(ord.status).to.equal(3);

      // Attempting further transition after Fulfilled must revert
      await expect(
        registry.connect(buyer).updateOrderStatus(orderId, 4)
      ).to.be.revertedWithCustomError(registry, "InvalidStateTransition").withArgs(3, 4);
    });

    it("should reject status updates from unauthorized parties", async function () {
      await expect(
        registry.connect(stranger).updateOrderStatus(orderId, 1)
      ).to.be.revertedWithCustomError(registry, "UnauthorizedCaller").withArgs(stranger.address);
    });
  });
});
