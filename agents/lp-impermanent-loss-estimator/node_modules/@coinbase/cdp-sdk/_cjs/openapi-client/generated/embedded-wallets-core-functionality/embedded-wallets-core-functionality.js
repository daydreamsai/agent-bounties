"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSolanaAssetWithEndUserAccount = exports.sendSolanaTransactionWithEndUserAccount = exports.signSolanaTransactionWithEndUserAccount = exports.signSolanaMessageWithEndUserAccount = exports.signSolanaHashWithEndUserAccount = exports.revokeSpendPermissionWithEndUserAccount = exports.sendUserOperationWithEndUserAccount = exports.createEvmEip7702DelegationWithEndUserAccount = exports.revokeDelegationForEndUser = exports.signEvmTypedDataWithEndUserAccount = exports.signEvmMessageWithEndUserAccount = exports.sendEvmAssetWithEndUserAccount = exports.sendEvmTransactionWithEndUserAccount = exports.signEvmTransactionWithEndUserAccount = exports.signEvmHashWithEndUserAccount = void 0;
const cdpApiClient_js_1 = require("../../cdpApiClient.js");
/**
 * Signs an arbitrary 32 byte hash with the end user's given EVM account.
 * @summary Sign a hash with end user EVM account
 */
const signEvmHashWithEndUserAccount = (projectId, userId, signEvmHashWithEndUserAccountBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/embedded-wallet-api/projects/${projectId}/end-users/${userId}/evm/sign`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: signEvmHashWithEndUserAccountBody,
    }, options);
};
exports.signEvmHashWithEndUserAccount = signEvmHashWithEndUserAccount;
/**
 * Signs a transaction with the given end user EVM account.
The transaction should be serialized as a hex string using [RLP](https://ethereum.org/en/developers/docs/data-structures-and-encoding/rlp/).

The transaction must be an [EIP-1559 dynamic fee transaction](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1559.md). The developer is responsible for ensuring that the unsigned transaction is valid, as the API will not validate the transaction.
 * @summary Sign a transaction with end user EVM account
 */
const signEvmTransactionWithEndUserAccount = (projectId, userId, signEvmTransactionWithEndUserAccountBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/embedded-wallet-api/projects/${projectId}/end-users/${userId}/evm/sign/transaction`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: signEvmTransactionWithEndUserAccountBody,
    }, options);
};
exports.signEvmTransactionWithEndUserAccount = signEvmTransactionWithEndUserAccount;
/**
 * Signs a transaction with the given end user EVM account and sends it to the indicated supported network. This API handles nonce management and gas estimation, leaving the developer to provide only the minimal set of fields necessary to send the transaction. The transaction should be serialized as a hex string using [RLP](https://ethereum.org/en/developers/docs/data-structures-and-encoding/rlp/).

The transaction must be an [EIP-1559 dynamic fee transaction](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1559.md).


**Transaction fields and API behavior**

- `to` *(Required)*: The address of the contract or account to send the transaction to.
- `chainId` *(Ignored)*: The value of the `chainId` field in the transaction is ignored.
  The transaction will be sent to the network indicated by the `network` field in the request body.

- `nonce` *(Optional)*: The nonce to use for the transaction. If not provided, the API will assign
   a nonce to the transaction based on the current state of the account.

- `maxPriorityFeePerGas` *(Optional)*: The maximum priority fee per gas to use for the transaction.
   If not provided, the API will estimate a value based on current network conditions.

- `maxFeePerGas` *(Optional)*: The maximum fee per gas to use for the transaction.
   If not provided, the API will estimate a value based on current network conditions.

- `gasLimit` *(Optional)*: The gas limit to use for the transaction. If not provided, the API will estimate a value
  based on the `to` and `data` fields of the transaction.

- `value` *(Optional)*: The amount of ETH, in wei, to send with the transaction.
- `data` *(Optional)*: The data to send with the transaction; only used for contract calls.
- `accessList` *(Optional)*: The access list to use for the transaction.
 * @summary Send a transaction with end user EVM account
 */
