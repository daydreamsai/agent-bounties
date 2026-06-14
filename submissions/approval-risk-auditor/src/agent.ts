import { auditInputSchema } from './types.js';
import { auditApprovals } from './scanner.js';

export const agentMetadata = {
  name: 'approval-risk-auditor',
  version: '0.1.0',
  description: 'Flags risky ERC20/ERC721/ERC1155 approvals and returns unsigned revoke calldata.'
};

export async function auditApprovalRisk(input: unknown) {
  const parsed = auditInputSchema.parse(input);
  return auditApprovals(parsed);
}
