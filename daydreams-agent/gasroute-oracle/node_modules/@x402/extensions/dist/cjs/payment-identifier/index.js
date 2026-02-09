"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/payment-identifier/index.ts
var payment_identifier_exports = {};
__export(payment_identifier_exports, {
  PAYMENT_IDENTIFIER: () => PAYMENT_IDENTIFIER,
  PAYMENT_ID_MAX_LENGTH: () => PAYMENT_ID_MAX_LENGTH,
  PAYMENT_ID_MIN_LENGTH: () => PAYMENT_ID_MIN_LENGTH,
  PAYMENT_ID_PATTERN: () => PAYMENT_ID_PATTERN,
  appendPaymentIdentifierToExtensions: () => appendPaymentIdentifierToExtensions,
  declarePaymentIdentifierExtension: () => declarePaymentIdentifierExtension,
  extractAndValidatePaymentIdentifier: () => extractAndValidatePaymentIdentifier,
  extractPaymentIdentifier: () => extractPaymentIdentifier,
  generatePaymentId: () => generatePaymentId,
  hasPaymentIdentifier: () => hasPaymentIdentifier,
  isPaymentIdentifierExtension: () => isPaymentIdentifierExtension,
  isPaymentIdentifierRequired: () => isPaymentIdentifierRequired,
  isValidPaymentId: () => isValidPaymentId,
  paymentIdentifierResourceServerExtension: () => paymentIdentifierResourceServerExtension,
  paymentIdentifierSchema: () => paymentIdentifierSchema,
  validatePaymentIdentifier: () => validatePaymentIdentifier,
  validatePaymentIdentifierRequirement: () => validatePaymentIdentifierRequirement
});
module.exports = __toCommonJS(payment_identifier_exports);

// src/payment-identifier/types.ts
var PAYMENT_IDENTIFIER = "payment-identifier";
var PAYMENT_ID_MIN_LENGTH = 16;
var PAYMENT_ID_MAX_LENGTH = 128;
var PAYMENT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

// src/payment-identifier/schema.ts
var paymentIdentifierSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    required: {
      type: "boolean"
    },
    id: {
      type: "string",
      minLength: PAYMENT_ID_MIN_LENGTH,
      maxLength: PAYMENT_ID_MAX_LENGTH,
      pattern: "^[a-zA-Z0-9_-]+$"
    }
  },
  required: ["required"]
};

// src/payment-identifier/utils.ts
function generatePaymentId(prefix = "pay_") {
  const uuid = crypto.randomUUID().replace(/-/g, "");
  return `${prefix}${uuid}`;
}
function isValidPaymentId(id) {
  if (typeof id !== "string") {
    return false;
  }
  if (id.length < PAYMENT_ID_MIN_LENGTH || id.length > PAYMENT_ID_MAX_LENGTH) {
    return false;
  }
  return PAYMENT_ID_PATTERN.test(id);
}

