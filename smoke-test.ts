#!/usr/bin/env bun

/**
 * Smoke Test - Validates implementation against real blockchain data
 * 
 * Run before deployment to verify:
 * 1. Real PairCreated events can be fetched
 * 2. Holder extraction works on real transactions
 * 3. Block ranges are correct
 * 4. Data structures match expectations
 * 
 * Usage:
 *   ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY \
 *   BSC_RPC_URL=https://bnb-mainnet.g.alchemy.com/v2/YOUR_KEY \
 *   bun run smoke-test.ts
 */

import { ethers } from "ethers";
import { extractHolders } from "./src/holders";
import { getChainConfig } from "./src/chains";

const PAIR_CREATED_TOPIC = "0x0d3648bd0f6ba80134a33ba9275ac585d9d315d0ad8f784421bc79d610934ca5";

function extractAddressFromTopic(topic: string): string {
  return "0x" + topic.slice(26);
}

async function testEthereum() {
  console.log("\n🔵 Testing Ethereum Mainnet...\n");

  const rpcUrl = process.env.ETH_RPC_URL;
  if (!rpcUrl) {
    console.error("❌ ETH_RPC_URL not set");
    return false;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const config = getChainConfig("ethereum");

  // Test 1: Can we connect?
  try {
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Connected to Ethereum. Current block: ${blockNumber}`);
  } catch (error) {
    console.error("❌ Failed to connect to Ethereum RPC");
    return false;
  }

  // Test 2: Can we fetch recent PairCreated events?
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = currentBlock - 300; // ~1 hour (5 blocks/min)

  console.log(`\n📊 Scanning blocks ${fromBlock} to ${currentBlock} for PairCreated events...`);

  let totalPairs = 0;
  let testedHolders = false;

  const CHUNK_SIZE = 9; // Alchemy free tier: max 10-block range

  for (const factory of config.factories) {
    try {
      let factoryPairs = 0;

      for (let chunkStart = fromBlock; chunkStart <= currentBlock; chunkStart += CHUNK_SIZE) {
        const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, currentBlock);

        const logs = await provider.getLogs({
          address: factory,
          topics: [PAIR_CREATED_TOPIC],
          fromBlock: chunkStart,
          toBlock: chunkEnd,
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        factoryPairs += logs.length;

        // Test holder extraction on first pair
        if (logs.length > 0 && !testedHolders) {
          const log = logs[0];
          const token0 = extractAddressFromTopic(log.topics[1]);
          const token1 = extractAddressFromTopic(log.topics[2]);
          const pairAddress = "0x" + log.data.slice(26, 66);

          console.log(`\n🔍 Testing holder extraction on pair: ${pairAddress}`);
          console.log(`   Token0: ${token0}`);
          console.log(`   Token1: ${token1}`);
          console.log(`   Tx: ${log.transactionHash}`);

          const holders = await extractHolders(provider, log.transactionHash, pairAddress, token0, token1);
          console.log(`   Holders found: ${holders.length}`);
          console.log(`   Holders: ${holders.join(", ")}`);

          if (holders.length === 0) {
            console.warn("⚠️  No holders extracted — this might be a V3 pool or edge case");
          } else {
            console.log("✅ Holder extraction working");
          }

          testedHolders = true;
        }
      }

      console.log(`  Factory ${factory}: ${factoryPairs} pairs found`);
      totalPairs += factoryPairs;
    } catch (error) {
      console.error(`  ❌ Failed to query factory ${factory}:`, error);
    }
  }

  console.log(`\n📈 Total pairs found in last 15 min: ${totalPairs}`);

  if (totalPairs === 0) {
    console.warn("⚠️  No pairs found — this is unusual. Check if factories are correct or increase block range.");
  }

  return totalPairs > 0;
}

async function testBSC() {
  console.log("\n🟡 Testing BSC Mainnet...\n");

  const rpcUrl = process.env.BSC_RPC_URL;
  if (!rpcUrl) {
    console.error("❌ BSC_RPC_URL not set");
    return false;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const config = getChainConfig("bsc");

  // Test 1: Can we connect?
  try {
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Connected to BSC. Current block: ${blockNumber}`);
  } catch (error) {
    console.error("❌ Failed to connect to BSC RPC");
    return false;
  }

  // Test 2: Can we fetch recent PairCreated events?
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = currentBlock - 1200; // ~1 hour (20 blocks/min)

  console.log(`\n📊 Scanning blocks ${fromBlock} to ${currentBlock} for PairCreated events...`);

  let totalPairs = 0;

  const CHUNK_SIZE = 9; // Alchemy free tier: max 10-block range

  for (const factory of config.factories) {
    try {
      let factoryPairs = 0;

      for (let chunkStart = fromBlock; chunkStart <= currentBlock; chunkStart += CHUNK_SIZE) {
        const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, currentBlock);

        const logs = await provider.getLogs({
          address: factory,
          topics: [PAIR_CREATED_TOPIC],
          fromBlock: chunkStart,
          toBlock: chunkEnd,
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        factoryPairs += logs.length;

        // Test holder extraction on first pair
        if (logs.length > 0 && totalPairs === 0) {
          const log = logs[0];
          const token0 = extractAddressFromTopic(log.topics[1]);
          const token1 = extractAddressFromTopic(log.topics[2]);
          const pairAddress = "0x" + log.data.slice(26, 66);

          console.log(`\n🔍 Testing holder extraction on pair: ${pairAddress}`);

          const holders = await extractHolders(provider, log.transactionHash, pairAddress, token0, token1);
          console.log(`   Holders found: ${holders.length}`);

          if (holders.length > 0) {
            console.log("✅ Holder extraction working");
          }
        }
      }

      console.log(`  Factory ${factory}: ${factoryPairs} pairs found`);
      totalPairs += factoryPairs;
    } catch (error) {
      console.error(`  ❌ Failed to query factory ${factory}:`, error);
    }
  }

  console.log(`\n📈 Total pairs found in last 15 min: ${totalPairs}`);

  return totalPairs > 0;
}

async function main() {
  console.log("🚀 Fresh Markets Watch - Smoke Test\n");
  console.log("Testing against real blockchain data...\n");

  const ethResult = await testEthereum();
  const bscResult = await testBSC();

  console.log("\n" + "=".repeat(60));
  console.log("\n📋 Smoke Test Results:\n");
  console.log(`  Ethereum: ${ethResult ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  BSC:      ${bscResult ? "✅ PASS" : "❌ FAIL"}`);

  if (ethResult && bscResult) {
    console.log("\n✅ All smoke tests passed! Ready to deploy.");
    process.exit(0);
  } else {
    console.log("\n❌ Some tests failed. Review output above before deploying.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n💥 Smoke test crashed:", error);
  process.exit(1);
});
