import { CdpOpenApiClientType, TransferStatus } from "../openapi-client/index.js";
import { WaitOptions } from "../utils/wait.js";
/**
 * Options for waiting for a fund operation.
 */
export type WaitForFundOperationOptions = {
    /** The ID of the transfer to wait for. */
    transferId: string;
    /** Optional options for the wait operation. */
    waitOptions?: WaitOptions;
};
/**
 * Represents a failed fund operation.
 */
export type FailedFundOperation = {
    /** The ID of the transfer. */
    id: string;
    /** The network that the transfer was created on. */
    network: string;
    /** The target amount that will be received. */
    targetAmount: string;
    /** The currency that will be received. */
    targetCurrency: string;
    /** The status of the transfer. */
    status: typeof TransferStatus.failed;
};
/**
 * Represents a completed fund operation.
 */
export type CompletedFundOperation = {
    /** The ID of the transfer. */
    id: string;
    /** The network that the transfer was created on. */
    network: string;
    /** The target amount that will be received. */
    targetAmount: string;
    /** The currency that will be received. */
    targetCurrency: string;
    /** The status of the transfer. */
    status: typeof TransferStatus.completed;
    /** The transaction hash of the transfer. */
    transactionHash: string;
};
/**
 * Represents the return type of the waitForFundOperation function.
 */
export type WaitForFundOperationResult = FailedFundOperation | CompletedFundOperation;
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
export declare function waitForFundOperationReceipt(client: CdpOpenApiClientType, options: WaitForFundOperationOptions): Promise<WaitForFundOperationResult>;
//# sourceMappingURL=waitForFundOperationReceipt.d.ts.map