const sendEvmTransactionWithEndUserAccount = (projectId, userId, sendEvmTransactionWithEndUserAccountBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/embedded-wallet-api/projects/${projectId}/end-users/${userId}/evm/send/transaction`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: sendEvmTransactionWithEndUserAccountBody,
    }, options);
};
exports.sendEvmTransactionWithEndUserAccount = sendEvmTransactionWithEndUserAccount;
/**
 * Sends USDC from an end user's EVM account (EOA or Smart Account) to a recipient address on a supported EVM network. This endpoint simplifies USDC transfers by automatically handling contract resolution, decimal conversion, gas estimation, and transaction encoding.
The `amount` field accepts human-readable amounts as decimal strings (e.g., "1.5", "25.50").
 * @summary Send USDC on EVM
 */
const sendEvmAssetWithEndUserAccount = (projectId, userId, address, asset, sendEvmAssetWithEndUserAccountBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/embedded-wallet-api/projects/${projectId}/end-users/${userId}/evm/${address}/send/${asset}`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: sendEvmAssetWithEndUserAccountBody,
    }, options);
};
exports.sendEvmAssetWithEndUserAccount = sendEvmAssetWithEndUserAccount;
/**
 * Signs an [EIP-191](https://eips.ethereum.org/EIPS/eip-191) message with the given end user EVM account.

Per the specification, the message in the request body is prepended with `0x19 <0x45 (E)> <thereum Signed Message:\n" + len(message)>` before being signed.
 * @summary Sign an EIP-191 message with end user EVM account
 */
const signEvmMessageWithEndUserAccount = (projectId, userId, signEvmMessageWithEndUserAccountBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/embedded-wallet-api/projects/${projectId}/end-users/${userId}/evm/sign/message`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: signEvmMessageWithEndUserAccountBody,
    }, options);
};
exports.signEvmMessageWithEndUserAccount = signEvmMessageWithEndUserAccount;
/**
 * Signs [EIP-712](https://eips.ethereum.org/EIPS/eip-712) typed data with the given end user EVM account.
 * @summary Sign EIP-712 typed data with end user EVM account
 */
const signEvmTypedDataWithEndUserAccount = (projectId, userId, signEvmTypedDataWithEndUserAccountBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/embedded-wallet-api/projects/${projectId}/end-users/${userId}/evm/sign/typed-data`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: signEvmTypedDataWithEndUserAccountBody,
    }, options);
};
exports.signEvmTypedDataWithEndUserAccount = signEvmTypedDataWithEndUserAccount;
/**
 * Revokes all active delegations for the specified end user. This operation can be performed by the end user themselves or by a developer using their API key.
 * @summary Revoke delegation for end user
 */
const revokeDelegationForEndUser = (projectId, userId, revokeDelegationForEndUserBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/embedded-wallet-api/projects/${projectId}/end-users/${userId}/delegation`,
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        data: revokeDelegationForEndUserBody,
    }, options);
};
exports.revokeDelegationForEndUser = revokeDelegationForEndUser;
/**
 * Creates an EIP-7702 delegation for an end user's EVM EOA account, upgrading it with smart account capabilities.

This endpoint:
- Retrieves delegation artifacts from onchain
- Signs the EIP-7702 authorization for delegation
- Assembles and submits a Type 4 transaction
- Creates an associated smart account object

The delegation allows the EVM EOA to be used as a smart account, which enables batched transactions and gas sponsorship via paymaster.
 * @summary Create EIP-7702 delegation for end user EVM account
 */
const createEvmEip7702DelegationWithEndUserAccount = (projectId, userId, createEvmEip7702DelegationWithEndUserAccountBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/embedded-wallet-api/projects/${projectId}/end-users/${userId}/evm/eip7702/delegation`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: createEvmEip7702DelegationWithEndUserAccountBody,
    }, options);
};
exports.createEvmEip7702DelegationWithEndUserAccount = createEvmEip7702DelegationWithEndUserAccount;
/**
 * Prepares, signs, and sends a user operation for an end user's Smart Account.
 * @summary Send a user operation for end user Smart Account
 */
const sendUserOperationWithEndUserAccount = (projectId, userId, address, sendUserOperationWithEndUserAccountBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/embedded-wallet-api/projects/${projectId}/end-users/${userId}/evm/smart-accounts/${address}/send`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: sendUserOperationWithEndUserAccountBody,
    }, options);
};
exports.sendUserOperationWithEndUserAccount = sendUserOperationWithEndUserAccount;
/**
 * Revokes an existing spend permission.
 * @summary Revoke a spend permission
 */
const revokeSpendPermissionWithEndUserAccount = (projectId, userId, address, revokeSpendPermissionRequest, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/embedded-wallet-api/projects/${projectId}/end-users/${userId}/evm/smart-accounts/${address}/spend-permissions/revoke`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: revokeSpendPermissionRequest,
    }, options);
};
exports.revokeSpendPermissionWithEndUserAccount = revokeSpendPermissionWithEndUserAccount;
/**
 * Signs an arbitrary 32 byte hash with the end user's given Solana account.
 * @summary Sign a hash with end user Solana account
 */
