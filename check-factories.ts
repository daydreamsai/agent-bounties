import { ethers } from "ethers";

async function checkFactories() {
  const provider = new ethers.JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/b5utCpUcyRbP5fQW1o7B-");
  
  const factories = {
    "Uniswap V2": "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    "Uniswap V3": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  };
  
  const PAIR_CREATED_V2 = "0x0d3648bd0f6ba80134a33ba9275ac585d9d315d0ad8f784421bc79d610934ca5";
  const POOL_CREATED_V3 = "0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118";
  
  const currentBlock = await provider.getBlockNumber();
  console.log(`Current block: ${currentBlock}\n`);
  
  for (const [name, address] of Object.entries(factories)) {
    console.log(`Checking ${name} (${address})...`);
    
    // Verify it's a contract
    const code = await provider.getCode(address);
    console.log(`  Is contract: ${code !== "0x"} (${code.length} bytes)`);
    
    // Check last 10000 blocks (about 2 days on Ethereum)
    const CHUNK_SIZE = 10;
    let totalLogs = 0;
    const sampleLogs: any[] = [];
    
    for (let chunkStart = currentBlock - 10000; chunkStart <= currentBlock; chunkStart += CHUNK_SIZE) {
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
        // Ignore errors
      }
    }
    
    console.log(`  Logs in last 10000 blocks: ${totalLogs}`);
    
    if (sampleLogs.length > 0) {
      console.log(`  Sample log topics:`);
      sampleLogs.forEach((log, i) => {
        console.log(`    ${i + 1}. ${log.topics[0]}`);
      });
    }
    console.log();
  }
}

checkFactories();
