import { ethers } from "ethers";

async function debugQuery() {
  const provider = new ethers.JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/b5utCpUcyRbP5fQW1o7B-");
  
  const currentBlock = await provider.getBlockNumber();
  console.log(`Current block: ${currentBlock}\n`);
  
  // Test 1: Get any logs from recent blocks (no address filter)
  console.log("Test 1: Any logs in last 10 blocks (no filter)...");
  try {
    const logs = await provider.getLogs({
      fromBlock: currentBlock - 10,
      toBlock: currentBlock,
    });
    console.log(`  Found ${logs.length} logs`);
    if (logs.length > 0) {
      console.log(`  Sample addresses:`);
      const addresses = new Set(logs.slice(0, 10).map(l => l.address));
      addresses.forEach(addr => console.log(`    ${addr}`));
    }
  } catch (error: any) {
    console.log(`  Error: ${error.message}`);
  }
  
  // Test 2: Check Uniswap V2 factory code
  console.log("\nTest 2: Uniswap V2 factory code...");
  const v2Factory = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
  const code = await provider.getCode(v2Factory);
  console.log(`  Code length: ${code.length} chars`);
  console.log(`  Is contract: ${code !== "0x"}`);
  
  // Test 3: Try a known historical block range (block 10000000)
  console.log("\nTest 3: Historical block 10000000...");
  try {
    const historicalLogs = await provider.getLogs({
      address: v2Factory,
      fromBlock: 10000000,
      toBlock: 10000010,
    });
    console.log(`  Found ${historicalLogs.length} logs`);
    if (historicalLogs.length > 0) {
      console.log(`  First log block: ${historicalLogs[0].blockNumber}`);
      console.log(`  Topics: ${historicalLogs[0].topics[0]}`);
    }
  } catch (error: any) {
    console.log(`  Error: ${error.message}`);
  }
  
  // Test 4: Check if we can get block details
  console.log("\nTest 4: Current block details...");
  const block = await provider.getBlock(currentBlock);
  console.log(`  Block number: ${block?.number}`);
  console.log(`  Transactions: ${block?.transactions.length}`);
}

debugQuery();
