import 'dotenv/config';
import { runLpIlEstimator } from './agent.js';

const pool = process.env.IL_POOL_ADDRESS || '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640';
const network = process.env.IL_NETWORK || 'eth';
const windowHours = Number(process.env.IL_WINDOW_HOURS || 24);
const feeBps = Number(process.env.IL_FEE_BPS || 5);

const output = await runLpIlEstimator({
  pool_address: pool,
  network,
  token_weights: [0.5, 0.5],
  deposit_amounts: [1, 1],
  window_hours: windowHours,
  fee_bps: feeBps
});

console.log(JSON.stringify(output, null, 2));
