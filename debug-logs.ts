import { ethers } from "ethers";

async function debugLogs() {
  const provider = new ethers.JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/b5utCpUcyRbP5fQW1o7B-");
  
  const factoryAddress = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
  
  console.log("Testing different query approaches...\n");
  
  // Test 1: Query with "latest"
  try {
    console.log("Test 1: Query with 'latest' block...");
    const logs1 = await provider.getLogs({
      address: factoryAddress,
      fromBlock: "latest",
      toBlock: "latest",
    });
    console.log(`  Result: ${logs1.length} logs`);
  } catch (error: any) {
    console.log(`  Error: ${error.message}`);
  }
  
  // Test 2: Query single recent block
  try {
    const currentBlock = await provider.getBlockNumber();
    console.log(`\nTest 2: Query single block ${currentBlock}...`);
    const logs2 = await provider.getLogs({
      address: factoryAddress,
      fromBlock: currentBlock,
      toBlock: currentBlock,
    });
    console.log(`  Result: ${logs2.length} logs`);
  } catch (error: any) {
    console.log(`  Error: ${error.message}`);
  }
  
  // Test 3: Query known pair creation block
  try {
    console.log(`\nTest 3: Query block 10000835 (known pair creation)...`);
    const logs3 = await provider.getLogs({
      address: factoryAddress,
      fromBlock: 10000835,
      toBlock: 10000835,
    });
    console.log(`  Result: ${logs3.length} logs`);
    if (logs3.length > 0) {
      console.log(`  First log:`, logs3[0]);
    }
  } catch (error: any) {
    console.log(`  Error: ${error.message}`);
  }
  
  // Test 4: Try without address filter
  try {
    const currentBlock = await provider.getBlockNumber();
    console.log(`\nTest 4: Query all logs in block ${currentBlock}...`);
    const logs4 = await provider.getLogs({
      fromBlock: currentBlock,
      toBlock: currentBlock,
    });
    console.log(`  Result: ${logs4.length} logs from all contracts`);
  } catch (error: any) {
    console.log(`  Error: ${error.message}`);
  }
}

debugLogs();
