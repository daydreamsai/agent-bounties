"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/utils/index.ts
var utils_exports = {};
__export(utils_exports, {
  Base64EncodedRegex: () => Base64EncodedRegex,
  deepEqual: () => deepEqual,
  findByNetworkAndScheme: () => findByNetworkAndScheme,
  findFacilitatorBySchemeAndNetwork: () => findFacilitatorBySchemeAndNetwork,
  findSchemesByNetwork: () => findSchemesByNetwork,
  safeBase64Decode: () => safeBase64Decode,
  safeBase64Encode: () => safeBase64Encode
});
module.exports = __toCommonJS(utils_exports);
var findSchemesByNetwork = (map, network) => {
  let implementationsByScheme = map.get(network);
  if (!implementationsByScheme) {
    for (const [registeredNetworkPattern, implementations] of map.entries()) {
      const pattern = registeredNetworkPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*");
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(network)) {
        implementationsByScheme = implementations;
        break;
      }
    }
  }
  return implementationsByScheme;
};
var findByNetworkAndScheme = (map, scheme, network) => {
  return findSchemesByNetwork(map, network)?.get(scheme);
};
var findFacilitatorBySchemeAndNetwork = (schemeMap, scheme, network) => {
  const schemeData = schemeMap.get(scheme);
  if (!schemeData) return void 0;
  if (schemeData.networks.has(network)) {
    return schemeData.facilitator;
  }
  const patternRegex = new RegExp("^" + schemeData.pattern.replace("*", ".*") + "$");
  if (patternRegex.test(network)) {
    return schemeData.facilitator;
  }
  return void 0;
};
var Base64EncodedRegex = /^[A-Za-z0-9+/]*={0,2}$/;
function safeBase64Encode(data) {
  if (typeof globalThis !== "undefined" && typeof globalThis.btoa === "function") {
    const bytes = new TextEncoder().encode(data);
    const binaryString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return globalThis.btoa(binaryString);
  }
  return Buffer.from(data, "utf8").toString("base64");
}
function safeBase64Decode(data) {
  if (typeof globalThis !== "undefined" && typeof globalThis.atob === "function") {
    const binaryString = globalThis.atob(data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(bytes);
  }
  return Buffer.from(data, "base64").toString("utf-8");
}
function deepEqual(obj1, obj2) {
  const normalize = (obj) => {
    if (obj === null || obj === void 0) return JSON.stringify(obj);
    if (typeof obj !== "object") return JSON.stringify(obj);
    if (Array.isArray(obj)) {
      return JSON.stringify(
        obj.map(
          (item) => typeof item === "object" && item !== null ? JSON.parse(normalize(item)) : item
        )
      );
    }
    const sorted = {};
    Object.keys(obj).sort().forEach((key) => {
      const value = obj[key];
      sorted[key] = typeof value === "object" && value !== null ? JSON.parse(normalize(value)) : value;
    });
    return JSON.stringify(sorted);
  };
  try {
    return normalize(obj1) === normalize(obj2);
  } catch {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Base64EncodedRegex,
  deepEqual,
  findByNetworkAndScheme,
  findFacilitatorBySchemeAndNetwork,
  findSchemesByNetwork,
  safeBase64Decode,
  safeBase64Encode
});
//# sourceMappingURL=index.js.map