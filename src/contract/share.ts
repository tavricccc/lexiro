/** No I, O, 0 or 1, so a code can be read out and typed without mix-ups. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const SHARE_CODE_LENGTH = 8;
const CODE = /^[A-HJ-NP-Z2-9]{8}$/;
/** Links made before codes were short; they stay valid until their owner stops sharing. */
const LONG_CODE = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** A new random share code: the last part of the share link. */
export function newShareCode(): string {
  // 256 is a multiple of the alphabet's 32 letters, so every letter is as likely.
  return Array.from(crypto.getRandomValues(new Uint8Array(SHARE_CODE_LENGTH)), (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

/**
 * The share code in what someone typed or pasted: the code itself, in any case
 * and with spaces or dashes, or text holding a whole share link. Null when there is none.
 */
export function parseShareCode(text: string): string | null {
  const value = (/\/shared\/([\w-]+)/.exec(text)?.[1] ?? text).trim();
  if (LONG_CODE.test(value)) return value.toLowerCase();
  const code = value.replace(/[\s-]/g, "").toUpperCase();
  return CODE.test(code) ? code : null;
}
