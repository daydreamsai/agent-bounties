import 'dotenv/config';
import { auditApprovalRisk } from './agent.js';

const wallet = process.env.AUDIT_WALLET;
const chains = (process.env.AUDIT_CHAINS || 'base').split(',').map((item) => item.trim()).filter(Boolean);

if (!wallet) {
  throw new Error('Set AUDIT_WALLET=0x... before running audit:sample');
}

const output = await auditApprovalRisk({ wallet, chains, stale_days: 90 });
console.log(JSON.stringify(output, null, 2));
