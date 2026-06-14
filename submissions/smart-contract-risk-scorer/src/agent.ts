import { scoreContractRisk } from './scanner.js';
import { scoreInputSchema } from './types.js';

export const agentMetadata = {
  name: 'smart-contract-risk-scorer',
  version: '0.1.0',
  description: 'Scores EVM smart contract risk with GoPlus, Etherscan, optional Token Sniffer, source patterns, bytecode, and RPC checks.'
};

export async function runSmartContractRiskScore(input: unknown) {
  const parsed = scoreInputSchema.parse(input);
  return scoreContractRisk(parsed);
}
