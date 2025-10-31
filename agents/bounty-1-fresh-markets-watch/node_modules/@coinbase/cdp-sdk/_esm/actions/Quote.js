/**
 * Base class representing a funding quote that can be executed.
 */
class BaseQuote {
    /** Quote for the transfer. */
    quoteId;
    /** The amount in fiat currency. */
    fiatAmount;
    /** The fiat currency. */
    fiatCurrency;
    /** The amount in the token to transfer. */
    tokenAmount;
    /** The token to transfer. */
    token;
    /** Fees in the token to transfer. */
    fees;
    apiClient;
    /**
     * Creates a new BaseQuote instance.
     *
     * @param apiClient - The API client.
     * @param quoteId - The quote ID.
     * @param fiatAmount - The amount in fiat currency.
     * @param fiatCurrency - The fiat currency.
     * @param tokenAmount - The amount in the token to transfer.
     * @param token - The token to transfer.
     * @param fees - Fees for the transfer.
     */
    constructor(apiClient, quoteId, fiatAmount, fiatCurrency, tokenAmount, token, fees) {
        this.apiClient = apiClient;
        this.quoteId = quoteId;
        this.fiatAmount = fiatAmount;
        this.fiatCurrency = fiatCurrency;
        this.tokenAmount = tokenAmount;
        this.token = token;
        this.fees = fees;
    }
    /**
     * Executes the quote to perform the actual fund transfer.
     *
     * @returns A promise that resolves to the result of the executed quote.
     */
    async execute() {
        const transfer = await this.apiClient.executePaymentTransferQuote(this.quoteId);
        return {
            id: transfer.id,
            network: transfer.target.network,
            targetAmount: transfer.targetAmount,
            targetCurrency: transfer.targetCurrency,
            status: transfer.status,
            transactionHash: transfer.transactionHash,
        };
    }
}
/**
 * A class representing an EVM funding quote that can be executed.
 */
export class EvmQuote extends BaseQuote {
    /** Network to transfer the funds to (EVM networks). */
    network;
    /**
     * Creates a new EvmQuote instance.
     *
     * @param apiClient - The API client.
     * @param quoteId - The quote ID.
     * @param network - The EVM network to transfer funds to.
     * @param fiatAmount - The amount in fiat currency.
     * @param fiatCurrency - The fiat currency.
     * @param tokenAmount - The amount in the token to transfer.
     * @param token - The token to transfer.
     * @param fees - Fees for the transfer.
     */
    constructor(apiClient, quoteId, network, fiatAmount, fiatCurrency, tokenAmount, token, fees) {
        super(apiClient, quoteId, fiatAmount, fiatCurrency, tokenAmount, token, fees);
        this.network = network;
    }
}
/**
 * A class representing a Solana funding quote that can be executed.
 */
export class SolanaQuote extends BaseQuote {
    /** Network to transfer the funds to (Solana). */
    network;
    /**
     * Creates a new SolanaQuote instance.
     *
     * @param apiClient - The API client.
     * @param quoteId - The quote ID.
     * @param network - The Solana network to transfer funds to.
     * @param fiatAmount - The amount in fiat currency.
     * @param fiatCurrency - The fiat currency.
     * @param tokenAmount - The amount in the token to transfer.
     * @param token - The token to transfer.
     * @param fees - Fees for the transfer.
     */
    constructor(apiClient, quoteId, network, fiatAmount, fiatCurrency, tokenAmount, token, fees) {
        super(apiClient, quoteId, fiatAmount, fiatCurrency, tokenAmount, token, fees);
        this.network = network;
    }
}
//# sourceMappingURL=Quote.js.map