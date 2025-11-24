const hre = require("hardhat");
const ethers = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying FHEDge contract...");
  console.log(`Network: ${hre.network.name}`);

  // Get the artifact
  const artifactPath = path.join(__dirname, "../artifacts/contracts/FHEDge.sol/FHEDge.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Get provider
  const provider = new ethers.JsonRpcProvider(
    hre.network.name === "sepolia" 
      ? process.env.SEPOLIA_RPC_URL 
      : "http://127.0.0.1:5173"
  );

  // Get wallet
  let wallet;
  if (hre.network.name === "sepolia") {
    if (!process.env.PRIVATE_KEY) {
      console.log("❌ ERROR: PRIVATE_KEY not found in .env file!");
      console.log("📝 Please add your private key to .env file:");
      console.log("   PRIVATE_KEY=your_private_key_here");
      process.exit(1);
    }
    wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  } else {
    // Use default hardhat account for local deployment
    wallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
  }

  console.log(`Deploying from: ${wallet.address}`);
  
  // Create contract factory
  const ConfidentialPledge = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  );
  
  console.log("Deploying contract...");
  
  // Deploy the contract
  const FHEDge = await ConfidentialPledge.deploy();
  
  console.log("Waiting for deployment...");
  await FHEDge.waitForDeployment();
  
  const address = await FHEDge.getAddress();
  
  console.log("\n✅ Deployment successful!");
  console.log(`FHEDge deployed to: ${address}`);
  console.log("\n📝 Save this address for future interactions!");
  
  // Verification is optional - skip for now
  console.log("\n💡 Contract verification can be done later with:");
  console.log(`   npx hardhat verify --network ${hre.network.name} ${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
