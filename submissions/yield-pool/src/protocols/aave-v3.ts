import { erc20Abi } from "viem";
import { formatUnits } from "viem/utils";
import { aaveV3PoolAbi } from "../abi/aavePool";
import { aaveOracleAbi } from "../abi/aaveOracle";
import type { PoolConfig } from "../config";
import { getPublicClient } from "../utils/clients";
import type { PoolMetrics } from "../types";
import type { FetchContext, ProtocolAdapter } from "./types";

type HexAddress = `0x${string}`;

interface AavePoolMetadata {
  poolContract: HexAddress;
  priceOracle: HexAddress;
  aTokenAddress?: HexAddress;
  underlyingAsset?: HexAddress;
  assetDecimals?: number;
  oracleDecimals: number;
}

const DEFAULT_ORACLE_DECIMALS = 8;

function parseMetadata(pool: PoolConfig): AavePoolMetadata {
  const metadata = (pool.metadata ?? {}) as Partial<AavePoolMetadata>;
  const poolContract = metadata.poolContract;
  const priceOracle = metadata.priceOracle;

  if (!poolContract) {
    throw new Error(
      `[aave-v3] poolContract missing in metadata for pool ${pool.id}`
    );
  }

  if (!priceOracle) {
    throw new Error(
      `[aave-v3] priceOracle missing in metadata for pool ${pool.id}`
    );
  }

  return {
    poolContract,
    priceOracle,
    aTokenAddress: metadata.aTokenAddress,
    underlyingAsset:
      metadata.underlyingAsset ?? (pool.address as HexAddress | undefined),
    assetDecimals: metadata.assetDecimals,
    oracleDecimals: metadata.oracleDecimals ?? DEFAULT_ORACLE_DECIMALS,
  };
}

function normaliseBlockTag(
  blockTag: FetchContext["blockTag"]
): bigint | undefined {
  if (blockTag === undefined) return undefined;
  if (typeof blockTag === "bigint") return blockTag;
  if (typeof blockTag === "number") return BigInt(blockTag);
  return undefined;
}

export const aaveV3Adapter: ProtocolAdapter = {
  id: "aave-v3",
  supports: {
    protocolIds: ["aave-v3", "aave"],
    chains: [1, 10, 137, 8453, 42161],
  },
  async fetchLatestMetrics(pool: PoolConfig, context: FetchContext) {
    const metadata = parseMetadata(pool);
    if (!metadata.underlyingAsset) {
      throw new Error(
        `[aave-v3] Unable to resolve underlying asset for pool ${pool.id}. Provide metadata.underlyingAsset or set pool.address.`
      );
    }

    const client = getPublicClient(pool.chainId);
    const requestedBlock = normaliseBlockTag(context.blockTag);
    const block =
      requestedBlock !== undefined
        ? await client.getBlock({ blockNumber: requestedBlock })
        : await client.getBlock();
    const blockNumber = block.number ?? requestedBlock ?? 0n;
    const blockTimestampMs =
      block.timestamp !== undefined
        ? Number(block.timestamp) * 1000
        : undefined;
    const timestamp =
      context.timestamp ??
      (blockTimestampMs !== undefined && Number.isFinite(blockTimestampMs)
        ? blockTimestampMs
        : Date.now());

    const aTokenAddress =
      metadata.aTokenAddress ?? (pool.address as HexAddress | undefined);
    if (!aTokenAddress) {
      throw new Error(
        `[aave-v3] Unable to resolve aToken address for pool ${pool.id}. Provide metadata.aTokenAddress.`
      );
    }

    const [reserveData, totalSupplyRaw, assetDecimalsResolved, assetPriceRaw] =
      await Promise.all([
        client.readContract({
          address: metadata.poolContract,
          abi: aaveV3PoolAbi,
          functionName: "getReserveData",
          args: [metadata.underlyingAsset],
          blockNumber,
        }),
        client.readContract({
          address: aTokenAddress,
          abi: erc20Abi,
          functionName: "totalSupply",
          blockNumber,
        }),
        metadata.assetDecimals !== undefined
          ? Promise.resolve(metadata.assetDecimals)
          : client
              .readContract({
                address: metadata.underlyingAsset,
                abi: erc20Abi,
                functionName: "decimals",
                blockNumber,
              })
              .then((value) => Number(value)),
        client.readContract({
          address: metadata.priceOracle,
          abi: aaveOracleAbi,
          functionName: "getAssetPrice",
          args: [metadata.underlyingAsset],
          blockNumber,
        }),
      ]);

    const assetDecimals = Number(assetDecimalsResolved);
    const totalSupply =
      typeof totalSupplyRaw === "bigint"
        ? totalSupplyRaw
        : BigInt(totalSupplyRaw as unknown as string);
    const assetPrice =
      typeof assetPriceRaw === "bigint"
        ? assetPriceRaw
        : BigInt(assetPriceRaw as unknown as string);

    const supplyNormalized = parseFloat(
      formatUnits(totalSupply, assetDecimals)
    );
    const priceNormalized = parseFloat(
      formatUnits(assetPrice, metadata.oracleDecimals)
    );
    const tvlUsd =
      Number.isFinite(supplyNormalized) && Number.isFinite(priceNormalized)
        ? supplyNormalized * priceNormalized
        : null;

    const liquidityRateRay = reserveData.currentLiquidityRate as bigint;
    const apyDecimal = parseFloat(formatUnits(liquidityRateRay, 27));
    const apyPercent = Number.isFinite(apyDecimal) ? apyDecimal * 100 : null;

    const result: PoolMetrics = {
      protocolId: pool.protocolId,
      poolId: pool.id,
      chainId: pool.chainId,
      address: metadata.underlyingAsset,
      blockNumber,
      timestamp,
      apy: apyPercent,
      tvl: tvlUsd,
      raw: {
        liquidityRateRay: liquidityRateRay.toString(),
        totalSupply: totalSupply.toString(),
        assetDecimals,
        price: assetPrice.toString(),
        oracleDecimals: metadata.oracleDecimals,
      },
    };

    return result;
  },
};
