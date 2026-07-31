const GIS_SCRIPT_ID = 'google-identity-services'
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client'

let scriptPromise: Promise<void> | null = null

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts.oauth2)
    return Promise.resolve()
  if (scriptPromise)
    return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GIS_SCRIPT_ID)
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Google Identity Services 載入失敗。')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = GIS_SCRIPT_ID
    script.src = GIS_SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Identity Services 載入失敗。'))
    document.head.appendChild(script)
  })

  return scriptPromise
}

export async function requestGoogleAccessToken(): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  if (!clientId)
    throw new Error('尚未設定 Google Identity Services Client ID。')

  await loadGoogleIdentityServices()
  if (!window.google?.accounts.oauth2)
    throw new Error('Google Identity Services 尚未準備完成。')

  return new Promise((resolve, reject) => {
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid profile email',
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || response.error || 'Google 登入未完成。'))
          return
        }
        resolve(response.access_token)
      },
    })

    tokenClient.requestAccessToken({ prompt: 'select_account' })
  })
}
