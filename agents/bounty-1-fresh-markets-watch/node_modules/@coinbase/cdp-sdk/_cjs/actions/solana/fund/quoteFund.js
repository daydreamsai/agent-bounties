"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quoteFund = quoteFund;
const viem_1 = require("viem");
const errors_js_1 = require("../../../errors.js");
const index_js_1 = require("../../../openapi-client/index.js");
const Quote_js_1 = require("../../Quote.js");
/**
 * Gets a quote to fund a Solana account.
 *
 * @deprecated This method will be removed in a future version. Consider using our Onramp API instead. See https://docs.cdp.coinbase.com/api-reference/v2/rest-api/onramp/create-an-onramp-order.
 * @param apiClient - The API client.
 * @param options - The options for getting a quote to fund a Solana account.
 *
 * @returns A promise that resolves to the quote.
 */
async function quoteFund(apiClient, options) {
    if (options.token !== "sol" && options.token !== "usdc") {
        throw new errors_js_1.UserInputValidationError("Invalid token, must be sol or usdc");
    }
    const decimals = options.token === "sol" ? 9 : 6;
    const amount = (0, viem_1.formatUnits)(options.amount, decimals);
    const paymentMethods = await apiClient.getPaymentMethods();
    const cardPaymentMethod = paymentMethods.find(method => method.type === "card" && method.actions.includes("source"));
    if (!cardPaymentMethod) {
        throw new Error("No card found to fund account");
    }
    const response = await apiClient.createPaymentTransferQuote({
        sourceType: index_js_1.CreatePaymentTransferQuoteBodySourceType.payment_method,
        source: {
            id: cardPaymentMethod.id,
        },
        targetType: index_js_1.CreatePaymentTransferQuoteBodyTargetType.crypto_rail,
        target: {
            currency: options.token,
            network: "solana",
            address: options.address,
        },
        amount,
        currency: options.token,
    });
    return new Quote_js_1.SolanaQuote(apiClient, response.transfer.id, "solana", response.transfer.sourceAmount, response.transfer.sourceCurrency, response.transfer.targetAmount, response.transfer.targetCurrency, response.transfer.fees.map(fee => ({
        type: fee.type,
        amount: fee.amount,
        currency: fee.currency,
    })));
}
//# sourceMappingURL=quoteFund.js.map