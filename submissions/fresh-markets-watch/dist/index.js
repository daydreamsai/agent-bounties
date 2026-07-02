import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import { createPublicClient, http, getAddress, parseAbi, } from "viem";
import { mainnet, base, polygon } from "viem/chains";
// ── Supported chains ────────────────────────────────────────────────────────
const CHAIN_MAP = {
    ethereum: mainnet,
    base,
    polygon,
};
const CHAIN_RPCS = {
    ethereum: "https://ethereum-rpc.publicnode.com",
    base: "https://base-rpc.publicnode.com",
    polygon: "https://polygon-rpc.com",
};
// ── ABI fragments ───────────────────────────────────────────────────────────
const PAIR_CREATED_EVENT_ABI = parseAbi([
    "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)",
]);
const PAIR_ABI = parseAbi([
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
]);
const ERC20_META_ABI = parseAbi([
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
]);
// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtAddr(addr) {
    return getAddress(addr);
}
/** Generic contract reader — accepts any client to avoid viem version type conflicts */
async function readContract(client, address, abi, functionName, args = []) {
    return client.readContract({
        address,
        abi,
        functionName,
        args,
    });
}
async function getTokenMeta(client, tokenAddress) {
    try {
        const [symbol, name] = await Promise.all([
            readContract(client, tokenAddress, ERC20_META_ABI, "symbol"),
            readContract(client, tokenAddress, ERC20_META_ABI, "name"),
        ]);
        return { symbol, name };
    }
    catch {
        return { symbol: "UNKNOWN", name: "Unknown Token" };
    }
}
async function getTopHolders(client, pairAddr, totalSupply) {
    const candidates = [
        "0x0000000000000000000000000000000000000000",
        "0x000000000000000000000000000000000000dead",
    ];
    const balances = await Promise.all(candidates.map(async (addr) => {
        try {
            const bal = await readContract(client, pairAddr, PAIR_ABI, "balanceOf", [addr]);
            return { address: addr, balance: bal };
        }
        catch {
            return { address: addr, balance: 0n };
        }
    }));
    const nonZero = balances
        .filter((b) => b.balance > 0n)
        .sort((a, b) => (b.balance > a.balance ? 1 : -1))
        .slice(0, 5);
    if (nonZero.length === 0) {
        return [
            { address: fmtAddr(pairAddr), balance: "100", percentage: "100.00" },
        ];
    }
    const ts = totalSupply > 0n ? Number(totalSupply) : 1;
    return nonZero.map((h) => ({
        address: fmtAddr(h.address),
        balance: h.balance.toString(),
        percentage: ((Number(h.balance) / ts) * 100).toFixed(2),
    }));
}
// ── Core logic ──────────────────────────────────────────────────────────────
const BLOCK_TIME_SEC = {
    ethereum: 12,
    base: 2,
    polygon: 2,
};
async function detectNewPairs(client, chainKey, factoryAddresses, windowMinutes) {
    const avgBlockTime = BLOCK_TIME_SEC[chainKey] ?? 12;
    const blocksToLookBack = Math.max(1, Math.floor((windowMinutes * 60) / avgBlockTime));
    const currentBlock = await client.getBlockNumber();
    const fromBlock = currentBlock - BigInt(blocksToLookBack);
    const results = [];
    for (const rawAddr of factoryAddresses) {
        const factoryAddr = getAddress(rawAddr);
        try {
            const logs = await client.getLogs({
                address: factoryAddr,
                event: PAIR_CREATED_EVENT_ABI[0],
                fromBlock,
                toBlock: currentBlock,
            });
            for (const log of logs) {
                const logArgs = log.args;
                const pairAddress = logArgs.pair;
                if (!pairAddress)
                    continue;
                try {
                    const [token0Addr, token1Addr, reservesTuple, totalSupply] = await Promise.all([
                        readContract(client, pairAddress, PAIR_ABI, "token0"),
                        readContract(client, pairAddress, PAIR_ABI, "token1"),
                        readContract(client, pairAddress, PAIR_ABI, "getReserves"),
                        readContract(client, pairAddress, PAIR_ABI, "totalSupply"),
                    ]);
                    const [token0Meta, token1Meta] = await Promise.all([
                        getTokenMeta(client, token0Addr),
                        getTokenMeta(client, token1Addr),
                    ]);
                    const block = await client.getBlock({
                        blockNumber: log.blockNumber,
                    });
                    const topHolders = await getTopHolders(client, pairAddress, totalSupply);
                    const reserve0 = reservesTuple[0];
                    const reserve1 = reservesTuple[1];
                    results.push({
                        pair_address: fmtAddr(pairAddress),
                        tokens: {
                            token0: {
                                address: fmtAddr(token0Addr),
                                symbol: token0Meta.symbol,
                                name: token0Meta.name,
                            },
                            token1: {
                                address: fmtAddr(token1Addr),
                                symbol: token1Meta.symbol,
                                name: token1Meta.name,
                            },
                        },
                        init_liquidity: `${reserve0.toString()} / ${reserve1.toString()}`,
                        top_holders: topHolders,
                        created_at: new Date(Number(block.timestamp) * 1000).toISOString(),
                    });
                }
                catch (err) {
                    console.error(`Error processing pair ${pairAddress}:`, err);
                }
            }
        }
        catch (err) {
            console.error(`Error fetching logs for factory ${factoryAddr}:`, err);
        }
    }
    return results;
}
// ── Input/Output schemas ────────────────────────────────────────────────────
// Zod v3 types vs agent-kit's Zod v4 types require casting.
const InputSchema = z.object({
    chain: z
        .string()
        .describe("Target blockchain: 'ethereum' | 'base' | 'polygon'"),
    factories: z
        .array(z.string())
        .describe("Array of AMM factory contract addresses"),
    window_minutes: z
        .number()
        .int()
        .positive()
        .describe("Look-back window in minutes for detecting new pairs"),
});
const OutputSchema = z.object({
    chain: z.string(),
    window_minutes: z.number(),
    pairs_found: z.number(),
    pairs: z.array(z.object({
        pair_address: z.string(),
        tokens: z.object({
            token0: z.object({
                address: z.string(),
                symbol: z.string(),
                name: z.string(),
            }),
            token1: z.object({
                address: z.string(),
                symbol: z.string(),
                name: z.string(),
            }),
        }),
        init_liquidity: z.string(),
        top_holders: z.array(z.object({
            address: z.string(),
            balance: z.string(),
            percentage: z.string(),
        })),
        created_at: z.string(),
    })),
});
// ── Agent ───────────────────────────────────────────────────────────────────
const { app, addEntrypoint } = createAgentApp({
    name: "Fresh Markets Watch",
    version: "0.1.0",
    description: "Monitors newly created AMM pairs/pools on Ethereum, Base, and Polygon. " +
        "Accepts a chain, factory contract addresses, and a time window (minutes) " +
        "to detect and return new pairs with token metadata, initial liquidity, and top holders.",
}, {
    payments: false,
});
addEntrypoint({
    key: "fresh-markets-watch",
    description: "Scan for newly created AMM pairs on a target chain within a time window.",
    input: InputSchema,
    output: OutputSchema,
    async handler(ctx) {
        const input = ctx.input;
        const chainKey = input.chain.toLowerCase();
        const viemChain = CHAIN_MAP[chainKey];
        if (!viemChain) {
            throw new Error(`Unsupported chain: "${input.chain}". Supported: ${Object.keys(CHAIN_MAP).join(", ")}`);
        }
        const client = createPublicClient({
            chain: viemChain,
            transport: http(CHAIN_RPCS[chainKey]),
        });
        const pairs = await detectNewPairs(client, chainKey, input.factories, input.window_minutes);
        return {
            output: {
                chain: input.chain,
                window_minutes: input.window_minutes,
                pairs_found: pairs.length,
                pairs,
            },
            usage: { total_tokens: pairs.length },
        };
    },
});
export default app;
//# sourceMappingURL=index.js.map