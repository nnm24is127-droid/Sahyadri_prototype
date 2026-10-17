const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProduceTraceability", function () {
  let ProduceTraceability;
  let traceability;
  let owner;
  let farmer;
  let logisticsHub;
  let buyer;
  let unauthorizedUser;

  const trackingId = "BATCH-MATTU-2026-001";
  const harvestHash = ethers.keccak256(ethers.toUtf8Bytes("Harvest batch metadata: Plot 4B, 150kg Mattu Gulla"));
  const packHash = ethers.keccak256(ethers.toUtf8Bytes("Pack batch metadata: Grade A Crates #1-#10"));
  const dispatchHash = ethers.keccak256(ethers.toUtf8Bytes("Dispatch receipt: Vehicle KA-20-EA-4411"));
  const receiveHash = ethers.keccak256(ethers.toUtf8Bytes("Receive inspection sign-off"));

  beforeEach(async function () {
    [owner, farmer, logisticsHub, buyer, unauthorizedUser] = await ethers.getSigners();
    ProduceTraceability = await ethers.getContractFactory("ProduceTraceability");
    traceability = await ProduceTraceability.deploy();
    await traceability.waitForDeployment();
  });

  describe("1. Milestones Recording", function () {
    it("should allow producer to log initial HarvestRecorded event", async function () {
      await expect(
        traceability.connect(farmer).recordEvent(trackingId, 0, harvestHash, "Shankarpura, Udupi")
      )
        .to.emit(traceability, "TraceabilityEventRecorded");

      expect(await traceability.getEventCount(trackingId)).to.equal(1);
      const history = await traceability.getEventHistory(trackingId);
      expect(history[0].stage).to.equal(0);
      expect(history[0].location).to.equal("Shankarpura, Udupi");
      expect(history[0].recordedBy).to.equal(farmer.address);
      expect(history[0].metadataHash).to.equal(harvestHash);
    });

    it("should maintain complete chronological order across supply chain stages", async function () {
      // 1. Farmer records harvest
      await traceability.connect(farmer).recordEvent(trackingId, 0, harvestHash, "Shankarpura Farm");
      
      // 2. Farmer authorizes logistics hub
      await traceability.connect(farmer).authorizeLogger(trackingId, logisticsHub.address);
      
      // 3. Logistics hub records packing and handover
      await traceability.connect(logisticsHub).recordEvent(trackingId, 2, packHash, "Bantwal APMC Aggregation Hub");
      await traceability.connect(logisticsHub).recordEvent(trackingId, 3, dispatchHash, "NH-66 En Route Mangalore");

      // 4. Authorize buyer to record final receipt
      await traceability.connect(farmer).authorizeLogger(trackingId, buyer.address);
      await traceability.connect(buyer).recordEvent(trackingId, 4, receiveHash, "Mangalore Central Kitchen");

      expect(await traceability.getEventCount(trackingId)).to.equal(4);
      const history = await traceability.getEventHistory(trackingId);
      expect(history[0].stage).to.equal(0); // HarvestRecorded
      expect(history[1].stage).to.equal(2); // Packed
      expect(history[2].stage).to.equal(3); // HandedOver
      expect(history[3].stage).to.equal(4); // Received
    });
  });

  describe("2. Access Control & Validation Safeguards", function () {
    beforeEach(async function () {
      // Farmer initiates tracking
      await traceability.connect(farmer).recordEvent(trackingId, 0, harvestHash, "Farm Collar");
    });

    it("should prevent unauthorized third party from logging events", async function () {
      await expect(
        traceability.connect(unauthorizedUser).recordEvent(trackingId, 1, packHash, "Fake Hub")
      ).to.be.revertedWithCustomError(traceability, "UnauthorizedLogger").withArgs(trackingId, unauthorizedUser.address);
    });

    it("should prevent non-owner from authorizing new loggers", async function () {
      await expect(
        traceability.connect(unauthorizedUser).authorizeLogger(trackingId, logisticsHub.address)
      ).to.be.revertedWithCustomError(traceability, "UnauthorizedLogger").withArgs(trackingId, unauthorizedUser.address);
    });

    it("should validate input constraints (empty trackingId, zero hash, empty location)", async function () {
      await expect(
        traceability.connect(farmer).recordEvent("", 0, harvestHash, "Location")
      ).to.be.revertedWithCustomError(traceability, "InvalidTraceInput").withArgs("Empty trackingId");

      await expect(
        traceability.connect(farmer).recordEvent(trackingId, 0, ethers.ZeroHash, "Location")
      ).to.be.revertedWithCustomError(traceability, "InvalidTraceInput").withArgs("Empty metadataHash");

      await expect(
        traceability.connect(farmer).recordEvent(trackingId, 0, harvestHash, "")
      ).to.be.revertedWithCustomError(traceability, "InvalidTraceInput").withArgs("Empty location");
    });
  });
});
