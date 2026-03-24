import { createPublicClient, http, formatUnits, type Address, type Chain } from 'viem';
import { mainnet, arbitrum, polygon, optimism, base, avalanche } from 'viem/chains';

// Protocol ABIs
const AAVE_POOL_ABI = [
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserAccountData',
    outputs: [
      { name: 'totalCollateralBase', type: 'uint256' },
      { name: 'totalDebtBase', type: 'uint256' },
      { name: 'availableBorrowsBase', type: 'uint256' },
      { name: 'currentLiquidationThreshold', type: 'uint256' },
      { name: 'ltv', type: 'uint256' },
      { name: 'healthFactor', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

const COMET_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'isLiquidatable',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'borrowBalanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'collateralBalanceOf',
    outputs: [
      { name: '', type: 'uint128' },
      { name: '', type: 'uint128' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// Protocol addresses by chain
const PROTOCOL_ADDRESSES: Record<string, Record<string, Record<string, Address>>> = {
  'aave-v3': {
    ethereum: {
      pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2' as Address
    },
    arbitrum: {
      pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD' as Address
    },
    polygon: {
      pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD' as Address
    },
    optimism: {
      pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD' as Address
    },
    base: {
      pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5' as Address
    },
    avalanche: {
      pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD' as Address
    }
  },
  'compound-v3': {
    ethereum: {
      comet: '0xA17581A9E3356d9A818b3fB6F286E9DdF8f1aF52' as Address // USDC market
    },
    arbitrum: {
      comet: '0x9c4ec768c28520B50860ea7a15bd7213a9fF583C' as Address
    },
    base: {
      comet: '0x46e6b214b524310239732D51387075E0e70970Bf' as Address
    }
  }
};

const CHAIN_MAP: Record<string, Chain> = {
  ethereum: mainnet,
  arbitrum,
  polygon,
  optimism,
  base,
  avalanche
};

const RPC_URLS: Record<string, string> = {
  ethereum: 'https://eth.llamarpc.com',
  arbitrum: 'https://arbitrum.llamarpc.com',
  polygon: 'https://polygon.llamarpc.com',
  optimism: 'https://optimism.llamarpc.com',
  base: 'https://base.llamarpc.com',
  avalanche: 'https://avalanche.llamarpc.com'
};

export interface PositionData {
  healthFactor: number;
  totalCollateralUSD: number;
  totalDebtUSD: number;
  liquidationThreshold: number;
  ltv: number;
  availableBorrowsUSD: number;
}

export interface LiquidationAlert {
  healthFactor: number;
  liqPriceThreshold: number;
  bufferPercent: number;
  alertThresholdHit: boolean;
  alertLevel: 'safe' | 'warning' | 'danger' | 'critical';
  collateralUSD: number;
  debtUSD: number;
  protocol: string;
  chain: string;
}

// Fetch Aave v3 position data
export async function fetchAaveV3Position(
  wallet: Address,
  chain: string
): Promise<PositionData | null> {
  const chainConfig = CHAIN_MAP[chain];
  if (!chainConfig) return null;

  const addresses = PROTOCOL_ADDRESSES['aave-v3'][chain];
  if (!addresses) return null;

  const client = createPublicClient({
    chain: chainConfig,
    transport: http(RPC_URLS[chain])
  });

  try {
    const result = await client.readContract({
      address: addresses.pool,
      abi: AAVE_POOL_ABI,
      functionName: 'getUserAccountData',
      args: [wallet]
    });

    const RAY = 10n ** 27n; // Aave uses 27 decimals for base values
    const USD_BASE = 8; // Aave uses 8 decimals for USD values

    const healthFactor = result[5] > 0n 
      ? Number(formatUnits(result[5], 18)) 
      : Infinity;

    return {
      healthFactor,
      totalCollateralUSD: Number(formatUnits(result[0], USD_BASE)),
      totalDebtUSD: Number(formatUnits(result[1], USD_BASE)),
      liquidationThreshold: Number(formatUnits(result[3], 2)),
      ltv: Number(formatUnits(result[4], 2)),
      availableBorrowsUSD: Number(formatUnits(result[2], USD_BASE))
    };
  } catch (error) {
    console.error(`Error fetching Aave v3 position: ${error}`);
    return null;
  }
}

// Fetch Compound v3 position data
export async function fetchCompoundV3Position(
  wallet: Address,
  chain: string
): Promise<PositionData | null> {
  const chainConfig = CHAIN_MAP[chain];
  if (!chainConfig) return null;

  const addresses = PROTOCOL_ADDRESSES['compound-v3'][chain];
  if (!addresses) return null;

  const client = createPublicClient({
    chain: chainConfig,
    transport: http(RPC_URLS[chain])
  });

  try {
    const [borrowBalance, collateralBalance] = await Promise.all([
      client.readContract({
        address: addresses.comet,
        abi: COMET_ABI,
        functionName: 'borrowBalanceOf',
        args: [wallet]
      }),
      client.readContract({
        address: addresses.comet,
        abi: COMET_ABI,
        functionName: 'collateralBalanceOf',
        args: [wallet]
      })
    ]);

    const debtUSD = Number(formatUnits(borrowBalance, 6)); // USDC decimals
    const collateralUSD = Number(formatUnits(collateralBalance[0], 6)); // Simplified

    // Compound v3 doesn't have explicit health factor, we calculate based on collateral/debt ratio
    // Using a base liquidation threshold of 85% for compound v3
    const liqThreshold = 0.85;
    const healthFactor = debtUSD > 0 
      ? (collateralUSD * liqThreshold) / debtUSD 
      : Infinity;

    return {
      healthFactor,
      totalCollateralUSD: collateralUSD,
      totalDebtUSD: debtUSD,
      liquidationThreshold: 85, // 85%
      ltv: 80, // 80%
      availableBorrowsUSD: Math.max(0, collateralUSD * 0.8 - debtUSD)
    };
  } catch (error) {
    console.error(`Error fetching Compound v3 position: ${error}`);
    return null;
  }
}

// Fetch Morpho Blue position data via GraphQL
export async function fetchMorphoPosition(
  wallet: Address,
  chain: string
): Promise<PositionData | null> {
  // Morpho Blue uses GraphQL API
  const query = `
    query GetUserPositions($address: String!) {
      userByAddress(address: $address) {
        markets {
          market {
            id
            lltv
            collateralPrice
            borrowPrice
          }
          collateralAssets
          borrowShares
          supplyShares
        }
      }
    }
  `;

  try {
    const response = await fetch('https://blue-api.morpho.org/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { address: wallet.toLowerCase() }
      })
    });

    const data = await response.json();
    
    if (!data.data?.userByAddress?.markets) return null;

    let totalCollateralUSD = 0;
    let totalDebtUSD = 0;
    let weightedLLTV = 0;

    for (const marketPos of data.data.userByAddress.markets) {
      const market = marketPos.market;
      const collateral = parseFloat(marketPos.collateralAssets) || 0;
      const borrowShares = parseFloat(marketPos.borrowShares) || 0;
      const collateralPrice = parseFloat(market.collateralPrice) || 0;
      const borrowPrice = parseFloat(market.borrowPrice) || 1;
      const lltv = parseFloat(market.lltv) || 0.8;

      totalCollateralUSD += collateral * collateralPrice;
      totalDebtUSD += borrowShares * borrowPrice;
      weightedLLTV += lltv * collateral * collateralPrice;
    }

    if (totalCollateralUSD > 0) {
      weightedLLTV /= totalCollateralUSD;
    }

    const healthFactor = totalDebtUSD > 0 
      ? (totalCollateralUSD * weightedLLTV) / totalDebtUSD 
      : Infinity;

    return {
      healthFactor,
      totalCollateralUSD,
      totalDebtUSD,
      liquidationThreshold: weightedLLTV * 100,
      ltv: weightedLLTV * 0.95 * 100,
      availableBorrowsUSD: Math.max(0, totalCollateralUSD * weightedLLTV * 0.95 - totalDebtUSD)
    };
  } catch (error) {
    console.error(`Error fetching Morpho position: ${error}`);
    return null;
  }
}

// Calculate liquidation alert
export function calculateLiquidationAlert(
  position: PositionData,
  alertThreshold: number,
  protocol: string,
  chain: string
): LiquidationAlert {
  const hf = position.healthFactor;
  
  // Buffer percentage: how much collateral can drop before liquidation
  // Buffer = (1 - 1/HF) * 100 when HF > 1
  const bufferPercent = hf > 1 
    ? ((1 - 1/hf) * 100) 
    : 0;

  // Liquidation price threshold (simplified)
  // This represents the % drop in collateral price that would trigger liquidation
  const liqPriceThreshold = hf > 1 ? bufferPercent : 0;

  // Determine alert level
  let alertLevel: 'safe' | 'warning' | 'danger' | 'critical';
  if (hf >= 2.0) {
    alertLevel = 'safe';
  } else if (hf >= 1.5) {
    alertLevel = 'warning';
  } else if (hf >= 1.1) {
    alertLevel = 'danger';
  } else {
    alertLevel = 'critical';
  }

  const alertThresholdHit = hf < alertThreshold;

  return {
    healthFactor: Math.round(hf * 10000) / 10000,
    liqPriceThreshold: Math.round(liqPriceThreshold * 100) / 100,
    bufferPercent: Math.round(bufferPercent * 100) / 100,
    alertThresholdHit,
    alertLevel,
    collateralUSD: Math.round(position.totalCollateralUSD * 100) / 100,
    debtUSD: Math.round(position.totalDebtUSD * 100) / 100,
    protocol,
    chain
  };
}

// Main function to check position across protocols
export async function checkPosition(
  wallet: string,
  protocolIds: string[],
  chain: string,
  alertThreshold: number = 1.3
): Promise<LiquidationAlert[]> {
  const alerts: LiquidationAlert[] = [];
  const walletAddress = wallet as Address;

  for (const protocol of protocolIds) {
    let position: PositionData | null = null;

    switch (protocol) {
      case 'aave-v3':
        position = await fetchAaveV3Position(walletAddress, chain);
        break;
      case 'compound-v3':
        position = await fetchCompoundV3Position(walletAddress, chain);
        break;
      case 'morpho':
        position = await fetchMorphoPosition(walletAddress, chain);
        break;
      default:
        console.warn(`Unknown protocol: ${protocol}`);
    }

    if (position) {
      const alert = calculateLiquidationAlert(position, alertThreshold, protocol, chain);
      alerts.push(alert);
    }
  }

  return alerts;
}

// Simulate liquidation at different price drops
export interface LiquidationSimulation {
  priceDropPercent: number;
  projectedHealthFactor: number;
  wouldLiquidate: boolean;
}

export function simulateLiquidation(
  currentHF: number,
  priceDrops: number[] = [10, 20, 30, 40, 50]
): LiquidationSimulation[] {
  return priceDrops.map(drop => {
    // HF drops proportionally with collateral value
    const projectedHF = currentHF * (1 - drop / 100);
    return {
      priceDropPercent: drop,
      projectedHealthFactor: Math.round(projectedHF * 10000) / 10000,
      wouldLiquidate: projectedHF < 1.0
    };
  });
}

export { PROTOCOL_ADDRESSES, CHAIN_MAP };