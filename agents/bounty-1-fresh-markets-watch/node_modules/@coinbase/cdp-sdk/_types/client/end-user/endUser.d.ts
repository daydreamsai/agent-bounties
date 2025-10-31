import { type ValidateAccessTokenOptions } from "./endUser.types.js";
import { type EndUser } from "../../openapi-client/index.js";
/**
 * The CDP end user client.
 */
export declare class CDPEndUserClient {
    /**
     * Validates an end user's access token. Throws an error if the access token is invalid.
     *
     * @param options - The options for validating an access token.
     *
     * @returns The end user object if the access token is valid.
     */
    validateAccessToken(options: ValidateAccessTokenOptions): Promise<EndUser>;
}
//# sourceMappingURL=endUser.d.ts.map