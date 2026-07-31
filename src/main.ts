import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { i18n } from './lib/i18n'
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

async function bootstrap() {
  const setsStore = useSetsStore(pinia)
  const sessionStore = useSessionStore(pinia)
  const uiStore = useUIStore(pinia)
  const learningStore = useLearningStore(pinia)
  const cloudSyncStore = useCloudSyncStore(pinia)

  await setsStore.loadState()
  await sessionStore.loadState()
  await learningStore.loadState()
  uiStore.initTheme()
  await cloudSyncStore.init()

  await router.isReady()
  app.mount('#app')
}

bootstrap()
