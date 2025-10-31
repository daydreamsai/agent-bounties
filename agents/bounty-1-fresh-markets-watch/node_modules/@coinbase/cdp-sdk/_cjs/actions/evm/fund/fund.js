"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fund = fund;
const viem_1 = require("viem");
const errors_js_1 = require("../../../errors.js");
const index_js_1 = require("../../../openapi-client/index.js");
/**
 * Funds an EVM account.
 *
 * @deprecated This method will be removed in a future version. Consider using our Onramp API instead. See https://docs.cdp.coinbase.com/api-reference/v2/rest-api/onramp/create-an-onramp-order.
 * @param apiClient - The API client.
 * @param options - The options for funding an EVM account.
 *
 * @returns A promise that resolves to the fund operation result.
 */
async function fund(apiClient, options) {
    if (options.token !== "eth" && options.token !== "usdc") {
        throw new errors_js_1.UserInputValidationError("Invalid token, must be eth or usdc");
    }
    const decimals = options.token === "eth" ? 18 : 6;
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
            network: options.network,
            address: options.address,
        },
        amount,
        currency: options.token,
        execute: true,
    });
    return {
        id: response.transfer.id,
        network: response.transfer.target.network,
        status: response.transfer.status,
        targetAmount: response.transfer.targetAmount,
        targetCurrency: response.transfer.targetCurrency,
        transactionHash: response.transfer.transactionHash,
    };
}
//# sourceMappingURL=fund.js.map