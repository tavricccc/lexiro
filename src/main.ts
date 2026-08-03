import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { loadAiSettingsState } from './lib/ai-provider'
import { i18n } from './lib/i18n'
import { preloadLottieAssets } from './lib/lottie'
import router from './router'
import { useCloudSyncStore } from './stores/cloudSync'
import { useLearningStore } from './stores/learning'
import { useSessionStore } from './stores/session'
import { useSetsStore } from './stores/sets'
import { useUIStore } from './stores/ui'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(i18n)

function scheduleLottiePreload() {
  const preload = () => preloadLottieAssets()
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  }
  if (idleWindow.requestIdleCallback)
    idleWindow.requestIdleCallback(preload, { timeout: 3000 })
  else
    window.setTimeout(preload, 0)
}

async function bootstrap() {
  const setsStore = useSetsStore(pinia)
  const sessionStore = useSessionStore(pinia)
  const uiStore = useUIStore(pinia)
  const learningStore = useLearningStore(pinia)
  const minimumStartup = new Promise(resolve => window.setTimeout(resolve, 2000))
  try {
    await Promise.all([
      setsStore.loadState(),
      sessionStore.loadState(),
      learningStore.loadState(),
      uiStore.loadState(),
      loadAiSettingsState(),
      router.isReady(),
    ])
    uiStore.initTheme()
    void useCloudSyncStore(pinia).init()
  }
  catch (error) {
    console.error('Failed to initialize local app state:', error)
  }
  finally {
    await minimumStartup
    uiStore.finishAppStartup()
  }
}

app.mount('#app')
scheduleLottiePreload()
void bootstrap()
