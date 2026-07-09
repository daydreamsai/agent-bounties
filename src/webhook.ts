import { extractHolders } from "./holders";
import { writePair, hasPair } from "./kv";
import type { NewPair } from "./types";
import type { WorkerState } from "./endpoints";

const PAIR_CREATED_TOPIC = "0x0d3648bd0f6ba80134a33ba9275ac585d9d315d0ad8f784421bc79d610934ca5";

function extractAddressFromTopic(topic: string): string {
  return "0x" + topic.slice(26);
}

export async function handleWebhook(
  payload: any,
  provider: any,
  kv: any,
  state: WorkerState
): Promise<{ success: boolean; error?: string; duplicate?: boolean }> {
  try {
    const logs = payload?.event?.data?.logs || [];
    const txHash = payload?.event?.transaction?.hash;
    const chain = payload?.event?.blockchain?.network === "eth-mainnet" ? "ethereum" : "bsc";

    const pairCreatedLog = logs.find((log: any) => log.topics?.[0] === PAIR_CREATED_TOPIC);
    if (!pairCreatedLog) {
      return { success: false, error: "No PairCreated event found" };
    }

    const token0 = extractAddressFromTopic(pairCreatedLog.topics[1]);
    const token1 = extractAddressFromTopic(pairCreatedLog.topics[2]);
    const pairAddress = "0x" + pairCreatedLog.data.slice(26, 66);

    if (await hasPair(kv, chain, pairAddress)) {
      return { success: true, duplicate: true };
    }

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) {
      return { success: false, error: "Transaction failed or not found" };
    }

    const code = await provider.getCode(pairAddress);
    if (!code || code === "0x") {
      return { success: false, error: "Contract does not exist" };
    }

    const holders = await extractHolders(provider, txHash, pairAddress, token0, token1);

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
    state.lastWebhook = new Date().toISOString();

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
