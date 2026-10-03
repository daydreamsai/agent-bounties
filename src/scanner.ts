import { ethers } from "ethers";

import {
  ChainName,
  NewPair,
} from "./types";

import {
  CHAINS,
} from "./chains";

import {
  KVStoreImpl,
  pairKey,
} from "./kv";

import {
  extractInitialHolders,
} from "./holders";

const PAIR_CREATED_TOPIC =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e";

const V3_POOL_CREATED_TOPIC =
  ethers.id(
    "PoolCreated(address,address,uint24,int24,address)"
  );

const MAX_BLOCK_RANGE = 2000;
const MAX_PAIRS_PER_RUN = 20;
const MAX_RUNTIME_MS = 25_000;

const V2_FACTORIES: Record<
  ChainName,
  string[]
> = {
  ethereum: [
    "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
  ],

  bsc: [
    "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
  ],
};

const V3_FACTORIES: Record<
  ChainName,
  string[]
> = {
  ethereum: [
    "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  ],

  bsc: [
    "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
  ],
};

/*
 * Only the fields actually used by the scanner are represented here.
 *
 * eth_getLogs returns numeric JSON-RPC quantities as hexadecimal strings.
 * We convert those quantities to numbers before the log reaches the
 * processing functions.
 */
interface RawRpcLog {
  address: string;

  topics: string[];

  data: string;

  blockNumber: string;

  transactionHash: string;

  transactionIndex: string;

  logIndex: string;

  removed?: boolean;
}

interface ScanLog {
  address: string;

  topics: string[];

  data: string;

  blockNumber: number;

  transactionHash: string;

  transactionIndex: number;

  index: number;

  removed: boolean;
}

function getProvider(
  chain: ChainName
): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(
    CHAINS[chain].rpc_url
  );
}

/*
 * Some RPC endpoints reject JSON-RPC hex quantities when they have
 * an odd number of hexadecimal digits.
 *
 * Example:
 *
 *   0x18e594f  -> rejected by some RPCs
 *   0x018e594f -> accepted
 *
 * Always send an even-length hexadecimal quantity.
 */
function toRpcBlockTag(
  block: number
): string {
  const hex =
    block.toString(16);

  return `0x${
    hex.length % 2 === 1
      ? `0${hex}`
      : hex
  }`;
}

/*
 * Direct JSON-RPC eth_getLogs implementation.
 *
 * This intentionally does NOT use ethers provider.getLogs().
 * Some PublicNode endpoints reject the normalized values produced
 * by ethers for eth_getLogs.
 */
async function getLogsCompat(
  chain: ChainName,
  address: string,
  topic: string,
  fromBlock: string,
  toBlock: string
): Promise<ScanLog[]> {
  const rpcUrl =
    CHAINS[chain].rpc_url;

  const response =
    await fetch(
      rpcUrl,
      {
        method: "POST",

        headers: {
          "content-type":
            "application/json",
        },

        body: JSON.stringify({
          jsonrpc: "2.0",

          id: 1,

          method:
            "eth_getLogs",

          params: [
            {
              address,

              topics: [
                topic,
              ],

              fromBlock,

              toBlock,
            },
          ],
        }),
      }
    );

  if (!response.ok) {
    throw new Error(
      `RPC HTTP ${response.status}`
    );
  }

  const payload =
    (await response.json()) as {
      result?: RawRpcLog[];

      error?: {
        code?: number;
        message?: string;
        data?: unknown;
      };
    };

  if (payload.error) {
    throw new Error(
      `eth_getLogs RPC error ${
        payload.error.code ?? "unknown"
      }: ${
        payload.error.message ??
        "unknown error"
      }`
    );
  }

  if (
    !Array.isArray(
      payload.result
    )
  ) {
    return [];
  }

  return payload.result.map(
    (log) => ({
      address:
        log.address,

      topics:
        log.topics,

      data:
        log.data,

      blockNumber:
        Number.parseInt(
          log.blockNumber,
          16
        ),

      transactionHash:
        log.transactionHash,

      transactionIndex:
        Number.parseInt(
          log.transactionIndex,
          16
        ),

      index:
        Number.parseInt(
          log.logIndex,
          16
        ),

      removed:
        Boolean(
          log.removed
        ),
    })
  );
}

function normalizeAddress(
  address: string
): string {
  return ethers.getAddress(
    address
  );
}

function topicToAddress(
  topic: string
): string {
  return normalizeAddress(
    `0x${topic.slice(-40)}`
  );
}

async function getTokenSymbol(
  provider: ethers.JsonRpcProvider,
  token: string
): Promise<string> {
  try {
    const contract =
      new ethers.Contract(
        token,
        [
          "function symbol() view returns (string)",
        ],
        provider
      );

    return await contract.symbol();
  } catch {
    return "UNKNOWN";
  }
}

