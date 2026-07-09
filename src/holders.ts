const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function extractAddressFromTopic(topic: string): string {
  return "0x" + topic.slice(26);
}

export async function extractHolders(
  provider: any,
  txHash: string,
  pairAddress: string,
  token0: string,
  token1: string
): Promise<string[]> {
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return [];

  const holders = new Set<string>();
  holders.add(receipt.from);
  holders.add(pairAddress);

  for (const log of receipt.logs) {
    if (log.topics[0] !== TRANSFER_TOPIC) continue;
    if (log.address.toLowerCase() !== token0.toLowerCase() && 
        log.address.toLowerCase() !== token1.toLowerCase()) continue;

    const from = extractAddressFromTopic(log.topics[1]);
    const to = extractAddressFromTopic(log.topics[2]);

    if (from.toLowerCase() === ZERO_ADDRESS && to.toLowerCase() !== ZERO_ADDRESS) {
      holders.add(to);
    }
  }

  return Array.from(holders).slice(0, 10);
}
