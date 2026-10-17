const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { exportArtifacts } = require("./exportArtifacts");

async function main() {
  console.log("====================================================");
  console.log("FarmConnect AI — Blockchain Smart Contract Deployment");
  console.log("====================================================");

  const [deployer, testBuyer, testFarmer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // 1. Deploy FarmToken (FARM Test Token)
  console.log("1. Deploying FarmToken (FARM)...");
  const FarmToken = await ethers.getContractFactory("FarmToken");
  const farmToken = await FarmToken.deploy();
  await farmToken.waitForDeployment();
  const farmTokenAddress = await farmToken.getAddress();
  console.log("   -> FarmToken deployed to:", farmTokenAddress);

  // 2. Deploy FarmEscrow
  console.log("2. Deploying FarmEscrow payment foundation...");
  const FarmEscrow = await ethers.getContractFactory("FarmEscrow");
  const farmEscrow = await FarmEscrow.deploy(farmTokenAddress);
  await farmEscrow.waitForDeployment();
  const farmEscrowAddress = await farmEscrow.getAddress();
  console.log("   -> FarmEscrow deployed to:", farmEscrowAddress);

  // 3. Deploy FarmConnectOrderRegistry
  console.log("3. Deploying FarmConnectOrderRegistry...");
  const FarmConnectOrderRegistry = await ethers.getContractFactory("FarmConnectOrderRegistry");
  const registry = await FarmConnectOrderRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("   -> FarmConnectOrderRegistry deployed to:", registryAddress);

  // 4. Deploy ProduceTraceability
  console.log("4. Deploying ProduceTraceability...");
  const ProduceTraceability = await ethers.getContractFactory("ProduceTraceability");
  const traceability = await ProduceTraceability.deploy();
  await traceability.waitForDeployment();
  const traceabilityAddress = await traceability.getAddress();
  console.log("   -> ProduceTraceability deployed to:", traceabilityAddress);

  // 5. Seed initial on-chain demonstration agreement
  console.log("\n5. Seeding initial on-chain demonstration agreements...");
  const demoOrderId = "ORD-20261017-8821";
  const demoAgreementTerms = JSON.stringify({
    orderId: demoOrderId,
    crop: "Tomato",
    quantityKg: 150.0,
    agreedPricePerKg: 29.13,
    totalAmount: 4370.0,
    buyer: testBuyer.address,
    farmer: testFarmer.address,
    deliveryHub: "Bantwal APMC Hub",
    timestamp: "2026-10-17T17:00:00Z"
  });
  const demoAgreementHash = ethers.keccak256(ethers.toUtf8Bytes(demoAgreementTerms));

  await registry.registerOrder(
    demoOrderId,
    demoAgreementHash,
    testBuyer.address,
    testFarmer.address
  );
  console.log(`   -> Registered order ${demoOrderId} with agreement hash: ${demoAgreementHash}`);

  // Both parties confirm agreement
  await registry.connect(testBuyer).confirmAgreement(demoOrderId);
  await registry.connect(testFarmer).confirmAgreement(demoOrderId);
  console.log("   -> Buyer and Farmer confirmed agreement on-chain (Status: Confirmed).");

  // Record initial traceability milestone
  const traceTrackingId = "BATCH-MATTU-2026-001";
  const harvestMetadataHash = ethers.keccak256(ethers.toUtf8Bytes("Harvest batch metadata: Plot 4B, 150kg Mattu Gulla"));
  await traceability.connect(testFarmer).recordEvent(
    traceTrackingId,
    0, // HarvestRecorded
    harvestMetadataHash,
    "Shankarpura Farm, Udupi"
  );
  console.log(`   -> Logged initial HarvestRecorded milestone for batch ${traceTrackingId}`);

  // 6. Export Addresses & ABIs
  const deployedAddresses = {
    FarmToken: farmTokenAddress,
    FarmEscrow: farmEscrowAddress,
    FarmConnectOrderRegistry: registryAddress,
    ProduceTraceability: traceabilityAddress,
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(deploymentsDir, "localhost.json"),
    JSON.stringify(deployedAddresses, null, 2)
  );
  console.log("\nDeployment addresses saved to blockchain/deployments/localhost.json");

  exportArtifacts(deployedAddresses);
  console.log("\n>>> Blockchain deployment and artifact synchronization complete! <<<\n");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
