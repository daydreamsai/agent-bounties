import { runBridgeRoutePinger } from './agent.js';

const output = await runBridgeRoutePinger({
  token: process.env.BRIDGE_TOKEN || 'ETH',
  amount: process.env.BRIDGE_AMOUNT || '0.001',
  from_chain: process.env.BRIDGE_FROM_CHAIN || 'base',
  to_chain: process.env.BRIDGE_TO_CHAIN || 'optimism',
  from_address: process.env.BRIDGE_FROM_ADDRESS || '0x0000000000000000000000000000000000000001'
});
console.log(JSON.stringify(output, null, 2));
