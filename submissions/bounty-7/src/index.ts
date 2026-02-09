import { Agent } from '@lucid-agents/core'
import { x402Middleware } from '@lucid-agents/payments'

const X402_CONFIG = {
  network: 'base-sepolia',
  recipient: '0x76A24D4E0444fF3Cc6B792F3Ba1408a77066De6C',
  price: 0.01
}

export const agent = new Agent({
  name: `bounty-${process.argv[2]}`,
  description: 'DeFi monitoring agent with x402 micropayments',
  version: '1.0.0'
})

agent.use(x402Middleware(X402_CONFIG))

agent.addHandler('default', async (req, ctx) => {
  return { message: 'Agent ready', timestamp: new Date().toISOString() }
})

export default agent
