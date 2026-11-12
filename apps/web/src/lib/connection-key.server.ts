import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
function key() {
  const value =
    process.env["TOKEN_ENCRYPTION_KEY"] || process.env["APP_USER_CONNECTION_KEY_SECRET"];
  if (!value) throw new Error("GitHub configuration unavailable");
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) throw new Error("GitHub configuration unavailable");
  return decoded;
}
export function encryptConnectionKey(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}
export function decryptConnectionKey(value: string) {
  const bytes = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
}