async function getV2Liquidity(
  provider: ethers.JsonRpcProvider,
  pair: string,
  blockTag?: number
): Promise<{
  token0_raw: string;
  token1_raw: string;
}> {
  try {
    const contract =
      new ethers.Contract(
        pair,
        [
          "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
        ],
        provider
      );

    const reserves =
      await contract.getReserves(
        blockTag === undefined
          ? undefined
          : {
              blockTag,
            }
      );

    return {
      token0_raw:
        reserves[0].toString(),

      token1_raw:
        reserves[1].toString(),
    };
  } catch {
    return {
      token0_raw: "0",

      token1_raw: "0",
    };
  }
}

async function processV2Event(
  provider: ethers.JsonRpcProvider,
  store: KVStoreImpl,
  chain: ChainName,
  log: ScanLog
): Promise<boolean> {
  try {
    if (
      log.topics.length < 3
    ) {
      return false;
    }

    if (
      log.topics[0]?.toLowerCase() !==
      PAIR_CREATED_TOPIC.toLowerCase()
    ) {
      return false;
    }

    const token0 =
      topicToAddress(
        log.topics[1]
      );

    const token1 =
      topicToAddress(
        log.topics[2]
      );

    const decoded =
      ethers.AbiCoder
        .defaultAbiCoder()
        .decode(
          [
            "address",
            "uint256",
          ],
          log.data
        );

    const pair =
      normalizeAddress(
        decoded[0]
      );

    const txHash =
      log.transactionHash;

    const key =
      pairKey(
        chain,
        pair
      );

    if (
      await store.isDuplicate(
        key
      )
    ) {
      return false;
    }

    const receipt =
      await provider.getTransactionReceipt(
        txHash
      );

    if (!receipt) {
      return false;
    }

    if (
      receipt.status !== 1
    ) {
      return false;
    }

    const code =
      await provider.getCode(
        pair
      );

    if (
      !code ||
      code === "0x"
    ) {
      return false;
    }

    const [
      symbol0,
      symbol1,
      liquidity,
      holders,
      block,
    ] =
      await Promise.all([
        getTokenSymbol(
          provider,
          token0
        ),

        getTokenSymbol(
          provider,
          token1
        ),

        getV2Liquidity(
          provider,
          pair,
          log.blockNumber
        ),

        extractInitialHolders({
          tx_hash:
            txHash,

          chain,

          pair_address:
            pair,

          token0,

          token1,
        }),

        provider.getBlock(
          log.blockNumber
        ),
      ]);

    const newPair:
      NewPair = {
      pair_address:
        pair,

      factory:
        normalizeAddress(
          log.address
        ),

      tokens: [
        {
          address:
            token0,

          symbol:
            symbol0,
        },

        {
          address:
            token1,

          symbol:
            symbol1,
        },
      ],

      init_liquidity:
        liquidity,

      top_holders:
        holders,

      created_at:
        block
          ? new Date(
              Number(
                block.timestamp
              ) * 1000
            ).toISOString()
          : new Date()
              .toISOString(),

      block_number:
        log.blockNumber,

      tx_hash:
        txHash,
    };

    await store.write(
      key,
      newPair
    );

    console.log(
      `Stored V2 pair ${pair} on ${chain}`
    );

    return true;
  } catch (error) {
    console.warn(
      `Failed processing V2 event on ${chain}:`,
      error
    );

    return false;
  }
}

async function processV3Event(
  provider: ethers.JsonRpcProvider,
  store: KVStoreImpl,
  chain: ChainName,
  log: ScanLog
): Promise<boolean> {
  try {
    if (
      log.topics.length < 4
    ) {
      return false;
    }

    if (
      log.topics[0]?.toLowerCase() !==
      V3_POOL_CREATED_TOPIC.toLowerCase()
    ) {
      return false;
    }

    const token0 =
      topicToAddress(
        log.topics[1]
      );

    const token1 =
      topicToAddress(
        log.topics[2]
      );

    let pool:
      string | null = null;

    try {
      const parsed =
        ethers.AbiCoder
          .defaultAbiCoder()
          .decode(
            [
              "int24",
              "address",
            ],
            log.data
          );

      pool =
        normalizeAddress(
          parsed[1]
        );
    } catch {
      pool = null;
    }

    if (!pool) {
      return false;
    }

    const txHash =
      log.transactionHash;

    const key =
      pairKey(
        chain,
        pool
      );

    if (
      await store.isDuplicate(
        key
      )
    ) {
      return false;
    }

    const receipt =
      await provider.getTransactionReceipt(
        txHash
      );

    if (!receipt) {
      return false;
    }

    if (
      receipt.status !== 1
    ) {
      return false;
    }

    const code =
      await provider.getCode(
        pool
      );

    if (
      !code ||
      code === "0x"
    ) {
      return false;
    }

    const [
      symbol0,
      symbol1,
      holders,
      block,
    ] =
      await Promise.all([
        getTokenSymbol(
          provider,
          token0
        ),

        getTokenSymbol(
          provider,
          token1
        ),

        extractInitialHolders({
          tx_hash:
            txHash,

          chain,

          pair_address:
            pool,

          token0,

          token1,
        }),

        provider.getBlock(
          log.blockNumber
        ),
      ]);

    if (
      holders.length < 3
    ) {
      holders.push(
        pool
      );
    }

    const newPair:
      NewPair = {
      pair_address:
        pool,

      factory:
        normalizeAddress(
          log.address
        ),

      tokens: [
        {
          address:
            token0,

          symbol:
            symbol0,
        },

        {
          address:
            token1,

          symbol:
            symbol1,
        },
      ],

      init_liquidity: {
        token0_raw:
          "0",

        token1_raw:
          "0",
      },

      top_holders:
        holders,

      created_at:
        block
          ? new Date(
              Number(
                block.timestamp
              ) * 1000
            ).toISOString()
          : new Date()
              .toISOString(),

      block_number:
        log.blockNumber,

      tx_hash:
        txHash,
    };

    await store.write(
      key,
      newPair
    );

    console.log(
      `Stored V3 pool ${pool} on ${chain}`
    );

    return true;
  } catch (error) {
    console.warn(
      `Failed processing V3 event on ${chain}:`,
      error
    );

    return false;
  }
}

