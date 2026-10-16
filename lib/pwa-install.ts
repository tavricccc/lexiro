/** Where this page is running, for deciding how to get Lexiro onto the device. */

export type InAppBrowserName =
  | "LINE"
  | "Facebook"
  | "Messenger"
  | "Instagram"
  | "Threads"
  | "TikTok"
  | "WeChat"
  | "Google"
  | "Android WebView";

const IN_APP_BROWSERS: Array<[InAppBrowserName, RegExp]> = [
  ["LINE", /\bLine\//i],
  [
    "Messenger",
    /\bFBAN\/MessengerForiOS|\bFB_IAB\/Messenger|\bMessengerLiteForiOS/i,
  ],
  ["Facebook", /\bFBAN\/|\bFBAV\/|\bFB_IAB\/FB4A/i],
  ["Instagram", /\bInstagram\b/i],
  ["Threads", /\bBarcelona\b|\bThreads\b/i],
  ["TikTok", /\bBytedanceWebview\b|\bTikTok\b|\bmusical_ly\b/i],
  ["WeChat", /\bMicroMessenger\b/i],
  ["Google", /\bGSA\//i],
  [
    "Android WebView",
    /(?:;\s*wv\)|\bVersion\/4\.0\b.*\bChrome\/.*\bMobile Safari\/)/i,
  ],
];

export function detectInAppBrowser(userAgent: string) {
  return (
    IN_APP_BROWSERS.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? null
  );
}

export function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIosDevice(
  userAgent: string,
  platform: string,
  touchPoints: number,
) {
  return (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && touchPoints > 1)
  );
}

export function isAndroidDevice(userAgent: string) {
  return /Android/i.test(userAgent);
}

/** Chrome or the Google app on iOS cannot add to the home screen; Safari can. */
export function iosNonSafariBrowser(
  userAgent: string,
  platform: string,
  touchPoints: number,
) {
  if (!isIosDevice(userAgent, platform, touchPoints)) return null;
  if (/\bCriOS\//i.test(userAgent)) return "Chrome";
  if (/\bGSA\//i.test(userAgent)) return "Google";
  return null;
}

/**
 * Hands the page from a messaging app's browser to the system one where the
 * app allows it: LINE through its own flag, Android through a Chrome intent.
 */
export function tryRedirectToExternalBrowser(userAgent: string) {
  const browser = detectInAppBrowser(userAgent);
  if (!browser) return false;
  const url = new URL(window.location.href);
  if (browser === "LINE") {
    if (url.searchParams.has("openExternalBrowser")) return false;
    url.searchParams.set("openExternalBrowser", "1");
    window.location.replace(url.toString());
    return true;
  }
  if (!isAndroidDevice(userAgent) || url.searchParams.has("intent_redirected"))
    return false;
  const fallback = new URL(url);
  fallback.searchParams.set("intent_redirected", "1");
  window.location.href =
    `intent://${url.host}${url.pathname}${url.search}${url.hash}` +
    `#Intent;scheme=${url.protocol.replace(":", "")};package=com.android.chrome;` +
    `S.browser_fallback_url=${encodeURIComponent(fallback.toString())};end`;
  return true;
}
