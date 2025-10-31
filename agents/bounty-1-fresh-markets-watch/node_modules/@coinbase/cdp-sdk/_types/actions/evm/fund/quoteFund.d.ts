import { type CdpOpenApiClientType } from "../../../openapi-client/index.js";
import { EvmQuote } from "../../Quote.js";
import { BaseQuoteFundOptions } from "../../types.js";
/**
 * Options for getting a quote to fund an EVM account.
 */
export interface EvmQuoteFundOptions extends BaseQuoteFundOptions {
    /** The network to request funds from. */
    network: "base" | "ethereum";
    /** The token to request funds for. */
    token: "eth" | "usdc";
}
/**
 * Gets a quote to fund an EVM account.
 *
 * @deprecated This method will be removed in a future version. Consider using our Onramp API instead. See https://docs.cdp.coinbase.com/api-reference/v2/rest-api/onramp/create-an-onramp-order.
 * @param apiClient - The API client.
 * @param options - The options for getting a quote to fund an EVM account.
 *
 * @returns A promise that resolves to the quote.
 */
export declare function quoteFund(apiClient: CdpOpenApiClientType, options: EvmQuoteFundOptions): Promise<EvmQuote>;
//# sourceMappingURL=quoteFund.d.ts.map