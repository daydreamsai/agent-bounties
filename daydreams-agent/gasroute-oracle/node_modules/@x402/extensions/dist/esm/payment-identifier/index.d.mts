import { ResourceServerExtension, PaymentPayload } from '@x402/core/types';

/**
 * Type definitions for the Payment-Identifier Extension
 *
 * Enables clients to provide an idempotency key that resource servers
 * can use for deduplication of payment requests.
 */
/**
 * Extension identifier constant for the payment-identifier extension
 */
declare const PAYMENT_IDENTIFIER = "payment-identifier";
/**
 * Minimum length for payment identifier
 */
declare const PAYMENT_ID_MIN_LENGTH = 16;
/**
 * Maximum length for payment identifier
 */
declare const PAYMENT_ID_MAX_LENGTH = 128;
/**
 * Pattern for valid payment identifier characters (alphanumeric, hyphens, underscores)
 */
declare const PAYMENT_ID_PATTERN: RegExp;
/**
 * Payment identifier info containing the required flag and client-provided ID
 */
interface PaymentIdentifierInfo {
    /**
     * Whether the server requires clients to include a payment identifier.
     * When true, clients must provide an `id` or receive a 400 Bad Request.
     */
    required: boolean;
    /**
     * Client-provided unique identifier for idempotency.
     * Must be 16-128 characters, alphanumeric with hyphens and underscores allowed.
     */
    id?: string;
}
/**
 * Payment identifier extension with info and schema.
 *
 * Used both for server-side declarations (info without id) and
 * client-side payloads (info with id).
 */
interface PaymentIdentifierExtension {
    /**
     * The payment identifier info.
     * Server declarations have required only, clients add the id.
     */
    info: PaymentIdentifierInfo;
    /**
     * JSON Schema validating the info structure
     */
    schema: PaymentIdentifierSchema;
}
/**
 * JSON Schema type for the payment-identifier extension
 */
interface PaymentIdentifierSchema {
    $schema: "https://json-schema.org/draft/2020-12/schema";
    type: "object";
    properties: {
        required: {
            type: "boolean";
        };
        id: {
            type: "string";
            minLength: number;
            maxLength: number;
            pattern: string;
        };
    };
    required: ["required"];
}

/**
 * JSON Schema definitions for the Payment-Identifier Extension
 */

/**
 * JSON Schema for validating payment identifier info.
 * Compliant with JSON Schema Draft 2020-12.
 */
declare const paymentIdentifierSchema: PaymentIdentifierSchema;

/**
 * Utility functions for the Payment-Identifier Extension
 */
/**
 * Generates a unique payment identifier.
 *
 * @param prefix - Optional prefix for the ID (e.g., "pay_"). Defaults to "pay_".
 * @returns A unique payment identifier string
 *
 * @example
 * ```typescript
 * // With default prefix
 * const id = generatePaymentId(); // "pay_7d5d747be160e280504c099d984bcfe0"
 *
 * // With custom prefix
 * const id = generatePaymentId("txn_"); // "txn_7d5d747be160e280504c099d984bcfe0"
 *
 * // Without prefix
 * const id = generatePaymentId(""); // "7d5d747be160e280504c099d984bcfe0"
 * ```
 */
declare function generatePaymentId(prefix?: string): string;
/**
 * Validates that a payment ID meets the format requirements.
 *
 * @param id - The payment ID to validate
 * @returns True if the ID is valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidPaymentId("pay_7d5d747be160e280"); // true (exactly 16 chars after prefix removal check)
 * isValidPaymentId("abc"); // false (too short)
 * isValidPaymentId("pay_abc!@#"); // false (invalid characters)
 * ```
 */
declare function isValidPaymentId(id: string): boolean;

/**
 * Client-side utilities for the Payment-Identifier Extension
 */