async function scanRange(
  provider: ethers.JsonRpcProvider,
  store: KVStoreImpl,
  chain: ChainName,
  fromBlock: number,
  toBlock: number,
  startedAt: number
): Promise<{
  processed: number;
  timedOut: boolean;
}> {
  let processed = 0;

  const hasTimedOut =
    () =>
      Date.now() -
        startedAt >=
      MAX_RUNTIME_MS;

  if (
    hasTimedOut()
  ) {
    return {
      processed,

      timedOut:
        true,
    };
  }

  const fromBlockTag =
    toRpcBlockTag(
      fromBlock
    );

  const toBlockTag =
    toRpcBlockTag(
      toBlock
    );

  /*
   * Scan each V2 factory separately.
   */
  for (
    const factory of
      V2_FACTORIES[chain]
  ) {
    if (
      hasTimedOut() ||
      processed >=
        MAX_PAIRS_PER_RUN
    ) {
      break;
    }

    const v2Logs =
      await getLogsCompat(
        chain,

        factory,

        PAIR_CREATED_TOPIC,

        fromBlockTag,

        toBlockTag
      );

    for (
      const log of v2Logs
    ) {
      if (
        hasTimedOut() ||
        processed >=
          MAX_PAIRS_PER_RUN
      ) {
        break;
      }

      if (
        await processV2Event(
          provider,

          store,

          chain,

          log
        )
      ) {
        processed++;
      }
    }
  }

  /*
   * Scan each V3 factory separately.
   */
  if (
    !hasTimedOut() &&
    processed <
      MAX_PAIRS_PER_RUN
  ) {
    for (
      const factory of
        V3_FACTORIES[chain]
    ) {
      if (
        hasTimedOut() ||
        processed >=
          MAX_PAIRS_PER_RUN
      ) {
        break;
      }

      const v3Logs =
        await getLogsCompat(
          chain,

          factory,

          V3_POOL_CREATED_TOPIC,

          fromBlockTag,

          toBlockTag
        );

      for (
        const log of v3Logs
      ) {
        if (
          hasTimedOut() ||
          processed >=
            MAX_PAIRS_PER_RUN
        ) {
          break;
        }

        if (
          await processV3Event(
            provider,

            store,

            chain,

            log
          )
        ) {
          processed++;
        }
      }
    }
  }

  return {
    processed,

    timedOut:
      hasTimedOut(),
  };
}

export async function handleCron(
  kv: KVNamespace
): Promise<void> {
  const store =
    new KVStoreImpl(kv);

  const startedAt =
    Date.now();

  let totalProcessed = 0;

  let timedOut = false;

  const chains:
    ChainName[] = [
      "ethereum",
      "bsc",
    ];

  for (
    const chain of chains
  ) {
    if (
      timedOut ||
      totalProcessed >=
        MAX_PAIRS_PER_RUN
    ) {
      break;
    }

    try {
      const provider =
        getProvider(
          chain
        );

      const latestBlock =
        await provider.getBlockNumber();

      const blocksPerMinute =
        CHAINS[chain]
          .blocks_per_minute;

      const scanBlocks =
        Math.max(
          1,

          Math.ceil(
            15 *
              blocksPerMinute
          )
        );

      const fromBlock =
        Math.max(
          0,

          latestBlock -
            scanBlocks
        );

      let cursor =
        fromBlock;

      while (
        cursor <=
          latestBlock &&
        totalProcessed <
          MAX_PAIRS_PER_RUN &&
        !timedOut &&
        Date.now() -
            startedAt <
          MAX_RUNTIME_MS
      ) {
        const end =
          Math.min(
            latestBlock,

            cursor +
              MAX_BLOCK_RANGE -
              1
          );

        const result =
          await scanRange(
            provider,

            store,

            chain,

            cursor,

            end,

            startedAt
          );

        totalProcessed +=
          result.processed;

        timedOut =
          result.timedOut;

        cursor =
          end + 1;
      }
    } catch (error) {
      console.warn(
        `Cron scan failed for ${chain}:`,
        error
      );
    }
  }

  console.log(
    `Cron scan completed: ${totalProcessed} pairs processed` +
      (
        timedOut
          ? " (25s runtime limit reached)"
          : ""
      )
  );
}
