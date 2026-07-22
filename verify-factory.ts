import { ethers } from "ethers";

async function verifyFactory() {
  const provider = new ethers.JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/b5utCpUcyRbP5fQW1o7B-");
  
  const factoryAddress = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
  
  // Check if it's a contract
  const code = await provider.getCode(factoryAddress);
  console.log(`Factory code length: ${code.length} bytes`);
  console.log(`Is contract: ${code !== "0x"}`);
  
  // Try to get recent logs without topic filter
  const currentBlock = await provider.getBlockNumber();
  console.log(`\nCurrent block: ${currentBlock}`);
  console.log(`\nChecking last 100 blocks for ANY logs from factory...`);
  
  const CHUNK_SIZE = 10;
  let totalLogs = 0;
  
  for (let chunkStart = currentBlock - 100; chunkStart <= currentBlock; chunkStart += CHUNK_SIZE) {
    const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, currentBlock);
    
    try {
      const logs = await provider.getLogs({
        address: factoryAddress,
        fromBlock: chunkStart,
        toBlock: chunkEnd,
      });
      
      if (logs.length > 0) {
        console.log(`  Blocks ${chunkStart}-${chunkEnd}: ${logs.length} logs`);
        console.log(`  First log topics:`, logs[0].topics);
        totalLogs += logs.length;
      }
    } catch (error: any) {
      console.error(`Error:`, error.message);
    }
  }
  
  console.log(`\nTotal logs in last 100 blocks: ${totalLogs}`);
  
  // Check a known historical pair creation
  console.log(`\n\nChecking known historical pair (WETH/USDC)...`);
  const historicalLogs = await provider.getLogs({
    address: factoryAddress,
    fromBlock: 10000835,
    toBlock: 10000835,
  });
  
  console.log(`Historical logs at block 10000835: ${historicalLogs.length}`);
  if (historicalLogs.length > 0) {
    console.log(`Topics:`, historicalLogs[0].topics);
  }
}

verifyFactory();
