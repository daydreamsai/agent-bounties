import 'dotenv/config';
import { runTokenHolderMonitor } from './agent.js';

const contractAddress = process.env.MONITOR_CONTRACT_ADDRESS;
const chain = process.env.MONITOR_CHAIN || 'ethereum';
const minHolders = process.env.MONITOR_MIN_HOLDERS ? Number(process.env.MONITOR_MIN_HOLDERS) : undefined;
const lookbackBlocks = process.env.MONITOR_LOOKBACK_BLOCKS ? Number(process.env.MONITOR_LOOKBACK_BLOCKS) : undefined;

if (!contractAddress) throw new Error('Set MONITOR_CONTRACT_ADDRESS before running npm run monitor:sample');

const output = await runTokenHolderMonitor({
  contract_address: contractAddress,
  chain,
  min_holders: minHolders,
  lookback_blocks: lookbackBlocks
});

console.log(JSON.stringify(output, null, 2));
