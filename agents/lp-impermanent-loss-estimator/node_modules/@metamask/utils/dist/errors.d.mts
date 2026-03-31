/**
 * Type guard for determining whether the given value is an error object with a
 * `code` property such as the type of error that Node throws for filesystem
 * operations, etc.
 *
 * @param error - The object to check.
 * @returns A boolean.
 */
export declare function isErrorWithCode(error: unknown): error is {
    code: string;
};
/**
 * Type guard for determining whether the given value is an error object with a
 * `message` property, such as an instance of Error.
 *
 * @param error - The object to check.
 * @returns A boolean.
 */
export declare function isErrorWithMessage(error: unknown): error is {
    message: string;
};
/**
 * Type guard for determining whether the given value is an error object with a
 * `stack` property, such as an instance of Error.
 *
 * @param error - The object to check.
 * @returns A boolean.
 */
export declare function isErrorWithStack(error: unknown): error is {
    stack: string;
};
/**
 * Attempts to obtain the message from a possible error object, defaulting to an
 * empty string if it is impossible to do so.
 *
 * @param error - The possible error to get the message from.
 * @returns The message if `error` is an object with a `message` property;
 * the string version of `error` if it is not `undefined` or `null`; otherwise
 * an empty string.
 */
export declare function getErrorMessage(error: unknown): string;
/**
 * Builds a new error object, linking it to the original error via the `cause`
 * property if it is an Error.
 *
 * This function is useful to reframe error messages in general, but is
 * _critical_ when interacting with any of Node's filesystem functions as
 * provided via `fs.promises`, because these do not produce stack traces in the
 * case of an I/O error (see <https://github.com/nodejs/node/issues/30944>).
 *
 * @param originalError - The error to be wrapped (something throwable).
 * @param message - The desired message of the new error.
 * @returns A new error object.
 */
export declare function wrapError<Throwable>(originalError: Throwable, message: string): Error & {
    code?: string;
};
/**
 * Ensures we have a proper Error object.
 * If the input is already an Error, returns it unchanged.
 * Otherwise, converts to an Error with an appropriate message and preserves
 * the original value as the cause.
 *
 * @param error - The caught error (could be Error, string, or unknown).
 * @returns A proper Error instance.
 */
export declare function ensureError(error: unknown): Error;
//# sourceMappingURL=errors.d.mts.map