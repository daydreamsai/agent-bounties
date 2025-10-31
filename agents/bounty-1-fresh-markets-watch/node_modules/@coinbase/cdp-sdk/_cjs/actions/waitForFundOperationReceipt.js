"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForFundOperationReceipt = waitForFundOperationReceipt;
const index_js_1 = require("../openapi-client/index.js");
const wait_js_1 = require("../utils/wait.js");
/**
 * Waits for a fund operation to complete or fail.
 *
 * @deprecated This method will be removed in a future version. Consider using our Onramp API instead. See https://docs.cdp.coinbase.com/api-reference/v2/rest-api/onramp/create-an-onramp-order.
 * @example
 * ```ts
 * import { waitForFundOperation } from "@coinbase/cdp-sdk";
 *
 * const result = await waitForFundOperation(client, {
 *   transferId: "0x1234567890123456789012345678901234567890",
 *   waitOptions: {
 *     timeoutSeconds: 30,
 *   },
 * });
 * ```
 *
 * @param {CdpOpenApiClientType} client - The client to use to wait for the fund operation.
 * @param {WaitForFundOperationOptions} options - The options for the wait operation.
 * @returns {Promise<WaitForFundOperationResult>} The result of the fund operation.
 */
async function waitForFundOperationReceipt(client, options) {
    const { transferId } = options;
    const reload = async () => {
        const response = await client.getPaymentTransfer(transferId);
        return response;
    };
    const transform = (operation) => {
        if (operation.status === index_js_1.TransferStatus.failed) {
            return {
                id: operation.id,
                network: operation.target.network,
                targetAmount: operation.targetAmount,
                targetCurrency: operation.targetCurrency,
                status: operation.status,
            };
        }
        else if (operation.status === index_js_1.TransferStatus.completed) {
            return {
                id: operation.id,
                network: operation.target.network,
                targetAmount: operation.targetAmount,
                targetCurrency: operation.targetCurrency,
                status: operation.status,
                transactionHash: operation.transactionHash,
            };
        }
        else {
            throw new Error("Transfer is not terminal");
        }
    };
    const waitOptions = options.waitOptions || {
        timeoutSeconds: 900,
        intervalSeconds: 1,
    };
    return await (0, wait_js_1.wait)(reload, isTerminal, transform, waitOptions);
}
const isTerminal = (operation) => {
    return (operation.status === index_js_1.TransferStatus.completed || operation.status === index_js_1.TransferStatus.failed);
};
//# sourceMappingURL=waitForFundOperationReceipt.js.map