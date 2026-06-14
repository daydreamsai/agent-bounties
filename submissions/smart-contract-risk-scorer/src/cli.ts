import 'dotenv/config';
import { runSmartContractRiskScore } from './agent.js';

const contractAddress = process.env.SCORE_CONTRACT_ADDRESS;
const chain = process.env.SCORE_CHAIN || 'ethereum';
const scanDepth = process.env.SCORE_SCAN_DEPTH || 'quick';

if (!contractAddress) {
  throw new Error('Set SCORE_CONTRACT_ADDRESS before running npm run score:sample');
}

const output = await runSmartContractRiskScore({
  contract_address: contractAddress,
  chain,
  scan_depth: scanDepth
});

console.log(JSON.stringify(output, null, 2));
