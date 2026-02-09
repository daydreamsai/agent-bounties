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
import Ajv from "ajv/dist/2020.js";
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
      const ajv = new Ajv({ strict: false, allErrors: true });
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

export {
  PAYMENT_IDENTIFIER,
  PAYMENT_ID_MIN_LENGTH,
  PAYMENT_ID_MAX_LENGTH,
  PAYMENT_ID_PATTERN,
  paymentIdentifierSchema,
  generatePaymentId,
  isValidPaymentId,
  isPaymentIdentifierExtension,
  validatePaymentIdentifier,
  extractPaymentIdentifier,
  extractAndValidatePaymentIdentifier,
  hasPaymentIdentifier,
  isPaymentIdentifierRequired,
  validatePaymentIdentifierRequirement,
  appendPaymentIdentifierToExtensions,
  declarePaymentIdentifierExtension,
  paymentIdentifierResourceServerExtension
};
//# sourceMappingURL=chunk-73HCOE6N.mjs.map