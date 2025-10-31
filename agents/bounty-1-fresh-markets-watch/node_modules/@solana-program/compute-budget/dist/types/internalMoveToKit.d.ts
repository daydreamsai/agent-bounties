import { BaseTransactionMessage, TransactionMessageWithBlockhashLifetime, TransactionMessageWithDurableNonceLifetime } from '@solana/kit';
/**
 * An invalid blockhash lifetime constraint used as a placeholder for
 * transaction messages that are not yet ready to be compiled.
 *
 * This enables various operations on the transaction message, such as
 * simulating it or calculating its transaction size, whilst defering
 * the actual blockhash to a later stage.
 */
export declare const PROVISORY_BLOCKHASH_LIFETIME_CONSTRAINT: TransactionMessageWithBlockhashLifetime['lifetimeConstraint'];
/**
 * Sets a provisory blockhash lifetime constraint on the transaction message
 * if and only if it doesn't already have a lifetime constraint.
 */
export declare function fillMissingTransactionMessageLifetimeUsingProvisoryBlockhash<TTransactionMessage extends BaseTransactionMessage>(transactionMessage: TTransactionMessage): TTransactionMessage & (TransactionMessageWithBlockhashLifetime | TransactionMessageWithDurableNonceLifetime);
/**
 * Sets a provisory blockhash lifetime constraint on the transaction message.
 */
export declare function setTransactionMessageLifetimeUsingProvisoryBlockhash<TTransactionMessage extends BaseTransactionMessage>(transactionMessage: TTransactionMessage): TTransactionMessage & TransactionMessageWithBlockhashLifetime;
//# sourceMappingURL=internalMoveToKit.d.ts.map