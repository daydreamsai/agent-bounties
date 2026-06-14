import { getChainConfig } from './chains.js';
import { decodeFactoryLog, PAIR_CREATED_TOPIC, POOL_CREATED_TOPIC } from './decoder.js';
import { enrichMarket } from './enrichment.js';
import { RpcClient } from './rpc.js';
import { watchInputSchema, type FreshMarket, type WatchOutput } from './types.js';

export async function runFreshMarketsWatch(rawInput: unknown): Promise<WatchOutput> {
  const input = watchInputSchema.parse(rawInput ?? {});
  const chain = getChainConfig(input.chain);
  const rpc = new RpcClient(chain.rpcUrl);
  const latest = input.to_block === 'latest' ? await rpc.blockNumber() : input.to_block;
  const requestedBlocks = Math.ceil((input.window_minutes * 60) / chain.avgBlockSeconds);
  const maxBlocks = 9500;
  const scanBlocks = Math.min(requestedBlocks, maxBlocks);
  const fromBlock = input.from_block ?? Math.max(0, latest - scanBlocks);
  const selectedFactories = input.factories.length > 0
    ? chain.factories.filter((factory) => input.factories.map((value) => value.toLowerCase()).includes(factory.address.toLowerCase()))
    : chain.factories;
  const warnings: string[] = [];
  if (!input.from_block && requestedBlocks > maxBlocks) warnings.push(`Window capped to ${maxBlocks} blocks to stay within public RPC eth_getLogs range limits.`);
  if (selectedFactories.length === 0) warnings.push('No configured factories matched the requested factories list.');

  const blockTimes = new Map<number, string | null>();
  const markets: FreshMarket[] = [];
  for (const factory of selectedFactories) {
    const topic = factory.type === 'v2' ? PAIR_CREATED_TOPIC : POOL_CREATED_TOPIC;
    try {
      const logs = await rpc.getLogs({ fromBlock, toBlock: latest, address: factory.address, topics: [topic] });
      for (const log of logs) {
        const blockNumber = Number.parseInt(log.blockNumber, 16);
        if (!blockTimes.has(blockNumber)) blockTimes.set(blockNumber, await rpc.getBlockTimestamp(blockNumber));
        const decoded = decodeFactoryLog(log, factory, chain.name, blockTimes.get(blockNumber) ?? null);
        if (decoded) markets.push(await enrichMarket(rpc, decoded));
      }
    } catch (error) {
      warnings.push(`${factory.protocol} ${factory.address}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  markets.sort((a, b) => b.block_number - a.block_number || b.log_index - a.log_index);
  return {
    markets,
    warnings,
    scanned: { chain: chain.name, from_block: fromBlock, to_block: latest, factories: selectedFactories.map((factory) => factory.address) },
    data_sources: [`${chain.name}:rpc:eth_getLogs`, `${chain.name}:rpc:eth_getBlockByNumber`, `${chain.name}:rpc:eth_call`, `${chain.name}:rpc:eth_getTransactionReceipt`],
    fetched_at: new Date().toISOString()
  };
}