/**
 * Appends a payment identifier to the extensions object if the server declared support.
 *
 * This function reads the server's `payment-identifier` declaration from the extensions,
 * and appends the client's ID to it. If the extension is not present (server didn't declare it),
 * the extensions are returned unchanged.
 *
 * @param extensions - The extensions object from PaymentRequired (will be modified in place)
 * @param id - Optional custom payment ID. If not provided, a new ID will be generated.
 * @returns The modified extensions object (same reference as input)
 * @throws Error if the provided ID is invalid
 *
 * @example
 * ```typescript
 * import { appendPaymentIdentifierToExtensions } from '@x402/extensions/payment-identifier';
 *
 * // Get extensions from server's PaymentRequired response
 * const extensions = paymentRequired.extensions ?? {};
 *
 * // Append a generated ID (only if server declared payment-identifier)
 * appendPaymentIdentifierToExtensions(extensions);
 *
 * // Or use a custom ID
 * appendPaymentIdentifierToExtensions(extensions, "pay_my_custom_id_12345");
 *
 * // Include in PaymentPayload
 * const paymentPayload = {
 *   x402Version: 2,
 *   resource: paymentRequired.resource,
 *   accepted: selectedPaymentOption,
 *   payload: { ... },
 *   extensions
 * };
 * ```
 */
declare function appendPaymentIdentifierToExtensions(extensions: Record<string, unknown>, id?: string): Record<string, unknown>;

/**
 * Resource Server utilities for the Payment-Identifier Extension
 */

/**
 * Declares the payment-identifier extension for inclusion in PaymentRequired.extensions.
 *
 * Resource servers call this function to advertise support for payment identifiers.
 * The declaration indicates whether a payment identifier is required and includes
 * the schema that clients must follow.
 *
 * @param required - Whether clients must provide a payment identifier. Defaults to false.
 * @returns A PaymentIdentifierExtension object ready for PaymentRequired.extensions
 *
 * @example
 * ```typescript
 * import { declarePaymentIdentifierExtension, PAYMENT_IDENTIFIER } from '@x402/extensions/payment-identifier';
 *
 * // Include in PaymentRequired response (optional identifier)
 * const paymentRequired = {
 *   x402Version: 2,
 *   resource: { ... },
 *   accepts: [ ... ],
 *   extensions: {
 *     [PAYMENT_IDENTIFIER]: declarePaymentIdentifierExtension()
 *   }
 * };
 *
 * // Require payment identifier
 * const paymentRequiredStrict = {
 *   x402Version: 2,
 *   resource: { ... },
 *   accepts: [ ... ],
 *   extensions: {
 *     [PAYMENT_IDENTIFIER]: declarePaymentIdentifierExtension(true)
 *   }
 * };
 * ```
 */
declare function declarePaymentIdentifierExtension(required?: boolean): PaymentIdentifierExtension;
/**
 * ResourceServerExtension implementation for payment-identifier.
 *
 * This extension doesn't require any enrichment hooks since the declaration
 * is static. It's provided for consistency with other extensions and for
 * potential future use with the extension registration system.
 *
 * @example
 * ```typescript
 * import { paymentIdentifierResourceServerExtension } from '@x402/extensions/payment-identifier';
 *
 * resourceServer.registerExtension(paymentIdentifierResourceServerExtension);
 * ```
 */
declare const paymentIdentifierResourceServerExtension: ResourceServerExtension;

/**
 * Validation and extraction utilities for the Payment-Identifier Extension
 */

/**
 * Type guard to check if an object is a valid payment-identifier extension structure.
 *
 * This checks for the basic structure (info object with required boolean),
 * but does not validate the id format if present.
 *
 * @param extension - The object to check
 * @returns True if the object has the expected payment-identifier extension structure
 *
 * @example
 * ```typescript
 * if (isPaymentIdentifierExtension(extensions["payment-identifier"])) {
 *   // TypeScript knows this is PaymentIdentifierExtension
 *   console.log(extension.info.required);
 * }
 * ```
 */
declare function isPaymentIdentifierExtension(extension: unknown): extension is PaymentIdentifierExtension;
/**
 * Result of payment identifier validation
 */
