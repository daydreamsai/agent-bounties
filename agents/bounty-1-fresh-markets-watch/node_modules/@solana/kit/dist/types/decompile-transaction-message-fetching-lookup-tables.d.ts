import { type FetchAccountsConfig } from '@solana/accounts';
import type { GetMultipleAccountsApi, Rpc } from '@solana/rpc';
import { CompilableTransactionMessage, CompiledTransactionMessage } from '@solana/transaction-messages';
type DecompileTransactionMessageFetchingLookupTablesConfig = FetchAccountsConfig & {
    lastValidBlockHeight?: bigint;
};
/**
 * Returns a {@link TransactionMessage} from a {@link CompiledTransactionMessage}. If any of the
 * accounts in the compiled message require an address lookup table to find their address, this
 * function will use the supplied RPC instance to fetch the contents of the address lookup table
 * from the network.
 *
 * @param rpc An object that supports the {@link GetMultipleAccountsApi} of the Solana RPC API
 * @param config
 */
export declare function decompileTransactionMessageFetchingLookupTables(compiledTransactionMessage: CompiledTransactionMessage, rpc: Rpc<GetMultipleAccountsApi>, config?: DecompileTransactionMessageFetchingLookupTablesConfig): Promise<CompilableTransactionMessage>;
export {};
//# sourceMappingURL=decompile-transaction-message-fetching-lookup-tables.d.ts.map