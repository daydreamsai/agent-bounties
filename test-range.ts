import { ethers } from "ethers";

const PAIR_CREATED_TOPIC = "0x0d3648bd0f6ba80134a33ba9275ac585d9d315d0ad8f784421bc79d610934ca5";
const UNISWAP_V2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";

async function test() {
  const provider = new ethers.JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/b5utCpUcyRbP5fQW1o7B-");
  const currentBlock = await provider.getBlockNumber();
  
  console.log(`Current block: ${currentBlock}`);
  console.log(`Testing last 1000 blocks...`);
  
  const CHUNK_SIZE = 10;
  let totalPairs = 0;
  
  for (let chunkStart = currentBlock - 1000; chunkStart <= currentBlock; chunkStart += CHUNK_SIZE) {
    const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, currentBlock);
    
    try {
      const logs = await provider.getLogs({
        address: UNISWAP_V2_FACTORY,
        topics: [PAIR_CREATED_TOPIC],
        fromBlock: chunkStart,
        toBlock: chunkEnd,
      });
      
      if (logs.length > 0) {
        console.log(`  Blocks ${chunkStart}-${chunkEnd}: ${logs.length} pairs`);
        totalPairs += logs.length;
      }
    } catch (error: any) {
      console.error(`Error at ${chunkStart}:`, error.message);
    }
  }
  
  console.log(`\nTotal pairs in last 1000 blocks: ${totalPairs}`);
}

test();
