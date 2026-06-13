import { monitorInputSchema } from './types.js';
import { monitorTokenHolders } from './scanner.js';

export const agentMetadata = {
  name: 'token-holder-monitor',
  version: '0.1.0',
  description: 'Monitors ERC20 holder concentration, whale wallets, and large transfers from live Transfer logs and balance checks.'
};

export async function runTokenHolderMonitor(input: unknown) {
  const parsed = monitorInputSchema.parse(input);
  return monitorTokenHolders(parsed);
}
