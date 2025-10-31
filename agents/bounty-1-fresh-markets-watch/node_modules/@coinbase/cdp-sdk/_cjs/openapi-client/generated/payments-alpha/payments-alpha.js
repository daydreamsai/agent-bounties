"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentTransfer = exports.executePaymentTransferQuote = exports.createPaymentTransferQuote = exports.getCryptoRails = exports.getPaymentMethods = void 0;
const cdpApiClient_js_1 = require("../../cdpApiClient.js");
/**
 * Gets the fiat payment methods that can be used to send funds or receive funds. This is the list of payment methods configured for your account.
 * @summary Get the fiat payment methods
 */
const getPaymentMethods = (options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({ url: `/v2/payments/rails/payment-methods`, method: "GET" }, options);
};
exports.getPaymentMethods = getPaymentMethods;
/**
 * Gets the crypto rails that can be used to send funds or receive funds.
 * @summary Get the crypto rails
 */
const getCryptoRails = (params, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({ url: `/v2/payments/rails/crypto`, method: "GET", params }, options);
};
exports.getCryptoRails = getCryptoRails;
/**
 * Creates a new transfer quote, which can then be executed using the Execute a transfer quote endpoint. If you want to automatically execute the transfer without needing to confirm, specify execute as true.
 * @summary Create a transfer quote
 */
const createPaymentTransferQuote = (createPaymentTransferQuoteBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/payments/transfers`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: createPaymentTransferQuoteBody,
    }, options);
};
exports.createPaymentTransferQuote = createPaymentTransferQuote;
/**
 * Executes a transfer quote which was created using the Create a transfer quote endpoint.
 * @summary Execute a transfer quote
 */
const executePaymentTransferQuote = (transferId, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({ url: `/v2/payments/transfers/${transferId}/execute`, method: "POST" }, options);
};
exports.executePaymentTransferQuote = executePaymentTransferQuote;
/**
 * Gets a transfer by ID.
 * @summary Get a transfer by ID
 */
const getPaymentTransfer = (transferId, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({ url: `/v2/payments/transfers/${transferId}`, method: "GET" }, options);
};
exports.getPaymentTransfer = getPaymentTransfer;
//# sourceMappingURL=payments-alpha.js.map