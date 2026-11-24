// Public Firebase client configuration; the same values ship in the web app bundle.
export const firebaseConfig = {
  apiKey: "AIzaSyDoHftH1q00ZG39QClV5F9zZh0hGPl1sIE",
  authDomain: "wordmem-497209.firebaseapp.com",
  projectId: "wordmem-497209",
  storageBucket: "wordmem-497209.firebasestorage.app",
  messagingSenderId: "220488210743",
  appId: "1:220488210743:web:8f7289aba8997a1121e2b2",
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  );
}
