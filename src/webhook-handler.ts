import { ethers } from "ethers";

import {
  ChainName,
  NewPair,
} from "./types";

import {
  pairKey,
  KVStoreImpl,
} from "./kv";

import {
  extractInitialHoldersFromReceipt,
} from "./holders";

const PAIR_CREATED_TOPIC =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e";

const V3_POOL_CREATED_TOPIC = ethers.id(
  "PoolCreated(address,address,uint24,int24,address)"
);

/*
 * IMPORTANT:
 * All keys are lowercase because lookup uses
 * factory.toLowerCase().
 */
const FACTORIES: Record<
  string,
  ChainName
> = {
  "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f":
    "ethereum",

  "0x1f98431c8ad98523631ae4a59f267346ea31f984":
    "ethereum",

  "0xca143ce32fe78f1f7019d7d551a6402fc5350c73":
    "bsc",

  "0x0bfbcf9fa4f9c56b0f40a671ad40e0805a091865":
    "bsc",
};

const RPCS: Record<
  ChainName,
  string
> = {
  ethereum:
    "https://ethereum-rpc.publicnode.com",

  bsc:
    "https://bsc-rpc.publicnode.com",
};

type WebhookLog = {
  data?: string;
  topics?: string[];
  account?: {
    address?: string;
  };
  address?: string;
  transaction?: {
    hash?: string;
  };
  transactionHash?: string;
};

type WebhookBlock = {
  number?: number | string;
  logs?: WebhookLog[];
};

type WebhookPayload = {
  event?: {
    data?: {
      block?: WebhookBlock;
    };
    block?: WebhookBlock;
  };

  data?: {
    block?: WebhookBlock;
  };

  block?: WebhookBlock;
};

export interface WebhookEnv {
  PAIRS_KV: KVNamespace;
  ALCHEMY_SIGNING_KEY?: string;
}

function jsonResponse(
  body: unknown,
  status = 200
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "content-type":
          "application/json",
      },
    }
  );
}

function normalizeAddress(
  value?: string
): string | null {
  if (!value) {
    return null;
  }

  try {
    return ethers.getAddress(value);
  } catch {
    return null;
  }
}

function getBlockAndLogs(
  payload: WebhookPayload
): WebhookBlock | null {
  return (
    payload.event?.data?.block ??
    payload.event?.block ??
    payload.data?.block ??
    payload.block ??
    null
  );
}

function getLogAddress(
  log: WebhookLog
): string | null {
  return normalizeAddress(
    log.account?.address ??
      log.address
  );
}

function getTransactionHash(
  log: WebhookLog
): string | null {
  return (
    log.transaction?.hash ??
    log.transactionHash ??
    null
  );
}

type ParsedPair = {
  token0: string;
  token1: string;
  pair: string;
  pairIndex?: bigint;
  isV3: boolean;
};

