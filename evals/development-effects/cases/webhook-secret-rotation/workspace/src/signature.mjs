import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySignature(payload, header, secret) {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new TypeError("secret must be a non-empty string");
  }
  if (typeof header !== "string" || !/^sha256=[0-9a-f]{64}$/i.test(header)) {
    return false;
  }

  const actual = Buffer.from(header.slice("sha256=".length), "hex");
  const expected = createHmac("sha256", secret).update(payload).digest();
  return timingSafeEqual(actual, expected);
}
