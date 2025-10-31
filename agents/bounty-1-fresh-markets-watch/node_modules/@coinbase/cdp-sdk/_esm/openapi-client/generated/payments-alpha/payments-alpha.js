import { cdpApiClient } from "../../cdpApiClient.js";
/**
 * Gets the fiat payment methods that can be used to send funds or receive funds. This is the list of payment methods configured for your account.
 * @summary Get the fiat payment methods
 */
export const getPaymentMethods = (options) => {
    return cdpApiClient({ url: `/v2/payments/rails/payment-methods`, method: "GET" }, options);
};
/**
 * Gets the crypto rails that can be used to send funds or receive funds.
 * @summary Get the crypto rails
 */
export const getCryptoRails = (params, options) => {
    return cdpApiClient({ url: `/v2/payments/rails/crypto`, method: "GET", params }, options);
};
/**
 * Creates a new transfer quote, which can then be executed using the Execute a transfer quote endpoint. If you want to automatically execute the transfer without needing to confirm, specify execute as true.
 * @summary Create a transfer quote
 */
export const createPaymentTransferQuote = (createPaymentTransferQuoteBody, options) => {
    return cdpApiClient({
        url: `/v2/payments/transfers`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: createPaymentTransferQuoteBody,
    }, options);
};
/**
 * Executes a transfer quote which was created using the Create a transfer quote endpoint.
 * @summary Execute a transfer quote
 */
export const executePaymentTransferQuote = (transferId, options) => {
    return cdpApiClient({ url: `/v2/payments/transfers/${transferId}/execute`, method: "POST" }, options);
};
/**
 * Gets a transfer by ID.
 * @summary Get a transfer by ID
 */
export const getPaymentTransfer = (transferId, options) => {
    return cdpApiClient({ url: `/v2/payments/transfers/${transferId}`, method: "GET" }, options);
};
//# sourceMappingURL=payments-alpha.js.map