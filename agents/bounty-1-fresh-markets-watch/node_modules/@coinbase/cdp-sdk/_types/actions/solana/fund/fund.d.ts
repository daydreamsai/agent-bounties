import { type CdpOpenApiClientType } from "../../../openapi-client/index.js";
import { BaseFundOptions, FundOperationResult } from "../../types.js";
/**
 * Options for funding a Solana account.
 */
export interface SolanaFundOptions extends BaseFundOptions {
    /** The token to request funds for. */
    token: "sol" | "usdc";
}
/**
 * Funds a Solana account.
 *
 * @deprecated This method will be removed in a future version. Consider using our Onramp API instead. See https://docs.cdp.coinbase.com/api-reference/v2/rest-api/onramp/create-an-onramp-order.
 * @param apiClient - The API client.
 * @param options - The options for funding a Solana account.
 *
 * @returns A promise that resolves to the fund operation result.
 */
export declare function fund(apiClient: CdpOpenApiClientType, options: SolanaFundOptions): Promise<FundOperationResult>;
//# sourceMappingURL=fund.d.ts.map