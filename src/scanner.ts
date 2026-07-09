import { extractHolders } from "./holders";
import { writePair, hasPair } from "./kv";
import { getChainConfig, getFactoryAddresses } from "./chains";
import type { NewPair } from "./types";
import type { WorkerState } from "./endpoints";

const PAIR_CREATED_TOPIC = "0x0d3648bd0f6ba80134a33ba9275ac585d9d315d0ad8f784421bc79d610934ca5";
const SCAN_WINDOW_MINUTES = 15;
const BATCH_SIZE = 20;
const CPU_LIMIT_MS = 25000;

function extractAddressFromTopic(topic: string): string {
  return "0x" + topic.slice(26);
}

export async function handleCron(
  kv: any,
  provider: any,
  state: WorkerState,
  chain: string
): Promise<number> {
  const startTime = Date.now();
  const config = getChainConfig(chain);
  const factories = getFactoryAddresses(chain);
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = currentBlock - SCAN_WINDOW_MINUTES * config.blocksPerMinute;

  let totalProcessed = 0;

  for (const factory of factories) {
    const logs = await provider.getLogs({
      address: factory,
      topics: [PAIR_CREATED_TOPIC],
      fromBlock,
      toBlock: currentBlock,
    });

      for (let i = 0; i < logs.length; i++) {
        if (Date.now() - startTime > CPU_LIMIT_MS) {
          state.lastCron = new Date().toISOString();
          return totalProcessed;
        }

        const log = logs[i];
        const token0 = extractAddressFromTopic(log.topics[1]);
        const token1 = extractAddressFromTopic(log.topics[2]);
        const pairAddress = "0x" + log.data.slice(26, 66);

        if (await hasPair(kv, chain, pairAddress)) {
          continue;
        }

        const receipt = await provider.getTransactionReceipt(log.transactionHash);
        if (!receipt || receipt.status !== 1) {
          continue;
        }

        const code = await provider.getCode(pairAddress);
        if (!code || code === "0x") {
          continue;
        }

        const holders = await extractHolders(provider, log.transactionHash, pairAddress, token0, token1);

        const pair: NewPair = {
          pair_address: pairAddress,
          tokens: [
            { address: token0, symbol: "TK0" },
            { address: token1, symbol: "TK1" },
          ],
          init_liquidity: { token0_raw: "0", token1_raw: "0" },
          top_holders: holders,
          created_at: new Date().toISOString(),
        };

        await writePair(kv, chain, pair);
        totalProcessed++;
      }
  }

  state.lastCron = new Date().toISOString();
  return totalProcessed;
}
