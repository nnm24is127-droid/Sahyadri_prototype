const fs = require("fs");
const path = require("path");

/**
 * Utility to export contract ABIs and deployed addresses to predictable locations
 * for backend and frontend consumption.
 */
function exportArtifacts(deployedAddresses = {}) {
  const artifactsDir = path.join(__dirname, "../artifacts/contracts");
  const targetDirs = [
    path.join(__dirname, "../deployments"),
    path.join(__dirname, "../../frontend/src/contracts"),
    path.join(__dirname, "../../backend/app/blockchain"),
  ];

  targetDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const contracts = [
    { name: "FarmConnectOrderRegistry", file: "FarmConnectOrderRegistry.sol/FarmConnectOrderRegistry.json" },
    { name: "ProduceTraceability", file: "ProduceTraceability.sol/ProduceTraceability.json" },
    { name: "FarmToken", file: "FarmToken.sol/FarmToken.json" },
    { name: "FarmEscrow", file: "FarmEscrow.sol/FarmEscrow.json" },
  ];

  const exportPayload = {
    network: "localhost",
    chainId: 31337,
    generatedAt: new Date().toISOString(),
    contracts: {},
  };

  contracts.forEach(({ name, file }) => {
    const fullPath = path.join(artifactsDir, file);
    if (fs.existsSync(fullPath)) {
      const artifact = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      exportPayload.contracts[name] = {
        address: deployedAddresses[name] || null,
        abi: artifact.abi,
      };

      // Also export individual ABI JSON files
      targetDirs.forEach((targetDir) => {
        fs.writeFileSync(
          path.join(targetDir, `${name}.json`),
          JSON.stringify({ address: deployedAddresses[name] || null, abi: artifact.abi }, null, 2)
        );
      });
    }
  });

  // Save consolidated deployments map
  targetDirs.forEach((targetDir) => {
    fs.writeFileSync(
      path.join(targetDir, "deployedContracts.json"),
      JSON.stringify(exportPayload, null, 2)
    );
  });

  console.log("Contract ABIs and deployment addresses exported to:", targetDirs);
}

if (require.main === module) {
  // Can be executed standalone or required
  const localDeploymentsPath = path.join(__dirname, "../deployments/localhost.json");
  let addrs = {};
  if (fs.existsSync(localDeploymentsPath)) {
    addrs = JSON.parse(fs.readFileSync(localDeploymentsPath, "utf8"));
  }
  exportArtifacts(addrs);
}

module.exports = { exportArtifacts };
