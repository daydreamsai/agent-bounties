import { ethers } from "ethers";

async function quickCheck() {
  const provider = new ethers.JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/b5utCpUcyRbP5fQW1o7B-");
  
  const factories = {
    "Uniswap V2": "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    "Uniswap V3": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  };
  
  const currentBlock = await provider.getBlockNumber();
  console.log(`Current block: ${currentBlock}\n`);
  
  const CHUNK_SIZE = 9; // Alchemy free tier: max 10-block range
  
  for (const [name, address] of Object.entries(factories)) {
    console.log(`Checking ${name}...`);
    
    let totalLogs = 0;
    const sampleLogs: any[] = [];
    
    for (let chunkStart = currentBlock - 100; chunkStart <= currentBlock; chunkStart += CHUNK_SIZE) {
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, currentBlock);
      
      try {
        const logs = await provider.getLogs({
          address: address,
          fromBlock: chunkStart,
          toBlock: chunkEnd,
        });
        
        if (logs.length > 0) {
          totalLogs += logs.length;
          if (sampleLogs.length < 3) {
            sampleLogs.push(...logs.slice(0, 3 - sampleLogs.length));
          }
        }
      } catch (error: any) {
        console.log(`  Error at blocks ${chunkStart}-${chunkEnd}: ${error.message}`);
      }
    }
    
    console.log(`  Logs in last 100 blocks: ${totalLogs}`);
    
    if (sampleLogs.length > 0) {
      console.log(`  Sample topics:`);
      sampleLogs.forEach((log, i) => {
        console.log(`    ${i + 1}. ${log.topics[0]}`);
        console.log(`       Block: ${log.blockNumber}`);
      });
    }
    console.log();
  }
}

quickCheck();
