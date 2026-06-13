import 'dotenv/config';
import { runGasRouteOracle } from './oracle.js';

const input = {
  chain_set: (process.env.GASROUTE_CHAIN_SET ?? 'ethereum,base,polygon,arbitrum,optimism').split(',').map((item) => item.trim()).filter(Boolean),
  calldata_size_bytes: Number(process.env.GASROUTE_CALLDATA_SIZE_BYTES ?? 256),
  gas_units_est: Number(process.env.GASROUTE_GAS_UNITS_EST ?? 120000)
};

const output = await runGasRouteOracle(input);
console.log(JSON.stringify(output, null, 2));