// src/payment-identifier/validation.ts
var import__ = __toESM(require("ajv/dist/2020.js"));
function isPaymentIdentifierExtension(extension) {
  if (!extension || typeof extension !== "object") {
    return false;
  }
  const ext = extension;
  if (!ext.info || typeof ext.info !== "object") {
    return false;
  }
  const info = ext.info;
  if (typeof info.required !== "boolean") {
    return false;
  }
  return true;
}
function validatePaymentIdentifier(extension) {
  if (!extension || typeof extension !== "object") {
    return {
      valid: false,
      errors: ["Extension must be an object"]
    };
  }
  const ext = extension;
  if (!ext.info || typeof ext.info !== "object") {
    return {
      valid: false,
      errors: ["Extension must have an 'info' property"]
    };
  }
  const info = ext.info;
  if (typeof info.required !== "boolean") {
    return {
      valid: false,
      errors: ["Extension info must have a 'required' boolean property"]
    };
  }
  if (info.id !== void 0 && typeof info.id !== "string") {
    return {
      valid: false,
      errors: ["Extension info 'id' must be a string if provided"]
    };
  }
  if (info.id !== void 0 && !isValidPaymentId(info.id)) {
    return {
      valid: false,
      errors: [
        `Invalid payment ID format. ID must be 16-128 characters and contain only alphanumeric characters, hyphens, and underscores.`
      ]
    };
  }
  if (ext.schema) {
    try {
      const ajv = new import__.default({ strict: false, allErrors: true });
      const validate = ajv.compile(ext.schema);
      const valid = validate(ext.info);
      if (!valid && validate.errors) {
        const errors = validate.errors?.map((err) => {
          const path = err.instancePath || "(root)";
          return `${path}: ${err.message}`;
        }) || ["Unknown validation error"];
        return { valid: false, errors };
      }
    } catch (error) {
      return {
        valid: false,
        errors: [
          `Schema validation failed: ${error instanceof Error ? error.message : String(error)}`
        ]
      };
    }
  }
  return { valid: true };
}
function extractPaymentIdentifier(paymentPayload, validate = true) {
  if (!paymentPayload.extensions) {
    return null;
  }
  const extension = paymentPayload.extensions[PAYMENT_IDENTIFIER];
  if (!extension || typeof extension !== "object") {
    return null;
  }
  const ext = extension;
  if (!ext.info || typeof ext.info !== "object") {
    return null;
  }
  const info = ext.info;
  if (typeof info.id !== "string") {
    return null;
  }
  if (validate && !isValidPaymentId(info.id)) {
    return null;
  }
  return info.id;
}
function extractAndValidatePaymentIdentifier(paymentPayload) {
  if (!paymentPayload.extensions) {
    return { id: null, validation: { valid: true } };
  }
  const extension = paymentPayload.extensions[PAYMENT_IDENTIFIER];
  if (!extension) {
    return { id: null, validation: { valid: true } };
  }
  const validation = validatePaymentIdentifier(extension);
  if (!validation.valid) {
    return { id: null, validation };
  }
  const ext = extension;
  return { id: ext.info.id ?? null, validation: { valid: true } };
}
function hasPaymentIdentifier(paymentPayload) {
  return !!(paymentPayload.extensions && paymentPayload.extensions[PAYMENT_IDENTIFIER]);
}
function isPaymentIdentifierRequired(extension) {
  if (!extension || typeof extension !== "object") {
    return false;
  }
  const ext = extension;
  if (!ext.info || typeof ext.info !== "object") {
    return false;
  }
  return ext.info.required === true;
}
function validatePaymentIdentifierRequirement(paymentPayload, serverRequired) {
  if (!serverRequired) {
    return { valid: true };
  }
  const id = extractPaymentIdentifier(paymentPayload, false);
  if (!id) {
    return {
      valid: false,
      errors: ["Server requires a payment identifier but none was provided"]
    };
  }
  if (!isValidPaymentId(id)) {
    return {
      valid: false,
      errors: [
        `Invalid payment ID format. ID must be 16-128 characters and contain only alphanumeric characters, hyphens, and underscores.`
      ]
    };
  }
  return { valid: true };
}

// src/payment-identifier/client.ts
function appendPaymentIdentifierToExtensions(extensions, id) {
  const extension = extensions[PAYMENT_IDENTIFIER];
  if (!isPaymentIdentifierExtension(extension)) {
    return extensions;
  }
  const paymentId = id ?? generatePaymentId();
  if (!isValidPaymentId(paymentId)) {
    throw new Error(
      `Invalid payment ID: "${paymentId}". ID must be 16-128 characters and contain only alphanumeric characters, hyphens, and underscores.`
    );
  }
  extension.info.id = paymentId;
  return extensions;
}

// src/payment-identifier/resourceServer.ts
function declarePaymentIdentifierExtension(required = false) {
  return {
    info: { required },
    schema: paymentIdentifierSchema
  };
}
var paymentIdentifierResourceServerExtension = {
  key: PAYMENT_IDENTIFIER
  // No enrichment needed - the declaration is static
  // Future hooks for idempotency could be added here if needed
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PAYMENT_IDENTIFIER,
  PAYMENT_ID_MAX_LENGTH,
  PAYMENT_ID_MIN_LENGTH,
  PAYMENT_ID_PATTERN,
  appendPaymentIdentifierToExtensions,
  declarePaymentIdentifierExtension,
  extractAndValidatePaymentIdentifier,
  extractPaymentIdentifier,
  generatePaymentId,
  hasPaymentIdentifier,
  isPaymentIdentifierExtension,
  isPaymentIdentifierRequired,
  isValidPaymentId,
  paymentIdentifierResourceServerExtension,
  paymentIdentifierSchema,
  validatePaymentIdentifier,
  validatePaymentIdentifierRequirement
});
//# sourceMappingURL=index.js.map