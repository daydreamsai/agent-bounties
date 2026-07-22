import { ethers } from "ethers";

async function findLastPair() {
  const provider = new ethers.JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/b5utCpUcyRbP5fQW1o7B-");
  
  const factories = {
    "Uniswap V2": "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    "Uniswap V3": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  };
  
  const currentBlock = await provider.getBlockNumber();
  console.log(`Current block: ${currentBlock}\n`);
  
  const CHUNK_SIZE = 9;
  const RANGE = 1000; // Check last 1000 blocks (~3.3 hours on Ethereum)
  
  for (const [name, address] of Object.entries(factories)) {
    console.log(`Checking ${name} over last ${RANGE} blocks...`);
    
    let totalLogs = 0;
    let lastBlock = 0;
    
    for (let chunkStart = currentBlock - RANGE; chunkStart <= currentBlock; chunkStart += CHUNK_SIZE) {
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, currentBlock);
      
      try {
        const logs = await provider.getLogs({
          address: address,
          fromBlock: chunkStart,
          toBlock: chunkEnd,
        });
        
        if (logs.length > 0) {
          totalLogs += logs.length;
          lastBlock = Math.max(lastBlock, logs[logs.length - 1].blockNumber);
          console.log(`  Found ${logs.length} logs at block ${logs[0].blockNumber}`);
        }
      } catch (error: any) {
        console.log(`  Error: ${error.message}`);
      }
    }
    
    console.log(`  Total: ${totalLogs} logs`);
    if (lastBlock > 0) {
      const blocksAgo = currentBlock - lastBlock;
      const minutesAgo = (blocksAgo / 5).toFixed(1); // ~5 blocks per minute on Ethereum
      console.log(`  Last pair: ${blocksAgo} blocks ago (~${minutesAgo} minutes)`);
    } else {
      console.log(`  No pairs found in last ${RANGE} blocks`);
    }
    console.log();
  }
}

findLastPair();
