import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { aaveAddressesProviderAbi } from "../src/abi/aaveAddressesProvider";
import { aaveV3PoolAbi } from "../src/abi/aavePool";

const RPC =
  process.env.RPC_URL_8453 ??
  process.env.RPC_URL ??
  "https://mainnet.base.org";

const registryAddress =
  "0x770ef9f4fe897e59dacc474ef11238303f9552b6" as const;

async function main() {
  const client = createPublicClient({
    chain: base,
    transport: http(RPC),
  });

  const usdcAddress =
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as const;

  const providers = (await client.readContract({
    address: registryAddress,
    abi: [
      {
        inputs: [],
        name: "getAddressesProvidersList",
        outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
        stateMutability: "view",
        type: "function",
      },
    ] as const,
    functionName: "getAddressesProvidersList",
  })) as `0x${string}`[];

  console.log(`Found ${providers.length} address providers. Scanning...`);

  for (const providerAddress of providers) {
    try {
      const [poolAddress, priceOracleAddress, reserveData] = await Promise.all([
        client.readContract({
          address: providerAddress,
          abi: aaveAddressesProviderAbi,
          functionName: "getPool",
        }),
        client.readContract({
          address: providerAddress,
          abi: aaveAddressesProviderAbi,
          functionName: "getPriceOracle",
        }),
        client.readContract({
          address: providerAddress,
          abi: aaveV3PoolAbi,
          functionName: "getReserveData",
          args: [usdcAddress],
        }),
      ]);

      const aTokenAddress = (reserveData as any).aTokenAddress as `0x${string}`;

      console.log("✅ Aave provider found!");
      console.log("PoolAddressesProvider:", providerAddress);
      console.log("Pool:", poolAddress);
      console.log("PriceOracle:", priceOracleAddress);
      console.log("USDC:", usdcAddress);
      console.log("aUSDC:", aTokenAddress);
      return;
    } catch (error) {
      console.log(`Skipping provider ${providerAddress}: ${(error as Error).message}`);
    }
  }

  console.error("Unable to locate an Aave v3 provider that lists USDC on Base.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
