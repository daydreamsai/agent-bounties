import { runPerpsFundingPulse } from './agent.js';

const venueIds = (process.env.PERPS_VENUE_IDS || 'hyperliquid').split(',').map((value) => value.trim()).filter(Boolean);
const markets = (process.env.PERPS_MARKETS || 'BTC,ETH').split(',').map((value) => value.trim()).filter(Boolean);

const output = await runPerpsFundingPulse({ venue_ids: venueIds, markets });
console.log(JSON.stringify(output, null, 2));
