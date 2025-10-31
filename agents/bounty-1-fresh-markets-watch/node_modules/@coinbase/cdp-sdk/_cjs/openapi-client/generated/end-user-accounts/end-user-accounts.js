"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEndUserAccessToken = void 0;
const cdpApiClient_js_1 = require("../../cdpApiClient.js");
/**
 * Validates the end user's access token and returns the end user's information. Returns an error if the access token is invalid or expired.

This API is intended to be used by the developer's own backend, and is authenticated using the developer's CDP API key.
 * @summary Validate end user access token
 */
const validateEndUserAccessToken = (validateEndUserAccessTokenBody, options) => {
    return (0, cdpApiClient_js_1.cdpApiClient)({
        url: `/v2/end-users/auth/validate-token`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: validateEndUserAccessTokenBody,
    }, options);
};
exports.validateEndUserAccessToken = validateEndUserAccessToken;
//# sourceMappingURL=end-user-accounts.js.map