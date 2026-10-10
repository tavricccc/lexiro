import {
  constants,
  createCipheriv,
  createHash,
  createPublicKey,
  publicEncrypt,
  randomBytes,
} from "node:crypto";
import { writeFileSync } from "node:fs";

const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!account.project_id || !account.client_email || !account.private_key)
  throw new Error("Missing Firebase service account fields");
const publicDer = Buffer.from(process.env.WRAPPING_PUBLIC_KEY, "base64");
const key = createPublicKey({ key: publicDer, format: "der", type: "spki" });
const aesKey = randomBytes(32);
const nonce = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", aesKey, nonce);
const ciphertext = Buffer.concat([
  cipher.update(JSON.stringify(account), "utf8"),
  cipher.final(),
]);
writeFileSync(
  "agent-credential-sealed.json",
  JSON.stringify({
    version: 1,
    recipient: createHash("sha256").update(publicDer).digest("hex"),
    encryptedKey: publicEncrypt(
      { key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      aesKey,
    ).toString("base64"),
    nonce: nonce.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  }),
);
console.log("Encrypted credential prepared; no plaintext credential was saved.");