interface PaymentIdentifierValidationResult {
    /**
     * Whether the payment identifier is valid
     */
    valid: boolean;
    /**
     * Error messages if validation failed
     */
    errors?: string[];
}
/**
 * Validates a payment-identifier extension object.
 *
 * Checks both the structure (using JSON Schema) and the ID format.
 *
 * @param extension - The extension object to validate
 * @returns Validation result with errors if invalid
 *
 * @example
 * ```typescript
 * const result = validatePaymentIdentifier(paymentPayload.extensions?.["payment-identifier"]);
 * if (!result.valid) {
 *   console.error("Invalid payment identifier:", result.errors);
 * }
 * ```
 */
declare function validatePaymentIdentifier(extension: unknown): PaymentIdentifierValidationResult;
/**
 * Extracts the payment identifier from a PaymentPayload.
 *
 * @param paymentPayload - The payment payload to extract from
 * @param validate - Whether to validate the ID before returning (default: true)
 * @returns The payment ID string, or null if not present or invalid
 *
 * @example
 * ```typescript
 * const id = extractPaymentIdentifier(paymentPayload);
 * if (id) {
 *   // Use for idempotency lookup
 *   const cached = await idempotencyStore.get(id);
 * }
 * ```
 */
declare function extractPaymentIdentifier(paymentPayload: PaymentPayload, validate?: boolean): string | null;
/**
 * Extracts and validates the payment identifier from a PaymentPayload.
 *
 * @param paymentPayload - The payment payload to extract from
 * @returns Object with the ID and validation result
 *
 * @example
 * ```typescript
 * const { id, validation } = extractAndValidatePaymentIdentifier(paymentPayload);
 * if (!validation.valid) {
 *   return res.status(400).json({ error: validation.errors });
 * }
 * if (id) {
 *   // Use for idempotency
 * }
 * ```
 */
declare function extractAndValidatePaymentIdentifier(paymentPayload: PaymentPayload): {
    id: string | null;
    validation: PaymentIdentifierValidationResult;
};
/**
 * Checks if a PaymentPayload contains a payment-identifier extension.
 *
 * @param paymentPayload - The payment payload to check
 * @returns True if the extension is present
 */
declare function hasPaymentIdentifier(paymentPayload: PaymentPayload): boolean;
/**
 * Checks if the server requires a payment identifier based on the extension info.
 *
 * @param extension - The payment-identifier extension from PaymentRequired or PaymentPayload
 * @returns True if the server requires a payment identifier
 */
declare function isPaymentIdentifierRequired(extension: unknown): boolean;
/**
 * Validates that a payment identifier is provided when required.
 *
 * Use this to check if a client's PaymentPayload satisfies the server's requirement.
 *
 * @param paymentPayload - The client's payment payload
 * @param serverRequired - Whether the server requires a payment identifier (from PaymentRequired)
 * @returns Validation result - invalid if required but not provided
 *
 * @example
 * ```typescript
 * const serverExtension = paymentRequired.extensions?.["payment-identifier"];
 * const serverRequired = isPaymentIdentifierRequired(serverExtension);
 * const result = validatePaymentIdentifierRequirement(paymentPayload, serverRequired);
 * if (!result.valid) {
 *   return res.status(400).json({ error: result.errors });
 * }
 * ```
 */
declare function validatePaymentIdentifierRequirement(paymentPayload: PaymentPayload, serverRequired: boolean): PaymentIdentifierValidationResult;

export { PAYMENT_IDENTIFIER, PAYMENT_ID_MAX_LENGTH, PAYMENT_ID_MIN_LENGTH, PAYMENT_ID_PATTERN, type PaymentIdentifierExtension, type PaymentIdentifierInfo, type PaymentIdentifierSchema, type PaymentIdentifierValidationResult, appendPaymentIdentifierToExtensions, declarePaymentIdentifierExtension, extractAndValidatePaymentIdentifier, extractPaymentIdentifier, generatePaymentId, hasPaymentIdentifier, isPaymentIdentifierExtension, isPaymentIdentifierRequired, isValidPaymentId, paymentIdentifierResourceServerExtension, paymentIdentifierSchema, validatePaymentIdentifier, validatePaymentIdentifierRequirement };
