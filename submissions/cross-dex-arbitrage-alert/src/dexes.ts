import type { DexConfig } from './types.js';

export const dexes: DexConfig[] = [
  {
    id: 'baseswap-v2-base',
    name: 'BaseSwap V2',
    chain: 'base',
    factory: '0xFDa619b6d20975be80A10332c4529b1aE8D0D00a',
    feeBps: 30,
    swapGasUnits: 150_000
  },
  {
    id: 'sushiswap-v2-base',
    name: 'SushiSwap V2 Base',
    chain: 'base',
    factory: '0x71524B4f93c58fcbF659783284E38825f0622859',
    feeBps: 30,
    swapGasUnits: 150_000
  },
  {
    id: 'pancakeswap-v2-base',
    name: 'PancakeSwap V2 Base',
    chain: 'base',
    factory: '0x02a84c1b3bbd7401a5f7fa98a384ebc70bb5749e',
    feeBps: 25,
    swapGasUnits: 150_000
  },
  {
    id: 'uniswap-v2-eth',
    name: 'Uniswap V2 Ethereum',
    chain: 'eth',
    factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    feeBps: 30,
    swapGasUnits: 160_000
  },
  {
    id: 'sushiswap-v2-eth',
    name: 'SushiSwap V2 Ethereum',
    chain: 'eth',
    factory: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
    router: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
    feeBps: 30,
    swapGasUnits: 160_000
  }
];
