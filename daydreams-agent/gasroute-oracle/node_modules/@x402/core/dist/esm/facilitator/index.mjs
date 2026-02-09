import {
  x402Version
} from "../chunk-VE37GDG2.mjs";
import "../chunk-BJTO5JO5.mjs";

// src/facilitator/x402Facilitator.ts
var x402Facilitator = class {
  constructor() {
    this.registeredFacilitatorSchemes = /* @__PURE__ */ new Map();
    this.extensions = [];
    this.beforeVerifyHooks = [];
    this.afterVerifyHooks = [];
    this.onVerifyFailureHooks = [];
    this.beforeSettleHooks = [];
    this.afterSettleHooks = [];
    this.onSettleFailureHooks = [];
  }
  /**
   * Registers a scheme facilitator for the current x402 version.
   * Networks are stored and used for getSupported() - no need to specify them later.
   *
   * @param networks - Single network or array of networks this facilitator supports
   * @param facilitator - The scheme network facilitator to register
   * @returns The x402Facilitator instance for chaining
   */
  register(networks, facilitator) {
    const networksArray = Array.isArray(networks) ? networks : [networks];
    return this._registerScheme(x402Version, networksArray, facilitator);
  }
  /**
   * Registers a scheme facilitator for x402 version 1.
   * Networks are stored and used for getSupported() - no need to specify them later.
   *
   * @param networks - Single network or array of networks this facilitator supports
   * @param facilitator - The scheme network facilitator to register
   * @returns The x402Facilitator instance for chaining
   */
  registerV1(networks, facilitator) {
    const networksArray = Array.isArray(networks) ? networks : [networks];
    return this._registerScheme(1, networksArray, facilitator);
  }
  /**
   * Registers a protocol extension.
   *
   * @param extension - The extension name to register (e.g., "bazaar", "sign_in_with_x")
   * @returns The x402Facilitator instance for chaining
   */
  registerExtension(extension) {
    if (!this.extensions.includes(extension)) {
      this.extensions.push(extension);
    }
    return this;
  }
  /**
   * Gets the list of registered extensions.
   *
   * @returns Array of extension names
   */
  getExtensions() {
    return [...this.extensions];
  }
  /**
   * Register a hook to execute before facilitator payment verification.
   * Can abort verification by returning { abort: true, reason: string }
   *
   * @param hook - The hook function to register
   * @returns The x402Facilitator instance for chaining
   */
  onBeforeVerify(hook) {
    this.beforeVerifyHooks.push(hook);
    return this;
  }
  /**
   * Register a hook to execute after successful facilitator payment verification (isValid: true).
   * This hook is NOT called when verification fails (isValid: false) - use onVerifyFailure for that.
   *
   * @param hook - The hook function to register
   * @returns The x402Facilitator instance for chaining
   */
  onAfterVerify(hook) {
    this.afterVerifyHooks.push(hook);
    return this;
  }
  /**
   * Register a hook to execute when facilitator payment verification fails.
   * Called when: verification returns isValid: false, or an exception is thrown during verification.
   * Can recover from failure by returning { recovered: true, result: VerifyResponse }
   *
   * @param hook - The hook function to register
   * @returns The x402Facilitator instance for chaining
   */
  onVerifyFailure(hook) {
    this.onVerifyFailureHooks.push(hook);
    return this;
  }
  /**
   * Register a hook to execute before facilitator payment settlement.
   * Can abort settlement by returning { abort: true, reason: string }
   *
   * @param hook - The hook function to register
   * @returns The x402Facilitator instance for chaining
   */
  onBeforeSettle(hook) {
    this.beforeSettleHooks.push(hook);
    return this;
  }
  /**
   * Register a hook to execute after successful facilitator payment settlement.
   *
   * @param hook - The hook function to register
   * @returns The x402Facilitator instance for chaining
   */
  onAfterSettle(hook) {
    this.afterSettleHooks.push(hook);
    return this;
  }
  /**
   * Register a hook to execute when facilitator payment settlement fails.
   * Can recover from failure by returning { recovered: true, result: SettleResponse }
   *
   * @param hook - The hook function to register
   * @returns The x402Facilitator instance for chaining
   */
  onSettleFailure(hook) {
    this.onSettleFailureHooks.push(hook);
    return this;
  }
  /**
   * Gets supported payment kinds, extensions, and signers.
   * Uses networks registered during register() calls - no parameters needed.
   * Returns flat array format for backward compatibility with V1 clients.
   *
   * @returns Supported response with kinds as array (with version in each element), extensions, and signers
   */
  getSupported() {
    const kinds = [];
    const signersByFamily = {};
    for (const [version, schemeDataArray] of this.registeredFacilitatorSchemes) {
      for (const schemeData of schemeDataArray) {
        const { facilitator, networks } = schemeData;
        const scheme = facilitator.scheme;
        for (const network of networks) {
          const extra = facilitator.getExtra(network);
          kinds.push({
            x402Version: version,
            scheme,
            network,
            ...extra && { extra }
          });
          const family = facilitator.caipFamily;
          if (!signersByFamily[family]) {
            signersByFamily[family] = /* @__PURE__ */ new Set();
          }
          facilitator.getSigners(network).forEach((signer) => signersByFamily[family].add(signer));
        }
      }
    }
    const signers = {};
    for (const [family, signerSet] of Object.entries(signersByFamily)) {
      signers[family] = Array.from(signerSet);
    }
    return {
      kinds,
      extensions: this.extensions,
      signers
    };
  }
  /**
   * Verifies a payment payload against requirements.
   *
   * @param paymentPayload - The payment payload to verify
   * @param paymentRequirements - The payment requirements to verify against
   * @returns Promise resolving to the verification response
   */
  async verify(paymentPayload, paymentRequirements) {
    const context = {
      paymentPayload,
      requirements: paymentRequirements
    };
    for (const hook of this.beforeVerifyHooks) {
      const result = await hook(context);
      if (result && "abort" in result && result.abort) {
        return {
          isValid: false,
          invalidReason: result.reason
        };
      }
    }
    try {
      const schemeDataArray = this.registeredFacilitatorSchemes.get(paymentPayload.x402Version);
      if (!schemeDataArray) {
        throw new Error(
          `No facilitator registered for x402 version: ${paymentPayload.x402Version}`
        );
      }
      let schemeNetworkFacilitator;
      for (const schemeData of schemeDataArray) {
        if (schemeData.facilitator.scheme === paymentRequirements.scheme) {
          if (schemeData.networks.has(paymentRequirements.network)) {
            schemeNetworkFacilitator = schemeData.facilitator;
            break;
          }
          const patternRegex = new RegExp("^" + schemeData.pattern.replace("*", ".*") + "$");
          if (patternRegex.test(paymentRequirements.network)) {
            schemeNetworkFacilitator = schemeData.facilitator;
            break;
          }
        }
      }
      if (!schemeNetworkFacilitator) {
        throw new Error(
          `No facilitator registered for scheme: ${paymentRequirements.scheme} and network: ${paymentRequirements.network}`
        );
      }
      const verifyResult = await schemeNetworkFacilitator.verify(
        paymentPayload,
        paymentRequirements
      );
      if (!verifyResult.isValid) {
        const failureContext = {
          ...context,
          error: new Error(verifyResult.invalidReason || "Verification failed")
        };
        for (const hook of this.onVerifyFailureHooks) {
          const result = await hook(failureContext);
          if (result && "recovered" in result && result.recovered) {
            const recoveredContext = {
              ...context,
              result: result.result
            };
            for (const hook2 of this.afterVerifyHooks) {
              await hook2(recoveredContext);
            }
            return result.result;
          }
        }
        return verifyResult;
      }
      const resultContext = {
        ...context,
        result: verifyResult
      };
      for (const hook of this.afterVerifyHooks) {
        await hook(resultContext);
      }
      return verifyResult;
    } catch (error) {
      const failureContext = {
        ...context,
        error
      };
      for (const hook of this.onVerifyFailureHooks) {
        const result = await hook(failureContext);
        if (result && "recovered" in result && result.recovered) {
          return result.result;
        }
      }
      throw error;
    }
  }
  /**
   * Settles a payment based on the payload and requirements.
   *
   * @param paymentPayload - The payment payload to settle
   * @param paymentRequirements - The payment requirements for settlement
   * @returns Promise resolving to the settlement response
   */
  async settle(paymentPayload, paymentRequirements) {
    const context = {
      paymentPayload,
      requirements: paymentRequirements
    };
    for (const hook of this.beforeSettleHooks) {
      const result = await hook(context);
      if (result && "abort" in result && result.abort) {
        throw new Error(`Settlement aborted: ${result.reason}`);
      }
    }
    try {
      const schemeDataArray = this.registeredFacilitatorSchemes.get(paymentPayload.x402Version);
      if (!schemeDataArray) {
        throw new Error(
          `No facilitator registered for x402 version: ${paymentPayload.x402Version}`
        );
      }
      let schemeNetworkFacilitator;
      for (const schemeData of schemeDataArray) {
        if (schemeData.facilitator.scheme === paymentRequirements.scheme) {
          if (schemeData.networks.has(paymentRequirements.network)) {
            schemeNetworkFacilitator = schemeData.facilitator;
            break;
          }
          const patternRegex = new RegExp("^" + schemeData.pattern.replace("*", ".*") + "$");
          if (patternRegex.test(paymentRequirements.network)) {
            schemeNetworkFacilitator = schemeData.facilitator;
            break;
          }
        }
      }
      if (!schemeNetworkFacilitator) {
        throw new Error(
          `No facilitator registered for scheme: ${paymentRequirements.scheme} and network: ${paymentRequirements.network}`
        );
      }
      const settleResult = await schemeNetworkFacilitator.settle(
        paymentPayload,
        paymentRequirements
      );
      const resultContext = {
        ...context,
        result: settleResult
      };
      for (const hook of this.afterSettleHooks) {
        await hook(resultContext);
      }
      return settleResult;
    } catch (error) {
      const failureContext = {
        ...context,
        error
      };
      for (const hook of this.onSettleFailureHooks) {
        const result = await hook(failureContext);
        if (result && "recovered" in result && result.recovered) {
          return result.result;
        }
      }
      throw error;
    }
  }
  /**
   * Internal method to register a scheme facilitator.
   *
   * @param x402Version - The x402 protocol version
   * @param networks - Array of concrete networks this facilitator supports
   * @param facilitator - The scheme network facilitator to register
   * @returns The x402Facilitator instance for chaining
   */
  _registerScheme(x402Version2, networks, facilitator) {
    if (!this.registeredFacilitatorSchemes.has(x402Version2)) {
      this.registeredFacilitatorSchemes.set(x402Version2, []);
    }
    const schemeDataArray = this.registeredFacilitatorSchemes.get(x402Version2);
    schemeDataArray.push({
      facilitator,
      networks: new Set(networks),
      pattern: this.derivePattern(networks)
    });
    return this;
  }
  /**
   * Derives a wildcard pattern from an array of networks.
   * If all networks share the same namespace, returns wildcard pattern.
   * Otherwise returns the first network for exact matching.
   *
   * @param networks - Array of networks
   * @returns Derived pattern for matching
   */
  derivePattern(networks) {
    if (networks.length === 0) return "";
    if (networks.length === 1) return networks[0];
    const namespaces = networks.map((n) => n.split(":")[0]);
    const uniqueNamespaces = new Set(namespaces);
    if (uniqueNamespaces.size === 1) {
      return `${namespaces[0]}:*`;
    }
    return networks[0];
  }
};
export {
  x402Facilitator
};
//# sourceMappingURL=index.mjs.map