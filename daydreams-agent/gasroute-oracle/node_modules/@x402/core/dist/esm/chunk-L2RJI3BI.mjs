// src/types/facilitator.ts
var VerifyError = class extends Error {
  /**
   * Creates a VerifyError from a failed verification response.
   *
   * @param statusCode - HTTP status code from the facilitator
   * @param response - The verify response containing error details
   */
  constructor(statusCode, response) {
    const reason = response.invalidReason || "unknown reason";
    const message = response.invalidMessage;
    super(message ? `${reason}: ${message}` : reason);
    this.name = "VerifyError";
    this.statusCode = statusCode;
    this.invalidReason = response.invalidReason;
    this.invalidMessage = response.invalidMessage;
    this.payer = response.payer;
  }
};
var SettleError = class extends Error {
  /**
   * Creates a SettleError from a failed settlement response.
   *
   * @param statusCode - HTTP status code from the facilitator
   * @param response - The settle response containing error details
   */
  constructor(statusCode, response) {
    const reason = response.errorReason || "unknown reason";
    const message = response.errorMessage;
    super(message ? `${reason}: ${message}` : reason);
    this.name = "SettleError";
    this.statusCode = statusCode;
    this.errorReason = response.errorReason;
    this.errorMessage = response.errorMessage;
    this.payer = response.payer;
    this.transaction = response.transaction;
    this.network = response.network;
  }
};

export {
  VerifyError,
  SettleError
};
//# sourceMappingURL=chunk-L2RJI3BI.mjs.map