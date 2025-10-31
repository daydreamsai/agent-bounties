"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CDPEndUserClient = void 0;
const analytics_js_1 = require("../../analytics.js");
const index_js_1 = require("../../openapi-client/index.js");
/**
 * The CDP end user client.
 */
class CDPEndUserClient {
    /**
     * Validates an end user's access token. Throws an error if the access token is invalid.
     *
     * @param options - The options for validating an access token.
     *
     * @returns The end user object if the access token is valid.
     */
    async validateAccessToken(options) {
        analytics_js_1.Analytics.trackAction({
            action: "validate_access_token",
        });
        const { accessToken } = options;
        return index_js_1.CdpOpenApiClient.validateEndUserAccessToken({
            accessToken,
        });
    }
}
exports.CDPEndUserClient = CDPEndUserClient;
//# sourceMappingURL=endUser.js.map