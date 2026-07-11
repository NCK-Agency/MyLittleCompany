import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicExponent: 0x10001,
});

console.log("MCP_OAUTH_PRIVATE_JWK=" + JSON.stringify(privateKey.export({ format: "jwk" })));
console.log("Public JWK (verification only):");
console.log(JSON.stringify(publicKey.export({ format: "jwk" }), null, 2));