function extractPair(
  log: WebhookLog
): ParsedPair | null {
  const topics = log.topics ?? [];

  if (topics.length < 3 || !log.data) {
    return null;
  }

  const topic0 = topics[0]?.toLowerCase();

  try {
    const token0 = normalizeAddress(
      ethers.dataSlice(topics[1], 12, 32)
    );
    const token1 = normalizeAddress(
      ethers.dataSlice(topics[2], 12, 32)
    );

    if (!token0 || !token1) return null;

    if (topic0 === PAIR_CREATED_TOPIC.toLowerCase()) {
      if (log.data.length < 130) return null;

      const pair = normalizeAddress(
        ethers.dataSlice(log.data, 12, 32)
      );
      const pairIndexRaw = ethers.dataSlice(log.data, 32, 64);

      if (!pair) return null;

      return {
        token0,
        token1,
        pair,
        pairIndex: BigInt(pairIndexRaw),
        isV3: false,
      };
    }

    if (topic0 === V3_POOL_CREATED_TOPIC.toLowerCase()) {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint24", "int24", "address"],
        log.data
      );
      const pair = normalizeAddress(decoded[2]);

      if (!pair) return null;

      return {
        token0,
        token1,
        pair,
        isV3: true,
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function rpc(
  rpcUrl: string,
  method: string,
  params: unknown[]
): Promise<any> {
  const response =
    await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "content-type":
          "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    });

  if (!response.ok) {
    throw new Error(
      `RPC HTTP ${response.status}`
    );
  }

  const json =
    await response.json<any>();

  if (json.error) {
    throw new Error(
      json.error.message ??
        "RPC request failed"
    );
  }

  return json.result;
}

async function rpcWithRetry(
  rpcUrl: string,
  method: string,
  params: unknown[]
): Promise<any> {
  try {
    return await rpc(
      rpcUrl,
      method,
      params
    );
  } catch {
    return await rpc(
      rpcUrl,
      method,
      params
    );
  }
}

async function getReceipt(
  rpcUrl: string,
  txHash: string
): Promise<any> {
  return rpcWithRetry(
    rpcUrl,
    "eth_getTransactionReceipt",
    [txHash]
  );
}

async function getBlockTimestamp(
  rpcUrl: string,
  blockNumber: number
): Promise<number | null> {
  try {
    const hex = blockNumber.toString(16);
    const block = await rpcWithRetry(
      rpcUrl,
      "eth_getBlockByNumber",
      [`0x${hex}`, false]
    );

    if (!block?.timestamp) {
      return null;
    }

    return Number(BigInt(block.timestamp));
  } catch {
    return null;
  }
}

async function getCode(
  rpcUrl: string,
  address: string
): Promise<string> {
  return rpcWithRetry(
    rpcUrl,
    "eth_getCode",
    [
      address,
      "latest",
    ]
  );
}

async function getTokenSymbol(
  rpcUrl: string,
  token: string
): Promise<string> {
  try {
    const data =
      ethers.id("symbol()")
        .slice(0, 10);

    const result =
      await rpcWithRetry(
        rpcUrl,
        "eth_call",
        [
          {
            to: token,
            data,
          },
          "latest",
        ]
      );

    if (
      typeof result !== "string" ||
      result === "0x"
    ) {
      return "UNKNOWN";
    }

    try {
      return ethers
        .AbiCoder
        .defaultAbiCoder()
        .decode(
          ["string"],
          result
        )[0]
        .toString();
    } catch {
      try {
        const bytes32 =
          ethers
            .AbiCoder
            .defaultAbiCoder()
            .decode(
              ["bytes32"],
              result
            )[0];

        return ethers
          .decodeBytes32String(
            bytes32
          );
      } catch {
        return "UNKNOWN";
      }
    }
  } catch {
    return "UNKNOWN";
  }
}

async function getV2Reserves(
  rpcUrl: string,
  pair: string,
  isV3 = false
): Promise<{
  token0_raw: string;
  token1_raw: string;
}> {
  if (isV3) {
    return {
      token0_raw: "0",
      token1_raw: "0",
    };
  }
  try {
    const selector =
      ethers
        .id("getReserves()")
        .slice(0, 10);

    const result =
      await rpcWithRetry(
        rpcUrl,
        "eth_call",
        [
          {
            to: pair,
            data: selector,
          },
          "latest",
        ]
      );

    if (
      typeof result !== "string" ||
      result === "0x"
    ) {
      return {
        token0_raw: "0",
        token1_raw: "0",
      };
    }

    const decoded =
      ethers
        .AbiCoder
        .defaultAbiCoder()
        .decode(
          [
            "uint112",
            "uint112",
            "uint32",
          ],
          result
        );

    return {
      token0_raw:
        decoded[0].toString(),

      token1_raw:
        decoded[1].toString(),
    };
  } catch {
    return {
      token0_raw: "0",
      token1_raw: "0",
    };
  }
}

async function verifyAlchemySignature(
  rawBody: string,
  signature: string,
  signingKey: string
): Promise<boolean> {
  if (
    !rawBody ||
    !signature ||
    !signingKey
  ) {
    return false;
  }

  try {
    const encoder =
      new TextEncoder();

    const key =
      await crypto.subtle.importKey(
        "raw",
        encoder.encode(
          signingKey
        ),
        {
          name: "HMAC",
          hash: "SHA-256",
        },
        false,
        ["sign"]
      );

    const signatureBytes =
      await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(
          rawBody
        )
      );

    const calculated =
      Array.from(
        new Uint8Array(
          signatureBytes
        )
      )
        .map((byte) =>
          byte
            .toString(16)
            .padStart(2, "0")
        )
        .join("");

    return (
      calculated.toLowerCase() ===
      signature.toLowerCase()
    );
  } catch {
    return false;
  }
}

export async function handleWebhook(
  payload: WebhookPayload,
  env: WebhookEnv
): Promise<Response> {
  const block =
    getBlockAndLogs(payload);

  if (!block) {
    return jsonResponse(
      {
        ok: true,
        processed: 0,
        reason: "no_block",
      },
      200
    );
  }

  const blockNumber =
    Number(
      block.number ?? 0
    );

  if (
    !Number.isFinite(
      blockNumber
    ) ||
    blockNumber <= 0
  ) {
    return jsonResponse(
      {
        ok: false,
        processed: 0,
        reason:
          "invalid_block_number",
      },
      400
    );
  }

  const logs =
    block.logs ?? [];

  let processed = 0;
  let candidates = 0;
  let lastDetectionLatencyMs: number | null = null;
  let lastEventTimestamp: number | null = null;
  let lastStoredAt: string | null = null;

  const store =
    new KVStoreImpl(
      env.PAIRS_KV
    );

  for (const log of logs) {
    const factory =
      getLogAddress(log);

    if (!factory) {
      continue;
    }

    /*
     * FIX:
     * factory is normalized through
     * lowercase before lookup.
     */
    const chain =
      FACTORIES[
        factory.toLowerCase()
      ];

    if (!chain) {
      continue;
    }

    const parsed =
      extractPair(log);

    if (!parsed) {
      continue;
    }

    candidates++;

    const txHash =
      getTransactionHash(log);

    if (!txHash) {
      console.warn(
        "PairCreated candidate has no transaction hash"
      );

      continue;
    }

    const rpcUrl =
      RPCS[chain];

    const key =
      pairKey(
        chain,
        parsed.pair
      );

    try {
      if (
        await store.isDuplicate(
          key
        )
      ) {
        continue;
      }
    } catch (error) {
      console.warn(
        `KV deduplication failed for ${key}:`,
        error
      );

      continue;
    }

    try {
      const receipt =
        await getReceipt(
          rpcUrl,
          txHash
        );

      if (!receipt) {
        console.warn(
          `Receipt not found: ${txHash}`
        );

        continue;
      }

      if (
        receipt.status !==
          "0x1" &&
        receipt.status !== 1
      ) {
        console.warn(
          `Transaction reverted: ${txHash}`
        );

        continue;
      }

      if (
        receipt.transactionHash &&
        receipt.transactionHash
          .toLowerCase() !==
          txHash.toLowerCase()
      ) {
        console.warn(
          `Receipt hash mismatch: ${txHash}`
        );

        continue;
      }

      const code =
        await getCode(
          rpcUrl,
          parsed.pair
        );

      if (
        !code ||
        code === "0x" ||
        code.length <= 2
      ) {
        console.warn(
          `Pair has no contract code: ${parsed.pair}`
        );

        continue;
      }

      const blockTimestamp = await getBlockTimestamp(
        rpcUrl,
        blockNumber
      );

      const detectionLatencyMs =
        blockTimestamp === null
          ? null
          : Date.now() - blockTimestamp * 1000;

      const [
        symbol0,
        symbol1,
        liquidity,
      ] =
        await Promise.all([
          getTokenSymbol(
            rpcUrl,
            parsed.token0
          ),

          getTokenSymbol(
            rpcUrl,
            parsed.token1
          ),

          getV2Reserves(
            rpcUrl,
            parsed.pair,
            parsed.isV3
          ),
        ]);

      /*
       * Same holder logic used by scanner.
       */
      const holders =
        extractInitialHoldersFromReceipt(
          receipt,
          parsed.token0,
          parsed.token1,
          parsed.pair
        );

      if (holders.length < 3) {
        try {
          const transaction = await rpcWithRetry(
            rpcUrl,
            "eth_getTransactionByHash",
            [txHash]
          );

          if (transaction?.from) {
            holders.push(transaction.from);
          }

          if (parsed.isV3) {
            holders.push(parsed.pair);
          }
        } catch {}
      }

      const uniqueHolders =
        Array.from(
          new Set(
            holders
              .map((address) => normalizeAddress(address))
              .filter(Boolean)
              .filter(
                (address): address is string =>
                  address !== null
              )
              .map((address) => address.toLowerCase())
          )
        );

      const pair: NewPair = {
        pair_address:
          ethers.getAddress(
            parsed.pair
          ),

        factory:
          ethers.getAddress(
            factory
          ),

        tokens: [
          {
            address:
              ethers.getAddress(
                parsed.token0
              ),
            symbol: symbol0,
          },

          {
            address:
              ethers.getAddress(
                parsed.token1
              ),
            symbol: symbol1,
          },
        ],

        init_liquidity:
          liquidity,

        top_holders:
          uniqueHolders,

        created_at:
          blockTimestamp !== null
            ? new Date(blockTimestamp * 1000).toISOString()
            : new Date().toISOString(),

        block_number:
          blockNumber,

        tx_hash:
          txHash,
      };

      await store.write(
        key,
        pair
      );

      processed++;

      lastDetectionLatencyMs = detectionLatencyMs;
      lastEventTimestamp = blockTimestamp;
      lastStoredAt = new Date().toISOString();

      console.log(
        `Pair stored: ${key} | holders=${uniqueHolders.length} | detection_latency_ms=${detectionLatencyMs ?? "unknown"} | event_timestamp=${blockTimestamp ?? "unknown"}`
      );
    } catch (error) {
      console.warn(
        `Failed processing pair ${parsed.pair}:`,
        error
      );
    }
  }

  return jsonResponse({
    ok: true,
    processed,
    candidates,
    block_number:
      blockNumber,
    detection_latency_ms:
      lastDetectionLatencyMs,
    event_timestamp:
      lastEventTimestamp,
    stored_at:
      lastStoredAt,
  });
}

export async function handleSignedWebhook(
  request: Request,
  env: WebhookEnv
): Promise<Response> {
  const signingKey =
    env.ALCHEMY_SIGNING_KEY;

  if (!signingKey) {
    console.error(
      "ALCHEMY_SIGNING_KEY is not configured"
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "webhook_security_not_configured",
      },
      500
    );
  }

  const rawBody =
    await request.text();

  const signature =
    request.headers.get(
      "x-alchemy-signature"
    );

  if (
    !signature ||
    !(await verifyAlchemySignature(
      rawBody,
      signature,
      signingKey
    ))
  ) {
    console.warn(
      "Rejected webhook: invalid Alchemy signature"
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "invalid_signature",
      },
      401
    );
  }

  let payload:
    WebhookPayload;

  try {
    payload =
      JSON.parse(
        rawBody
      ) as WebhookPayload;
  } catch {
    return jsonResponse(
      {
        ok: false,
        error:
          "invalid_json",
      },
      400
    );
  }

  return handleWebhook(
    payload,
    env
  );
}
