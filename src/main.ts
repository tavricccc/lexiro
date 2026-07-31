import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { i18n } from './lib/i18n'
import router from './router'
import { useLearningStore } from './stores/learning'
import { useLibraryStore } from './stores/library'
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
  const libraryStore = useLibraryStore(pinia)

  await setsStore.loadState()
  await libraryStore.loadState()
  for (const set of setsStore.sets)
    libraryStore.linkSet(set)
  await sessionStore.loadState()
  await learningStore.loadState()
  uiStore.initTheme()

  await router.isReady()
  app.mount('#app')

  window.setTimeout(() => {
    void import('./stores/cloudSync')
      .then(({ useCloudSyncStore }) => useCloudSyncStore(pinia).init())
      .catch(() => undefined)
  }, 1200)
}

bootstrap()