const signSolanaHashWithEndUserAccount = (projectId, userId, signSolanaHashWithEndUserAccountBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/embedded-wallet-api/projects/${projectId}/end-users/${userId}/solana/sign`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: signSolanaHashWithEndUserAccountBody,
    }, options);
};
exports.signSolanaHashWithEndUserAccount = signSolanaHashWithEndUserAccount;
/**
 * Signs an arbitrary Base64 encoded message with the given Solana account.
 **WARNING:**  Never sign a message that you didn't generate as it may put your funds at risk.
 * @summary Sign a Base64 encoded message
 */
const signSolanaMessageWithEndUserAccount = (projectId, userId, signSolanaMessageWithEndUserAccountBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/embedded-wallet-api/projects/${projectId}/end-users/${userId}/solana/sign/message`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: signSolanaMessageWithEndUserAccountBody,
    }, options);
};
exports.signSolanaMessageWithEndUserAccount = signSolanaMessageWithEndUserAccount;
/**
 * Signs a transaction with the given end user Solana account.
The unsigned transaction should be serialized into a byte array and then encoded as base64.
**Transaction types**
The following transaction types are supported:
* [Legacy transactions](https://solana-labs.github.io/solana-web3.js/classes/Transaction.html)
* [Versioned transactions](https://solana-labs.github.io/solana-web3.js/classes/VersionedTransaction.html)
The developer is responsible for ensuring that the unsigned transaction is valid, as the API will not validate the transaction.
 * @summary Sign a transaction with end user Solana account
 */
const signSolanaTransactionWithEndUserAccount = (projectId, userId, signSolanaTransactionWithEndUserAccountBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/embedded-wallet-api/projects/${projectId}/end-users/${userId}/solana/sign/transaction`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: signSolanaTransactionWithEndUserAccountBody,
    }, options);
};
exports.signSolanaTransactionWithEndUserAccount = signSolanaTransactionWithEndUserAccount;
/**
 * Signs a transaction with the given end user Solana account and sends it to the indicated supported network.
The API handles recent blockhash management and fee estimation, leaving the developer to provide only the minimal set of fields necessary to send the transaction.
The unsigned transaction should be serialized into a byte array and then encoded as base64.
**Transaction types**
The following transaction types are supported:
* [Legacy transactions](https://solana.com/developers/guides/advanced/versions#current-transaction-versions)
* [Versioned transactions](https://solana.com/developers/guides/advanced/versions)
**Instruction Batching**
To batch multiple operations, include multiple instructions within a single transaction. All instructions within a transaction are executed atomically - if any instruction fails, the entire transaction fails and is rolled back.
**Network Support**
The following Solana networks are supported:
* `solana` - Solana Mainnet
* `solana-devnet` - Solana Devnet
The developer is responsible for ensuring that the unsigned transaction is valid, as the API will not validate the transaction.
 * @summary Send a transaction with end user Solana account
 */
const sendSolanaTransactionWithEndUserAccount = (projectId, userId, sendSolanaTransactionWithEndUserAccountBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/embedded-wallet-api/projects/${projectId}/end-users/${userId}/solana/send/transaction`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: sendSolanaTransactionWithEndUserAccountBody,
    }, options);
};
exports.sendSolanaTransactionWithEndUserAccount = sendSolanaTransactionWithEndUserAccount;
/**
 * Sends USDC from an end user's Solana account to a recipient address on the Solana network. This endpoint simplifies USDC transfers by automatically handling mint resolution, Associated Token Account (ATA) creation, decimal conversion, and transaction encoding.
The `amount` field accepts human-readable amounts as decimal strings (e.g., "1.5", "25.50").
Use the optional `createRecipientAta` parameter to control whether the sender pays for creating the recipient's Associated Token Account if it doesn't exist.
 * @summary Send USDC on Solana
 */
const sendSolanaAssetWithEndUserAccount = (projectId, userId, address, asset, sendSolanaAssetWithEndUserAccountBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/embedded-wallet-api/projects/${projectId}/end-users/${userId}/solana/${address}/send/${asset}`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: sendSolanaAssetWithEndUserAccountBody,
    }, options);
};
exports.sendSolanaAssetWithEndUserAccount = sendSolanaAssetWithEndUserAccount;
//# sourceMappingURL=embedded-wallets-core-functionality.js.map