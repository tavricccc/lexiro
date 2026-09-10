/**
 * Copy text content to the user's system clipboard using standard navigator.clipboard API.
 * Throws an Error if the clipboard API is not available in the current environment.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error("clipboard unavailable");
  }
  await navigator.clipboard.writeText(text);
}
