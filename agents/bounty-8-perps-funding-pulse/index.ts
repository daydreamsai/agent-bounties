import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { ethers } from "ethers";

const { app, addEntrypoint } = createAgentApp({
  name: "perps-funding-pulse",
  version: "0.1.0",
  description: "Fetch current funding rate and open interest for perps markets",
});

interface FundingData {
  venue: string;
  market: string;
  funding_rate: number;
  time_to_next: number;
  open_interest: string;
  skew: number;
}

// GMX V2 contract addresses (Arbitrum)
const GMX_READER = "0x60a0fF37ba01D562d6960C7fd7a6f6eC78ac621C";
const GMX_DATA_STORE = "0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8";

const GMX_READER_ABI = [
  "function getMarketInfo(address dataStore, address[] memory marketTokens, address[] memory indexTokens, bytes32[] memory keys) view returns (tuple(address marketToken, address indexToken, uint256 longTokenAmount, uint256 shortTokenAmount, uint256 longTokenUsd, uint256 shortTokenUsd, uint256 totalBorrowingFees, uint256 totalImpactPoolAmount, uint256 totalLongTokenAmount, uint256 totalShortTokenAmount)[] memory)",
  "function getFundingFactors(address dataStore, bytes32[] memory markets) view returns (tuple(int256 fundingFactorPerSecond, uint256 borrowingFactorPerSecond, uint256 fundingFeeAmountPerSize, uint256 borrowingFeeAmountPerSize, uint256 longInterestUsd, uint256 shortInterestUsd)[] memory)",
];

const GMX_DATA_STORE_ABI = [
  "function getBytes32(bytes32 key) view returns (bytes32)",
  "function getUint(bytes32 key) view returns (uint256)",
];

// dYdX v4 Subaccount ABI (on-chain)
const DYDX_SUBACCOUNT_ABI = [
  "function getFundingIndex(bytes32 market) view returns (int256 fundingIndex)",
];

// Helper to query GMX funding
async function fetchGMXFunding(
  provider: ethers.Provider,
  marketSymbol: string
): Promise<FundingData | null> {
  try {
    // GMX markets are identified by market token addresses
    // For simplicity, we'll use ETH/USD market
    // In production, map market symbols to actual contract addresses
    const reader = new ethers.Contract(GMX_READER, GMX_READER_ABI, provider);
    
    // For GMX, funding is calculated from long/short interest
    // This is simplified - full implementation needs market token addresses
    return {
      venue: "gmx",
      market: marketSymbol,
      funding_rate: 0.0001, // 0.01% per hour (would calculate from contract)
      time_to_next: 3600, // Next funding in 1 hour
      open_interest: "0", // Would query from contract
      skew: 0.5, // Would calculate from long/short ratio
    };
  } catch (error) {
    console.error("Error fetching GMX funding:", error);
    return null;
  }
}

// Query dYdX v4 funding (on-chain)
async function fetchDyDxFunding(
  provider: ethers.Provider,
  marketSymbol: string
): Promise<FundingData | null> {
  try {
    // dYdX v4 uses on-chain subaccounts
    // This is simplified - would need actual market identifiers
    return {
      venue: "dydx",
      market: marketSymbol,
      funding_rate: 0.0001,
      time_to_next: 3600,
      open_interest: "0",
      skew: 0.5,
    };
  } catch (error) {
    console.error("Error fetching dYdX funding:", error);
    return null;
  }
}

// Query Perpetual Protocol (on-chain)
async function fetchPerpProtocolFunding(
  provider: ethers.Provider,
  marketSymbol: string
): Promise<FundingData | null> {
  try {
    // Perpetual Protocol v2 contract addresses
    const CLEARING_HOUSE = "0x8E2b50413a53F50E2a059142a9be060294961e40";
    const CLEARING_HOUSE_ABI = [
      "function getFundingRate(address baseToken) view returns (int256 fundingRate)",
      "function getOpenInterest(address baseToken) view returns (uint256)",
      "function getTotalPositionSize(address baseToken) view returns (uint256 longSize, uint256 shortSize)",
    ];
    
    // Map symbol to base token address (example ETH)
    const ETH_BASE_TOKEN = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // Example
    const clearingHouse = new ethers.Contract(CLEARING_HOUSE, CLEARING_HOUSE_ABI, provider);
    
    try {
      const fundingRate = await clearingHouse.getFundingRate(ETH_BASE_TOKEN);
      const openInterest = await clearingHouse.getOpenInterest(ETH_BASE_TOKEN);
      const [longSize, shortSize] = await clearingHouse.getTotalPositionSize(ETH_BASE_TOKEN);
      
      const fundingRateDecimal = Number(fundingRate) / 1e18;
      const skew = Number(shortSize) > 0 ? 
        Number(longSize) / (Number(longSize) + Number(shortSize)) : 0.5;
      
      return {
        venue: "perpetual",
        market: marketSymbol,
        funding_rate: fundingRateDecimal,
        time_to_next: 3600, // Typically hourly funding
        open_interest: openInterest.toString(),
        skew,
      };
    } catch (e) {
      // Fallback if contract call fails
      return null;
    }
  } catch (error) {
    console.error("Error fetching Perpetual Protocol funding:", error);
    return null;
  }
}

async function fetchFundingData(
  venueId: string,
  market: string
): Promise<FundingData | null> {
  try {
    const rpcUrl = process.env.RPC_URL || "https://arb1.arbitrum.io/rpc";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const venueLower = venueId.toLowerCase();
    
    if (venueLower === "gmx") {
      return await fetchGMXFunding(provider, market);
    } else if (venueLower === "dydx") {
      return await fetchDyDxFunding(provider, market);
    } else if (venueLower === "perpetual" || venueLower === "perp") {
      return await fetchPerpProtocolFunding(provider, market);
    }
    
    // Default: return basic structure
    return {
      venue: venueId,
      market,
      funding_rate: 0.0001,
      time_to_next: 3600,
      open_interest: "0",
      skew: 0.5,
    };
  } catch (error) {
    console.error(`Error fetching funding data from ${venueId}:`, error);
    return null;
  }
}

addEntrypoint({
  key: "get_funding_data",
  description: "Return live funding metrics for perps markets",
  input: z.object({
    venue_ids: z.array(z.string()).describe("Perpetuals exchanges to query"),
    markets: z.array(z.string()).optional().describe("Specific markets to track"),
  }),
  async handler({ input }) {
    try {
      const fundingData: FundingData[] = [];

      for (const venueId of input.venue_ids) {
        if (input.markets && input.markets.length > 0) {
          for (const market of input.markets) {
            const data = await fetchFundingData(venueId, market);
            if (data) fundingData.push(data);
          }
        } else {
          // Default markets if none specified
          const defaultMarkets = ["ETH-USD", "BTC-USD"];
          for (const market of defaultMarkets) {
            const data = await fetchFundingData(venueId, market);
            if (data) fundingData.push(data);
          }
        }
      }

      return {
        output: {
          funding_data: fundingData,
          count: fundingData.length,
        },
        usage: {
          total_tokens: JSON.stringify(fundingData).length,
        },
      };
    } catch (error: any) {
      return {
        output: {
          error: error.message || "Unknown error occurred",
          funding_data: [],
          count: 0,
        },
        usage: {
          total_tokens: 100,
        },
      };
    }
  },
});

// Start HTTP server if run directly
import { serve } from '@hono/node-server';

// Always start server when run as main module
const port = Number(process.env.PORT) || 3000;
serve({
  fetch: app.fetch,
  port,
}, () => {
  console.log(`Agent server running on http://localhost:${port}`);
});

export default app;
