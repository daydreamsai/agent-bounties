import { ethers } from "ethers";

async function testRPC(name: string, url: string) {
  console.log(`\nTesting ${name}...`);
  console.log(`URL: ${url}`);
  
  try {
    const provider = new ethers.JsonRpcProvider(url);
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Connected! Current block: ${blockNumber}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed:`, error.message);
    return false;
  }
}

async function main() {
  const ethUrl = process.env.ETH_RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/U0JlifxkD4PpnFL7NHT4t";
  const bscUrl = process.env.BSC_RPC_URL || "https://bnb-mainnet.g.alchemy.com/v2/U0JlifxkD4PpnFL7NHT4t";

  console.log("🔌 RPC Connectivity Test\n");

  const ethOk = await testRPC("Ethereum", ethUrl);
  const bscOk = await testRPC("BSC", bscUrl);

  console.log("\n" + "=".repeat(60));
  console.log(`\nResults:`);
  console.log(`  Ethereum: ${ethOk ? "✅" : "❌"}`);
  console.log(`  BSC:      ${bscOk ? "✅" : "❌"}`);

  if (ethOk && bscOk) {
    console.log("\n✅ Both RPCs working!");
  } else {
    console.log("\n❌ Some RPCs failed. Check your API keys.");
  }
}

main();
