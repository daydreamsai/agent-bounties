import { type CdpOpenApiClientType } from "../../../openapi-client/index.js";
import { BaseFundOptions, FundOperationResult } from "../../types.js";
/**
 * Options for funding an EVM account.
 */
export interface EvmFundOptions extends BaseFundOptions {
    /** The network to request funds from. */
    network: "base" | "ethereum";
    /** The token to request funds for. */
    token: "eth" | "usdc";
}
/**
 * Funds an EVM account.
 *
 * @deprecated This method will be removed in a future version. Consider using our Onramp API instead. See https://docs.cdp.coinbase.com/api-reference/v2/rest-api/onramp/create-an-onramp-order.
 * @param apiClient - The API client.
 * @param options - The options for funding an EVM account.
 *
 * @returns A promise that resolves to the fund operation result.
 */
export declare function fund(apiClient: CdpOpenApiClientType, options: EvmFundOptions): Promise<FundOperationResult>;
//# sourceMappingURL=fund.d.ts.map