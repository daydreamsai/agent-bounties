import { CdpOpenApiClientType } from "../../../openapi-client/index.js";
import { SolanaQuote } from "../../Quote.js";
import { BaseQuoteFundOptions } from "../../types.js";
/**
 * Options for getting a quote to fund a Solana account.
 */
export interface SolanaQuoteFundOptions extends BaseQuoteFundOptions {
    /** The token to request funds for. */
    token: "sol" | "usdc";
}
/**
 * Gets a quote to fund a Solana account.
 *
 * @deprecated This method will be removed in a future version. Consider using our Onramp API instead. See https://docs.cdp.coinbase.com/api-reference/v2/rest-api/onramp/create-an-onramp-order.
 * @param apiClient - The API client.
 * @param options - The options for getting a quote to fund a Solana account.
 *
 * @returns A promise that resolves to the quote.
 */
export declare function quoteFund(apiClient: CdpOpenApiClientType, options: SolanaQuoteFundOptions): Promise<SolanaQuote>;
//# sourceMappingURL=quoteFund.d.ts.map